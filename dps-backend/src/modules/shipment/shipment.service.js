import { db } from "../../config/database.js";
import { upsertFinanceRecord } from "../finance/finance.service.js";

/* ================================================================
   FUEL ENTRY HELPERS
   ================================================================ */

/** Delete all fuel entries for a shipment then re-insert */
export const replaceFuelEntries = async (shipmentId, fuelEntries = []) => {
  await db.query(
    `DELETE FROM shipment_fuel_entries WHERE shipment_id = ?`,
    [shipmentId]
  );
  if (!fuelEntries.length) return;
  const values = fuelEntries
    .filter(e => Number(e.qty) > 0 && Number(e.rate) > 0)
    .map(e => [
      shipmentId,
      e.entry_type,
      e.entry_type === "TIED_PUMP" ? (e.pump_id || null) : null,
      Number(e.qty),
      Number(e.rate),
      Number(e.qty) * Number(e.rate),
    ]);
  if (!values.length) return;
  await db.query(
    `INSERT INTO shipment_fuel_entries
       (shipment_id, entry_type, pump_id, qty, rate, amount)
     VALUES ?`,
    [values]
  );
};

/** Fetch all fuel entries for a shipment — JOINs pump master for display */
export const getFuelEntries = async (shipmentId) => {
  const [rows] = await db.query(
    `SELECT
       sfe.id, sfe.entry_type, sfe.pump_id,
       sfe.qty, sfe.rate, sfe.amount,
       ppm.pump_name, ppm.location, ppm.omc, ppm.fuel_category
     FROM shipment_fuel_entries sfe
     LEFT JOIN petrol_pump_master ppm ON ppm.id = sfe.pump_id
     WHERE sfe.shipment_id = ?
     ORDER BY sfe.id ASC`,
    [shipmentId]
  );
  return rows;
};

