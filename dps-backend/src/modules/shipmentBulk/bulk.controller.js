import { parseCSV } from "../../utils/csvParser.js";
import { validateCSVStructure, validateRow } from "./bulk.validator.js";
import { resolveMasters } from "./bulk.service.js";
import { insertShipment } from "../shipment/shipment.service.js";
import { db } from "../../config/database.js";

/* ================================================================
   BULK PREVIEW
   ================================================================ */
export const bulkPreview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV file required" });
    }

    const rows = await parseCSV(req.file.path);

    /* Structure check */
    const structure = validateCSVStructure(rows);
    if (!structure.valid) {
      return res.status(400).json({ success: false, ...structure });
    }

    /* Duplicate DB check */
    const shipmentNos = rows.map(r => r.shipment_no).filter(Boolean);
    const [existing]  = await db.query(
      `SELECT shipment_no FROM shipment WHERE shipment_no IN (?)`,
      [shipmentNos]
    );
    const existingSet = new Set(existing.map(r => String(r.shipment_no)));

    const preview = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      /* Row-level validation */
      const rowValidation = validateRow(row, i);
      if (rowValidation.errors.length) {
        preview.push({
          row_no: i + 2, shipment_no: row.shipment_no,
          status: "ERROR", reasons: rowValidation.errors,
          match: {}, resolved_ids: {}, raw: row,
        });
        continue;
      }

      /* Duplicate check */
      if (existingSet.has(String(row.shipment_no))) {
        preview.push({
          row_no: i + 2, shipment_no: row.shipment_no,
          status: "ERROR", reasons: ["Shipment number already exists"],
          match: {}, resolved_ids: {}, raw: row,
        });
        continue;
      }

      /* Master resolution (route + vehicle only) */
      const master  = await resolveMasters(row);
      const reasons = [];
      if (!master.route_id)   reasons.push("Route not found");
      if (!master.vehicle_id) reasons.push("Vehicle not found");
      if (master.route_id && master.vehicle_id && !master.driver_route_id) reasons.push("No driver assigned to this route");

      preview.push({
        row_no: i + 2, shipment_no: row.shipment_no,
        status: reasons.length === 0 ? "VALID" : "PENDING",
        reasons,
        match: { route: !!master.route_id, vehicle: !!master.vehicle_id, driver_route: !!master.driver_route_id },
        resolved_ids: {
          route_id:        master.route_id,
          vehicle_id:      master.vehicle_id,
          driver_route_id: master.driver_route_id,
        },
        raw: row,
      });
    }

    return res.json({
      success: true,
      summary: {
        total:   preview.length,
        valid:   preview.filter(r => r.status === "VALID").length,
        pending: preview.filter(r => r.status === "PENDING").length,
        error:   preview.filter(r => r.status === "ERROR").length,
      },
      preview,
    });
  } catch (err) {
    console.error("❌ Bulk preview error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================================================================
   BULK COMMIT
   Matched (route+vehicle) → HOLD  (shows in Shipments, needs fund request)
   Unmatched               → PENDING (goes to PendingShipments)
   Returns inserted_count, hold_count, pending_count, failed_count
   ================================================================ */
export const bulkCommit = async (req, res) => {
  console.log("BULK Commit Hit — rows:", req.body?.rows?.length);

  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: "No valid rows to upload" });
    }

    const inserted = [];
    const failed   = [];
    let holdCount    = 0;
    let pendingCount = 0;

    const normalizeDate = (value) => {
      if (!value) return null;
      const str = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split(/[/-]/);
        return `${yyyy}-${mm}-${dd}`;
      }
      if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(str)) {
        const [yyyy, mm, dd] = str.split(/[/-]/);
        return `${yyyy}-${mm}-${dd}`;
      }
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      return null;
    };

    const addDays = (dateStr, days) => {
      if (!dateStr || !days) return null;
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    for (const row of rows) {
      try {
        /* Re-resolve masters at commit time (fresh DB lookup) */
        const master = await resolveMasters({
          dispatch_plant:    row.dispatch_location || row.dispatch_plant,
          delivery_location: row.delivery_location,
          dealer_name:       row.dealer_name,
          material_no:       row.material_no,
        });

        // Matched → HOLD (shows in Shipments, needs fund request to activate)
        // Unmatched → PENDING (goes to PendingShipments for admin approval)
        const approvalStatus = master.requiresApproval ? "PENDING" : "HOLD";
        const currentStatus  = approvalStatus === "PENDING" ? "Pending Approval" : (row.current_status || "Dispatched");

        const dispatchDate = normalizeDate(row.dispatch_date);

        let estimatedDeliveryDate = null;
        if (dispatchDate && master.route_id) {
          const [routeRows] = await db.query(
            "SELECT km FROM route_master WHERE route_id = ?",
            [master.route_id]
          );
          if (routeRows.length && routeRows[0].km) {
            const travelDays = Math.ceil(Number(routeRows[0].km) / 300);
            estimatedDeliveryDate = addDays(dispatchDate, travelDays);
          }
        }

        // ── Plant code: from CSV row, validated against branch scope ──
        const rowPlantCode = String(row.plant_code || "").trim();
        const scopePlant   = req.scope?.plantCode || null;

        // Branch user can only upload their own plant_code
        if (scopePlant && rowPlantCode && rowPlantCode !== scopePlant) {
          failed.push({ shipment_no: row.shipment_no, error: `plant_code ${rowPlantCode} not allowed for your branch` });
          continue;
        }

        const payload = {
          shipment_no:             BigInt(row.shipment_no).toString(),
          plant_code:              rowPlantCode || scopePlant || null,
          shipment_date:           normalizeDate(row.shipment_date)   || null,
          billing_doc_number:      row.billing_doc_number             || null,
          billing_date:            normalizeDate(row.billing_date)    || null,
          chassis_no:              row.chassis_no                     || null,
          engine_no:               null,
          allocation_date:         normalizeDate(row.allocation_date) || null,
          dispatch_date:           dispatchDate,
          estimated_delivery_date: estimatedDeliveryDate,
          delivery_date:           null,
          current_status:          currentStatus,

          route_id:        master.route_id        || null,
          vehicle_id:      master.vehicle_id      || null,
          driver_route_id: master.driver_route_id || null,

          raw_dispatch_plant:      row.dispatch_location || row.dispatch_plant || null,
          raw_delivery_location:   row.delivery_location || null,
          raw_state:               row.state             || null,
          raw_dealer_name:         row.dealer_name       || null,
          raw_km:                  row.km                || null,
          raw_vehicle_material_no: row.material_no       || null,
          raw_vehicle_model:       row.model             || null,
          raw_vehicle_avg:         null,
          raw_driver_name:         null,
          raw_dl_number:           null,

          approval_status: approvalStatus,
          fuel_entries: [],
        };

        console.log("Original Dispatch Date:", row.dispatch_date);
        console.log("Normalized Dispatch Date:", normalizeDate(row.dispatch_date));

        const id = await insertShipment(payload);
        inserted.push(id);

        if (approvalStatus === "HOLD") holdCount++;
        else                           pendingCount++;

      } catch (err) {
        console.error("❌ Row insert failed:", row.shipment_no, err.sqlMessage || err.message);
        failed.push({ shipment_no: row.shipment_no, error: err.sqlMessage || err.message });
      }
    }

    return res.json({
      success:        true,
      inserted_count: inserted.length,
      hold_count:     holdCount,
      pending_count:  pendingCount,
      failed_count:   failed.length,
      failed,
    });
  } catch (err) {
    console.error("❌ Bulk commit error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};