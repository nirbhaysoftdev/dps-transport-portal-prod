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
   Returns inserted_count, active_count, pending_count, failed_count
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
    let activeCount  = 0;
    let pendingCount = 0;

    const normalizeDate = (value) => {
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
        const [dd, mm, yyyy] = value.split("-");
        return `${yyyy}-${mm}-${dd}`;
      }
      return null;
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

        const approvalStatus = master.requiresApproval ? "PENDING" : "ACTIVE";
        const currentStatus  = approvalStatus === "PENDING" ? "Pending Approval" : (row.current_status || "Dispatched");

        const payload = {
          shipment_no:        BigInt(row.shipment_no).toString(),
          shipment_date:      normalizeDate(row.shipment_date)    || null,
          billing_doc_number: row.billing_doc_number              || null,
          billing_date:       normalizeDate(row.billing_date)     || null,
          chassis_no:         row.chassis_no                      || null,
          engine_no:          null,
          allocation_date:    normalizeDate(row.allocation_date)  || null,
          dispatch_date:      normalizeDate(row.dispatch_date),
          estimated_delivery_date: null,
          delivery_date:      null,
          current_status:     currentStatus,

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

          pump1_qty: 0, pump1_rate: 0,
          pump2_qty: 0, pump2_rate: 0,
          pump3_qty: 0, pump3_rate: 0,
          pump4_qty: 0, pump4_rate: 0,
          fuel_card_qty: 0, fuel_card_rate: 0,
          hsd_qty: 0, hsd_rate: 0,
        };

        const id = await insertShipment(payload);
        inserted.push(id);

        if (approvalStatus === "ACTIVE")  activeCount++;
        else                              pendingCount++;

      } catch (err) {
        console.error("❌ Row insert failed:", row.shipment_no, err.sqlMessage || err.message);
        failed.push({ shipment_no: row.shipment_no, error: err.sqlMessage || err.message });
      }
    }

    return res.json({
      success:       true,
      inserted_count: inserted.length,
      active_count:   activeCount,
      pending_count:  pendingCount,
      failed_count:   failed.length,
      failed,
    });
  } catch (err) {
    console.error("❌ Bulk commit error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};