/** Sum all fuel amounts for a shipment */
export const getFuelTotal = async (shipmentId) => {
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM shipment_fuel_entries WHERE shipment_id = ?`,
    [shipmentId]
  );
  return Number(row.total);
};

/** Fetch all active pumps from master — for frontend dropdown */
export const getPetrolPumps = async () => {
  const [rows] = await db.query(
    `SELECT id, pump_name, location, omc, fuel_category
     FROM petrol_pump_master
     WHERE is_active = 1
     ORDER BY location, pump_name`
  );
  return rows;
};

const STATE_TAX_COLUMNS = [
  "ts_armed_forces_tax","andhra_pradesh_tax","arunachal_pradesh_tax","assam_tax",
  "bihar_tax","chhattisgarh_tax","delhi_tax","goa_tax","gujarat_tax","haryana_tax",
  "himachal_pradesh_tax","jharkhand_tax","karnataka_tax","kerala_tax",
  "madhya_pradesh_tax","maharashtra_tax","manipur_tax","meghalaya_tax",
  "mizoram_tax","nagaland_tax","odisha_tax","punjab_tax","rajasthan_tax",
  "sikkim_tax","tamil_nadu_tax","telangana_tax","tripura_tax",
  "uttar_pradesh_tax","uttarakhand_tax","west_bengal_tax",
];

/* ================================================================
   GET ALL DRIVERS  (for dropdown)
   ================================================================ */
export const getAllDrivers = async () => {
  const [rows] = await db.query(
    `SELECT driver_id, driver_name, driver_dl FROM driver_master WHERE is_active = 1 ORDER BY driver_name`
  );
  return rows;
};

/* ================================================================
   CHECK MASTERS
   Returns existing master data so the form can lock fields and
   auto-fill values (vehicle avg, driver DL, toll, tax amounts).
   ================================================================ */
export const checkMasters = async ({ dispatch_plant, delivery_location, dealer_name, material_no }) => {
  const result = { route: null, vehicle: null, driver_route: null, toll: null, taxes: [] };

  // ── Vehicle ────────────────────────────────────────────────────
  let vehicleId = null;
  if (material_no) {
    const [rows] = await db.query(
      `SELECT vehicle_id, model, avg FROM vehicle_master WHERE material_no = ? AND is_active = 1 LIMIT 1`,
      [material_no]
    );
    if (rows.length) {
      result.vehicle = rows[0];
      vehicleId = rows[0].vehicle_id;
    }
  }

  // ── Route ──────────────────────────────────────────────────────
  if (dispatch_plant && delivery_location && dealer_name) {
    const [rows] = await db.query(
      `SELECT route_id, km, state FROM route_master
       WHERE dispatch_plant = ? AND delivery_location = ? AND dealer_name = ? AND is_active = 1
       LIMIT 1`,
      [dispatch_plant, delivery_location, dealer_name]
    );
    if (rows.length) {
      result.route = rows[0];

      // Auto-fetch toll for this route
      const [tollRows] = await db.query(
        `SELECT manual_toll_fix_toll, toll_amount
         FROM route_toll_master WHERE route_id = ? AND vehicle_id = ? AND is_active = 1 LIMIT 1`,
        [rows[0].route_id, vehicleId]
      );
      if (tollRows.length) result.toll = tollRows[0];

      // Auto-fetch tax row for this route — return only non-null columns
      // Tamil Nadu (tamil_nadu_tax) is intentionally excluded from auto-fill
      const [taxRows] = await db.query(
        `SELECT * FROM route_tax_master WHERE route_id = ? AND vehicle_id = ? AND is_active = 1 LIMIT 1`,
        [rows[0].route_id, vehicleId]
      );
      if (taxRows.length) {
        const taxRow = taxRows[0];
        result.taxes = STATE_TAX_COLUMNS
          .filter(col => col !== "tamil_nadu_tax" && taxRow[col] != null)
          .map(col => ({
            col,
            label: col.replace(/_tax$/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            amount: taxRow[col],
          }));
      }

      // ── Driver-Route auto-fill via route_id ──────────────────────
      const [drRows] = await db.query(
        `SELECT driver_route_id, driver_payment, return_fare, additional_payment
         FROM driver_route_master WHERE route_id = ? AND is_active = 1 LIMIT 1`,
        [rows[0].route_id]
      );
      if (drRows.length) result.driver_route = drRows[0];
    }
  }

  return result;
};

/* ================================================================
   APPROVE PENDING SHIPMENT -> APPROVAL & Create Masters
   ================================================================ */
export const approveShipment = async (shipmentId, payload) => {
  const { route, vehicle, route_tax, route_toll, fuel_entries, driver, driver_route } = payload;

  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipment WHERE shipment_id = ? AND approval_status = 'PENDING'`,
    [shipmentId]
  );
  if (!shipment) return null;

  // ── 1. Route ────────────────────────────────────────────────────
  const [existingRoutes] = await db.query(
    `SELECT route_id FROM route_master
     WHERE dispatch_plant = ? AND delivery_location = ? AND dealer_name = ? AND is_active = 1 LIMIT 1`,
    [route.dispatch_plant, route.delivery_location, route.dealer_name]
  );

  let routeId;
  if (existingRoutes.length > 0) {
    routeId = existingRoutes[0].route_id;
    await db.query(
      `UPDATE route_master SET km = COALESCE(km, ?), state = COALESCE(state, ?) WHERE route_id = ?`,
      [route.km || null, route.state || null, routeId]
    );
  } else {
    const [res] = await db.query(
      `INSERT INTO route_master (dispatch_plant, delivery_location, state, dealer_name, km, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [route.dispatch_plant, route.delivery_location, route.state || null, route.dealer_name, route.km || null]
    );
    routeId = res.insertId;
  }

  // ── 2. Vehicle ──────────────────────────────────────────────────
  const [existingVehicles] = await db.query(
    `SELECT vehicle_id FROM vehicle_master WHERE material_no = ? AND is_active = 1 LIMIT 1`,
    [vehicle.material_no]
  );

  let vehicleId;
  if (existingVehicles.length > 0) {
    vehicleId = existingVehicles[0].vehicle_id;
  } else {
    const [res] = await db.query(
      `INSERT INTO vehicle_master (material_no, model, avg, is_active) VALUES (?, ?, ?, 1)`,
      [vehicle.material_no, vehicle.model || null, vehicle.avg || null]
    );
    vehicleId = res.insertId;
  }

  // ── 3. DRIVER MASTER UPSERT ───────────────────────────
let driverId = null;

if (driver?.dl_number) {
  const [existingDriver] = await db.query(
    `SELECT driver_id FROM driver_master WHERE driver_dl = ? LIMIT 1`,
    [driver.dl_number]
  );

  if (existingDriver.length > 0) {
    driverId = existingDriver[0].driver_id;
  } else {
    const [res] = await db.query(
      `INSERT INTO driver_master (driver_name, driver_dl, is_active)
       VALUES (?, ?, 1)`,
      [driver.name, driver.dl_number]
    );
    driverId = res.insertId;
  }
}

// ── 4. DRIVER ROUTE UPSERT (BASED ON ROUTE) ───────────
let driverRouteId = null;

if (routeId && driver_route) {
  const [existingDR] = await db.query(
    `SELECT driver_route_id FROM driver_route_master
     WHERE route_id = ? LIMIT 1`,
    [routeId]
  );

  if (existingDR.length > 0) {
    driverRouteId = existingDR[0].driver_route_id;

    // Optional: update values if needed
    await db.query(
      `UPDATE driver_route_master
       SET driver_id = ?, driver_payment = ?, return_fare = ?, additional_payment = ?
       WHERE driver_route_id = ?`,
      [
        driverId,
        driver_route.driver_payment,
        driver_route.return_fare,
        driver_route.additional_payment || 0,
        driverRouteId
      ]
    );

  } else {
    const [res] = await db.query(
      `INSERT INTO driver_route_master
       (route_id, driver_id, driver_payment, return_fare, additional_payment, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        routeId,
        driverId,
        driver_route.driver_payment,
        driver_route.return_fare,
        driver_route.additional_payment || 0
      ]
    );

    driverRouteId = res.insertId;
  }
}

  // ── 5. Route Toll ───────────────────────────────────────────────
  if (route_toll && (route_toll.manual_toll_fix_toll || route_toll.toll_amount)) {
    const [existing] = await db.query(
      `SELECT route_toll_id FROM route_toll_master WHERE route_id = ? AND vehicle_id = ? LIMIT 1`,
      [routeId, vehicleId]
    );
    if (existing.length > 0) {
      await db.query(
        `UPDATE route_toll_master
         SET manual_toll_fix_toll = ?, toll_amount = ?
         WHERE route_toll_id = ?`,
        [route_toll.manual_toll_fix_toll || null, route_toll.toll_amount || null, existing[0].route_toll_id]
      );
    } else {
      await db.query(
        `INSERT INTO route_toll_master (route_id, vehicle_id, manual_toll_fix_toll, toll_amount, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [routeId, vehicleId, route_toll.manual_toll_fix_toll || null, route_toll.toll_amount || null]
      );
    }
  }

  // ── 6. Route Tax ────────────────────────────────────────────────
  // route_tax is an object like { andhra_pradesh_tax: 500, karnataka_tax: 300 }
  if (route_tax && Object.keys(route_tax).length > 0) {
    const validCols = Object.keys(route_tax).filter(col => STATE_TAX_COLUMNS.includes(col));
    if (validCols.length > 0) {
      const [existing] = await db.query(
        `SELECT route_tax_id FROM route_tax_master WHERE route_id = ? AND vehicle_id = ? LIMIT 1`,
        [routeId, vehicleId]
      );
      if (existing.length > 0) {
        const setClauses = validCols.map(col => `${col} = ?`).join(", ");
        const vals = validCols.map(col => route_tax[col]);
        await db.query(
          `UPDATE route_tax_master SET ${setClauses} WHERE route_tax_id = ?`,
          [...vals, existing[0].route_tax_id]
        );
      } else {
        const cols = ["route_id", "vehicle_id", "is_active", ...validCols].join(", ");
        const placeholders = ["?", "?", "1", ...validCols.map(() => "?")].join(", ");
        const vals = [routeId, vehicleId, ...validCols.map(col => route_tax[col])];
        await db.query(
          `INSERT INTO route_tax_master (${cols}) VALUES (${placeholders})`,
          vals
        );
      }
    }
  }

  // ── 7. Update shipment ──────────────────────────────────────────
  await db.query(
    `UPDATE shipment SET
      route_id                  = ?,
      vehicle_id                = ?,  
      driver_route_id           = ?,
      approval_status           = 'APPROVAL'
    WHERE shipment_id = ?`,
    [routeId, vehicleId, driverRouteId, shipmentId]
  );
  
  // ── 8. Process fuel ─────────────────────────────────────────────
  if (Array.isArray(fuel_entries)) {
    await replaceFuelEntries(shipmentId, fuel_entries);
  }

  return { routeId, vehicleId, driverRouteId };
};

/* ================================================================
   ADMIN APPROVE SHIPMENT (APPROVAL -> HOLD)
   ================================================================ */
export const adminApproveShipment = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipment WHERE shipment_id = ? AND approval_status = 'APPROVAL'`,
    [shipmentId]
  );
  if (!shipment) return false;
  await db.query(`UPDATE shipment SET approval_status = 'HOLD' WHERE shipment_id = ?`, [shipmentId]);
  return true;
};

/* ================================================================
   REJECT SHIPMENT
   ================================================================ */
export const rejectShipment = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipment WHERE shipment_id = ? AND approval_status = 'APPROVAL'`,
    [shipmentId]
  );
  if (!shipment) return false;
  await db.query(`UPDATE shipment SET approval_status = 'REJECTED' WHERE shipment_id = ?`, [shipmentId]);
  return true;
};

/* ================================================================
   PENDING SHIPMENTS
   ================================================================ */
export const getPendingShipments = async ({ plantCode } = {}) => {
  let sql   = `SELECT * FROM shipment WHERE approval_status = 'PENDING'`;
  const params = [];
  if (plantCode) { sql += ` AND plant_code = ?`; params.push(plantCode); }
  sql += ` ORDER BY created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ================================================================
   APPROVAL SHIPMENTS (For Admin)
   ================================================================ */
export const getApprovalShipments = async ({ plantCode } = {}) => {
  let sql = `
    SELECT s.*,
      r.dispatch_plant, r.delivery_location, r.km, r.dealer_name, r.state,
      v.material_no, v.model, v.avg
    FROM shipment s
    LEFT JOIN route_master r   ON r.route_id   = s.route_id
    LEFT JOIN vehicle_master v ON v.vehicle_id = s.vehicle_id
    WHERE s.approval_status = 'APPROVAL'`;
  const params = [];
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` ORDER BY s.created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ================================================================
   LOOKUPS
   ================================================================ */
export const getRouteByLocations = async (dispatch, delivery, dealer) => {
  const [rows] = await db.query(
    `SELECT route_id, km FROM route_master
     WHERE dispatch_plant = ? AND delivery_location = ? AND dealer_name = ? AND is_active = 1 LIMIT 1`,
    [dispatch, delivery, dealer]
  );
  return rows[0];
};

export const getVehicleById = async (vehicleId) => {
  const [rows] = await db.query(
    `SELECT vehicle_id, avg FROM vehicle_master WHERE vehicle_id = ? AND is_active = 1`,
    [vehicleId]
  );
  return rows[0];
};

export const getDriverRouteById = async (driverRouteId, routeId) => {
  const [rows] = await db.query(
    `SELECT driver_route_id FROM driver_route_master
     WHERE driver_route_id = ? AND route_id = ? AND is_active = 1`,
    [driverRouteId, routeId]
  );
  return rows[0];
};

/* ================================================================
   LIST SHIPMENTS
   ================================================================ */
export const getShipments = async ({ status, approval, plantCode } = {}) => {
  let sql = `
    SELECT
      s.shipment_id, s.shipment_no, s.current_status, s.approval_status,
      s.shipment_date, s.billing_doc_number, s.billing_date,
      s.chassis_no, s.engine_no, s.allocation_date, s.dispatch_date,
      s.estimated_delivery_date, s.delivery_date, s.reason_for_delay,
      s.communicate_to_alcop,
      (SELECT COALESCE(SUM(amount),0) FROM shipment_fuel_entries WHERE shipment_id = s.shipment_id) AS fuel_total,
      r.dispatch_plant, r.delivery_location, r.km, r.dealer_name, r.state,
      v.material_no, v.model, v.avg,
      dm.driver_name, dm.driver_dl,
      dr.driver_route_id, dr.driver_payment, dr.return_fare,
      rt.manual_toll_fix_toll, rt.toll_amount,
      rtax.route_tax_id
    FROM shipment s
    LEFT JOIN route_master r          ON r.route_id          = s.route_id
    LEFT JOIN vehicle_master v        ON v.vehicle_id        = s.vehicle_id
    LEFT JOIN driver_route_master dr  ON dr.driver_route_id  = s.driver_route_id
    LEFT JOIN driver_master dm        ON dm.driver_id        = dr.driver_id
    LEFT JOIN route_toll_master rt    ON rt.route_id         = s.route_id AND rt.vehicle_id = s.vehicle_id AND rt.is_active = 1
    LEFT JOIN route_tax_master rtax   ON rtax.route_id       = s.route_id AND rtax.vehicle_id = s.vehicle_id AND rtax.is_active = 1
    WHERE s.is_active = 1 AND s.approval_status IN ('ACTIVE', 'HOLD')
  `;
  const params = [];
  if (approval)   { sql += " AND s.approval_status = ?"; params.push(approval); }
  if (status)     { sql += " AND s.current_status = ?";  params.push(status); }
  if (plantCode)  { sql += " AND s.plant_code = ?";      params.push(plantCode); }
  sql += " ORDER BY s.created_at DESC";
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ================================================================
   GET SINGLE SHIPMENT (for View page)
   ================================================================ */
export const getShipmentById = async (shipmentId) => {
  const [rows] = await db.query(
    `SELECT
      s.shipment_id, s.shipment_no, s.plant_code, s.current_status, s.approval_status,
      s.shipment_date, s.billing_doc_number, s.billing_date,
      s.chassis_no, s.engine_no, s.allocation_date, s.dispatch_date,
      s.estimated_delivery_date, s.delivery_date, s.reason_for_delay,
      s.communicate_to_alcop, s.pod_path, s.is_active,
      s.route_id, s.vehicle_id, s.driver_route_id,
      s.raw_dispatch_plant, s.raw_delivery_location, s.raw_state,
      s.raw_dealer_name, s.raw_km,
      s.raw_vehicle_material_no, s.raw_vehicle_model, s.raw_vehicle_avg,
      s.raw_driver_name, s.raw_dl_number,
      s.created_at, s.updated_at,
      r.dispatch_plant, r.delivery_location, r.km, r.dealer_name, r.state,
      v.material_no, v.model, v.avg,
      dm.driver_name, dm.driver_dl,
      dr.driver_payment, dr.return_fare, dr.additional_payment,
      rt.manual_toll_fix_toll, rt.toll_amount,
      rtax.route_tax_id,
      ${STATE_TAX_COLUMNS.map(c => `rtax.${c}`).join(", ")},
      f.payment_status  AS finance_payment_status,
      f.payment_date    AS finance_payment_date,
      f.transaction_slip AS finance_transaction_slip
    FROM shipment s
    LEFT JOIN route_master r          ON r.route_id          = s.route_id
    LEFT JOIN vehicle_master v        ON v.vehicle_id        = s.vehicle_id
    LEFT JOIN driver_route_master dr  ON dr.driver_route_id  = s.driver_route_id
    LEFT JOIN driver_master dm        ON dm.driver_id        = dr.driver_id
    LEFT JOIN route_toll_master rt    ON rt.route_id         = s.route_id AND rt.vehicle_id = s.vehicle_id AND rt.is_active = 1
    LEFT JOIN route_tax_master rtax   ON rtax.route_id       = s.route_id AND rtax.vehicle_id = s.vehicle_id AND rtax.is_active = 1
    LEFT JOIN finance f               ON f.shipment_id       = s.shipment_id
    WHERE s.shipment_id = ?
    LIMIT 1`,
    [shipmentId]
  );
  if (!rows[0]) return null;

  // Attach fuel entries from normalized table
  const fuelEntries = await getFuelEntries(shipmentId);
  const fuelTotal = fuelEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return { ...rows[0], fuel_entries: fuelEntries, fuel_total: fuelTotal };
};

/* ================================================================
   UPDATE SHIPMENT (for View/Edit page)
   ================================================================ */
export const updateShipment = async (shipmentId, data) => {
  await db.query(
    `UPDATE shipment SET
      current_status          = ?,
      dispatch_date           = ?,
      delivery_date           = ?,
      estimated_delivery_date = ?,
      reason_for_delay        = ?,
      communicate_to_alcop    = ?
    WHERE shipment_id = ?`,
    [
      data.current_status,
      data.dispatch_date           || null,
      data.delivery_date           || null,
      data.estimated_delivery_date || null,
      data.reason_for_delay        || null,
      data.communicate_to_alcop    || null,
      shipmentId,
    ]
  );

  // Replace fuel entries with new normalized rows
  if (Array.isArray(data.fuel_entries)) {
    await replaceFuelEntries(shipmentId, data.fuel_entries);
  }

  // Update toll if provided
  if (data.toll && data.route_id && data.vehicle_id) {
    const [existing] = await db.query(
      `SELECT route_toll_id FROM route_toll_master WHERE route_id = ? AND vehicle_id = ? LIMIT 1`,
      [data.route_id, data.vehicle_id]
    );
    if (existing.length > 0) {
      await db.query(
        `UPDATE route_toll_master SET manual_toll_fix_toll = ?, toll_amount = ? WHERE route_toll_id = ?`,
        [data.toll.manual_toll_fix_toll || null, data.toll.toll_amount || null, existing[0].route_toll_id]
      );
    }
  }

  // Update tax if provided
  if (data.tax && data.route_id && data.vehicle_id) {
    const validCols = Object.keys(data.tax).filter(col => STATE_TAX_COLUMNS.includes(col));
    if (validCols.length > 0) {
      const [existing] = await db.query(
        `SELECT route_tax_id FROM route_tax_master WHERE route_id = ? AND vehicle_id = ? LIMIT 1`,
        [data.route_id, data.vehicle_id]
      );
      if (existing.length > 0) {
        const setClauses = validCols.map(col => `${col} = ?`).join(", ");
        await db.query(
          `UPDATE route_tax_master SET ${setClauses} WHERE route_tax_id = ?`,
          [...validCols.map(col => data.tax[col]), existing[0].route_tax_id]
        );
      }
    }
  }

  return true;
};

/* ================================================================
   INSERT SHIPMENT
   ================================================================ */
export const insertShipment = async (data) => {
  const [result] = await db.query(
    `INSERT INTO shipment (
      shipment_no, plant_code, shipment_date, billing_doc_number, billing_date,
      chassis_no, engine_no, allocation_date, dispatch_date,
      estimated_delivery_date, delivery_date, current_status,
      route_id, vehicle_id, driver_route_id,
      raw_dispatch_plant, raw_delivery_location, raw_state, raw_dealer_name, raw_km,
      raw_vehicle_material_no, raw_vehicle_model, raw_vehicle_avg,
      raw_driver_name, raw_dl_number, approval_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      data.shipment_no, data.plant_code || null,
      data.shipment_date, data.billing_doc_number, data.billing_date,
      data.chassis_no, data.engine_no, data.allocation_date, data.dispatch_date,
      data.estimated_delivery_date, data.delivery_date, data.current_status,
      data.route_id, data.vehicle_id, data.driver_route_id,
      data.raw_dispatch_plant, data.raw_delivery_location, data.raw_state,
      data.raw_dealer_name, data.raw_km,
      data.raw_vehicle_material_no, data.raw_vehicle_model, data.raw_vehicle_avg,
      data.raw_driver_name, data.raw_dl_number, data.approval_status,
    ]
  );
  const shipmentId = result.insertId;

  // Insert fuel entries into normalized table
  if (Array.isArray(data.fuel_entries) && data.fuel_entries.length) {
    await replaceFuelEntries(shipmentId, data.fuel_entries);
  }

  return shipmentId;
};

