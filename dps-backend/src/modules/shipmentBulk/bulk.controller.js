import { parseCSV } from "../../utils/csvParser.js";
import { validateCSVStructure, validateRow } from "./bulk.validator.js";
import { resolveMasters } from "./bulk.service.js";
import { insertShipment } from "../shipment/shipment.service.js";


import { db } from "../../config/database.js";

export const bulkPreview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV file required" });
    }

    const rows = await parseCSV(req.file.path);

    /* 1️⃣ STRUCTURE VALIDATION */
    const structure = validateCSVStructure(rows);
    if (!structure.valid) {
      return res.status(400).json({ success: false, ...structure });
    }

    /* 2️⃣ DUPLICATE SHIPMENT CHECK */
    const shipmentNos = rows.map(r => r.shipment_no).filter(Boolean);

    const [existing] = await db.query(
      `SELECT shipment_no FROM shipment WHERE shipment_no IN (?)`,
      [shipmentNos]
    );

    const existingSet = new Set(existing.map(r => String(r.shipment_no)));

    const preview = [];

    /* 3️⃣ ROW-BY-ROW DECISION */
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const errors = [];
      const reasons = [];

      /* Row validation */
      const rowValidation = validateRow(row, i);
      if (rowValidation.errors.length) {
        preview.push({
          row_no: i + 2,
          shipment_no: row.shipment_no,
          status: "ERROR",
          reasons: rowValidation.errors,
          match: {},
          resolved_ids: {},
          raw: row,
        });
        continue;
      }

      /* Duplicate shipment_no */
      if (existingSet.has(String(row.shipment_no))) {
        preview.push({
          row_no: i + 2,
          shipment_no: row.shipment_no,
          status: "ERROR",
          reasons: ["Shipment number already exists"],
          match: {},
          resolved_ids: {},
          raw: row,
        });
        continue;
      }

      /* Master resolution */
      const master = await resolveMasters(row);

      const match = {
        route: !!master.route_id,
        vehicle: !!master.vehicle_id,
      };

      if (!match.route) reasons.push("Route not found");
      if (!match.vehicle) reasons.push("Vehicle not found");

      const status =
        reasons.length === 0 ? "VALID" : "PENDING";

      preview.push({
        row_no: i + 2,
        shipment_no: row.shipment_no,
        status,
        reasons,
        match,
        resolved_ids: {
          route_id: master.route_id,
          vehicle_id: master.vehicle_id,
        },
        raw: row,
      });
    }

    return res.json({
      success: true,
      summary: {
        total: preview.length,
        valid: preview.filter(r => r.status === "VALID").length,
        pending: preview.filter(r => r.status === "PENDING").length,
        error: preview.filter(r => r.status === "ERROR").length,
      },
      preview,
    });
  } catch (err) {
    console.error("❌ Bulk preview error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// export const bulkPreview = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ success: false, message: "CSV file required" });
//     }

//     const rows = await parseCSV(req.file.path);

//     const structureCheck = validateCSVStructure(rows);
//     if (!structureCheck.valid) {
//       return res.status(400).json({ success: false, ...structureCheck });
//     }

//     const preview = {
//       total: rows.length,
//       valid: [],
//       invalid: [],
//     };

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       const rowValidation = validateRow(row, i);

//       if (rowValidation.errors.length) {
//         preview.invalid.push({ ...row, errors: rowValidation.errors });
//         continue;
//       }

//       const master = await resolveMasters(row);

//       preview.valid.push({
//         ...row,
//         route_id: master.route_id,
//         vehicle_id: master.vehicle_id,
//         approval_status: master.requiresApproval ? "PENDING" : "ACTIVE",
//       });
//     }

//     return res.json({ success: true, preview });
//   } catch (err) {
//     console.error("❌ Bulk preview error:", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };



export const bulkCommit = async (req, res) => {
  console.log("BULK Commit Hit");
    console.log("Rows received:", req.body?.rows?.length);

  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows to upload",
      });
    }

    const inserted = [];
    const failed = [];

    for (const row of rows) {
      try {
        const isPending = row.approval_status === "PENDING";

        const normalizeDate = (value) => {
  if (!value) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Convert DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null; // invalid format
};

        
const payload = {
  shipment_no: BigInt(row.shipment_no).toString(),
  shipment_date: normalizeDate(row.shipment_date) || null,
  billing_doc_number: row.billing_doc_number || null,
  billing_date: normalizeDate(row.billing_date) || null,
  chassis_no: row.chassis_no || null,
  engine_no: null,
  allocation_date: normalizeDate(row.allocation_date) || null,
  dispatch_date: normalizeDate(row.dispatch_date),

  estimated_delivery_date: null,
  delivery_date: null,
  current_status: row.current_status || "Dispatched",

  route_id: row.route_id || null,
  vehicle_id: row.vehicle_id || null,
  driver_route_id: null,

  raw_dispatch_plant: row.dispatch_location,
  raw_delivery_location: row.delivery_location,
  raw_state: row.state,
  raw_dealer_name: row.dealer_name,
  raw_km: row.km || null,

  raw_vehicle_material_no: row.material_no,
  raw_vehicle_model: row.model || null,
  raw_vehicle_avg: null,

  raw_driver_name: null,
  raw_dl_number: null,

  approval_status: row.approval_status || "PENDING",

  pump1_qty: 0,
  pump1_rate: 0,
  pump2_qty: 0,
  pump2_rate: 0,
  pump3_qty: 0,
  pump3_rate: 0,
  pump4_qty: 0,
  pump4_rate: 0,
  fuel_card_qty: 0,
  fuel_card_rate: 0,
  hsd_qty: 0,
  hsd_rate: 0,
};

          
        console.log("➡️ Inserting payload:", payload);

        const id = await insertShipment(payload);
        inserted.push(id);
      } catch (err) {
        failed.push({
          shipment_no: row.shipment_no,
          error: err.sqlMessage || err.message,
        });
      }
    }

    return res.json({
      success: true,
      inserted_count: inserted.length,
      failed_count: failed.length,
      failed,
    });
  } catch (err) {
    console.error("❌ Bulk commit error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