/* ================================================================
   UPDATE POD PATH
   ================================================================ */
export const updatePodPath = async (shipmentId, podPath) => {
  await db.query(
    `UPDATE shipment SET pod_path = ? WHERE shipment_id = ?`,
    [podPath, shipmentId]
  );
};


/* ================================================================
   TRACKING — list ACTIVE shipments for tracking page
   ================================================================ */
export const getTrackingShipments = async ({ plantCode } = {}) => {
  let sql = `
    SELECT
      s.shipment_id, s.shipment_no, s.billing_doc_number,
      DATE_FORMAT(s.estimated_delivery_date, '%Y-%m-%d') AS estimated_delivery_date,
      DATE_FORMAT(s.delivery_date,           '%Y-%m-%d') AS delivery_date,
      DATE_FORMAT(s.dispatch_date,           '%Y-%m-%d') AS dispatch_date,
      s.current_status, s.approval_status,
      s.pod_path, s.plant_code,
      r.dispatch_plant, r.delivery_location, r.dealer_name,
      v.material_no, v.model
    FROM shipment s
    LEFT JOIN route_master r   ON r.route_id   = s.route_id
    LEFT JOIN vehicle_master v ON v.vehicle_id = s.vehicle_id
    WHERE s.is_active = 1
      AND s.approval_status = 'ACTIVE'
  `;
  const params = [];
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` ORDER BY s.dispatch_date DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ================================================================
   UPDATE TRACKING STATUS
   - Any role can update status on ACTIVE shipments
   - Delivered: sets delivery_date to today, requires POD (handled in controller)
   - After Delivered: only admin can make further changes (enforced in controller)
   ================================================================ */
export const updateTrackingStatus = async (shipmentId, { status, deliveryDate }) => {
  const [[shipment]] = await db.query(
    `SELECT shipment_id, current_status, approval_status
     FROM shipment WHERE shipment_id = ? AND is_active = 1`,
    [shipmentId]
  );
  if (!shipment) return { ok: false, error: "Shipment not found" };
  if (shipment.approval_status !== "ACTIVE")
    return { ok: false, error: "Only ACTIVE shipments can be tracked" };

  const params = [status];
  let sql = `UPDATE shipment SET current_status = ?`;

  if (status === "Delivered") {
    sql += `, delivery_date = ?`;
    params.push(deliveryDate || new Date().toISOString().slice(0, 10));
  }

  sql += ` WHERE shipment_id = ?`;
  params.push(shipmentId);

  await db.query(sql, params);
  return { ok: true };
};

/* ================================================================
   SEARCH DRIVER BY DL NUMBER
   ================================================================ */
export const searchDriverByDL = async (dlNumber) => {
  const [rows] = await db.query(
    `SELECT driver_id, driver_name, driver_dl
     FROM driver_master
     WHERE driver_dl = ? AND is_active = 1 LIMIT 1`,
    [dlNumber.trim()]
  );
  return rows[0] || null;
};

/* ================================================================
   GENERATE FUND REQUEST
   Validates all required fields then sets approval_status = ACTIVE.
   Saves driver to driver_master (or reuses existing),  then links
   driver_route_id from driver_route_master.route_id.
   ================================================================ */
export const generateFundRequest = async (shipmentId) => {
  // Fetch shipment + joined data needed for validation
  const [[shipment]] = await db.query(
    `SELECT s.*,
            rt.manual_toll_fix_toll, rt.toll_amount,
            rtax.route_tax_id
     FROM shipment s
     LEFT JOIN route_master r         ON r.route_id  = s.route_id
     LEFT JOIN route_toll_master rt   ON rt.route_id = s.route_id AND rt.vehicle_id = s.vehicle_id AND rt.is_active = 1
     LEFT JOIN route_tax_master rtax  ON rtax.route_id = s.route_id AND rtax.vehicle_id = s.vehicle_id AND rtax.is_active = 1
     WHERE s.shipment_id = ? AND s.approval_status = 'HOLD'`,
    [shipmentId]
  );

  if (!shipment) return { ok: false, missing: [], error: "Shipment not found or not in HOLD status" };

  // ── Validate: only driver expenses required (driver details optional) ──
  const missing = [];

  // Fuel — check fuel entries table
  const fuelTotal = await getFuelTotal(shipmentId);
  if (fuelTotal <= 0) missing.push("Fuel (at least one fuel entry with qty + rate)");

  // Toll
  const hasToll = Number(shipment.manual_toll_fix_toll) > 0 || Number(shipment.toll_amount) > 0;
  if (!hasToll) missing.push("Toll (Manual Fix Toll or Toll Amount)");

  // Tax — at least one state tax row must exist
  if (!shipment.route_tax_id) missing.push("State Tax (at least one state)");

  if (missing.length > 0) return { ok: false, missing };

  // ── Resolve driver_route_id via route_id ────────────────────────
  let driverRouteId = shipment.driver_route_id;
  if (!driverRouteId && shipment.route_id) {
    const [[dr]] = await db.query(
      `SELECT driver_route_id FROM driver_route_master
       WHERE route_id = ? AND is_active = 1 LIMIT 1`,
      [shipment.route_id]
    );
    if (dr) driverRouteId = dr.driver_route_id;
  }

  // ── Activate shipment ─────────────────────────────────────────
  await db.query(
    `UPDATE shipment SET approval_status = 'ACTIVE', driver_route_id = ? WHERE shipment_id = ?`,
    [driverRouteId || null, shipmentId]
  );

  // ── Compute base total and upsert finance record ──────────────
  const tollTotal = Number(shipment.manual_toll_fix_toll || 0) + Number(shipment.toll_amount || 0);

  const [[taxRow]] = await db.query(
    `SELECT * FROM route_tax_master WHERE route_id = ? AND is_active = 1 LIMIT 1`,
    [shipment.route_id]
  ).catch(() => [[null]]);

  const taxTotal    = taxRow ? STATE_TAX_COLUMNS.reduce((sum, col) => sum + Number(taxRow[col] || 0), 0) : 0;
  const driverTotal = Number(shipment.driver_payment || 0) + Number(shipment.return_fare || 0);
  const baseTotal   = fuelTotal + tollTotal + taxTotal + driverTotal;

  await upsertFinanceRecord(shipmentId, shipment.shipment_no, baseTotal);

  return { ok: true };
};

/* ================================================================
   ACTIVE SHIPMENTS (with finance/fund tracking data)
   ================================================================ */
export const getActiveShipments = async ({ plantCode, from, to } = {}) => {
  let sql = `
    SELECT
      s.shipment_id, s.shipment_no, s.plant_code,
      s.current_status, s.approval_status,
      s.shipment_date, s.billing_doc_number, s.chassis_no,
      s.dispatch_date, s.delivery_date,
      r.dispatch_plant, r.delivery_location, r.km, r.dealer_name, r.state,
      v.material_no, v.model,
      f.id              AS finance_id,
      f.base_total,
      f.grand_total,
      f.payment_status  AS finance_payment_status,
      f.payment_date    AS finance_payment_date,
      f.transaction_slip
    FROM shipment s
    LEFT JOIN route_master r          ON r.route_id   = s.route_id
    LEFT JOIN vehicle_master v        ON v.vehicle_id = s.vehicle_id
    LEFT JOIN finance f               ON f.shipment_id = s.shipment_id
    WHERE s.approval_status = 'ACTIVE'
  `;
  const params = [];
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  if (from)      { sql += ` AND DATE(s.dispatch_date) >= ?`; params.push(from); }
  if (to)        { sql += ` AND DATE(s.dispatch_date) <= ?`; params.push(to); }
  sql += ` ORDER BY s.dispatch_date DESC, s.created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ================================================================
   REJECTED SHIPMENTS
   ================================================================ */
export const getRejectedShipments = async ({ plantCode } = {}) => {
  let sql   = `SELECT * FROM shipment WHERE approval_status = 'REJECTED'`;
  const params = [];
  if (plantCode) { sql += ` AND plant_code = ?`; params.push(plantCode); }
  sql += ` ORDER BY created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

export const moveToOperations = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipment WHERE shipment_id = ? AND approval_status = 'REJECTED'`,
    [shipmentId]
  );
  if (!shipment) return false;
  await db.query(
    `UPDATE shipment SET approval_status = 'PENDING' WHERE shipment_id = ?`,
    [shipmentId]
  );
  return true;
};