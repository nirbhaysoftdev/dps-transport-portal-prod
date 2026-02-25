import { db } from "../../config/database.js";

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
export const checkMasters = async ({ dispatch_plant, delivery_location, dealer_name, material_no, dl_number }) => {
  const result = { route: null, vehicle: null, driver: null, toll: null, taxes: [] };

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
         FROM route_toll_master WHERE route_id = ? AND is_active = 1 LIMIT 1`,
        [rows[0].route_id]
      );
      if (tollRows.length) result.toll = tollRows[0];

      // Auto-fetch tax row for this route — return only non-null columns
      const [taxRows] = await db.query(
        `SELECT * FROM route_tax_master WHERE route_id = ? AND is_active = 1 LIMIT 1`,
        [rows[0].route_id]
      );
      if (taxRows.length) {
        const taxRow = taxRows[0];
        result.taxes = STATE_TAX_COLUMNS
          .filter(col => taxRow[col] != null)
          .map(col => ({
            col,
            label: col.replace(/_tax$/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            amount: taxRow[col],
          }));
      }
    }
  }

  // ── Vehicle ────────────────────────────────────────────────────
  if (material_no) {
    const [rows] = await db.query(
      `SELECT vehicle_id, model, avg FROM vehicle_master WHERE material_no = ? AND is_active = 1 LIMIT 1`,
      [material_no]
    );
    if (rows.length) result.vehicle = rows[0];
  }

  // ── Driver ─────────────────────────────────────────────────────
  if (dl_number) {
    const [rows] = await db.query(
      `SELECT driver_id, driver_name, driver_dl FROM driver_master WHERE driver_dl = ? AND is_active = 1 LIMIT 1`,
      [dl_number]
    );
    if (rows.length) result.driver = rows[0];
  }

  return result;
};

/* ================================================================
   APPROVE SHIPMENT
   ================================================================ */
export const approveShipment = async (shipmentId, payload) => {
  const { route, vehicle, driver, driver_route, route_tax, route_toll } = payload;

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

  // ── 3. Driver ───────────────────────────────────────────────────
  let driverId = driver.driver_id || null;

  if (!driverId) {
    // driver_id not provided — look up by DL or insert new
    const [existingDrivers] = await db.query(
      `SELECT driver_id FROM driver_master WHERE driver_dl = ? AND is_active = 1 LIMIT 1`,
      [driver.dl_number]
    );
    if (existingDrivers.length > 0) {
      driverId = existingDrivers[0].driver_id;
    } else {
      const [res] = await db.query(
        `INSERT INTO driver_master (driver_name, driver_dl, is_active) VALUES (?, ?, 1)`,
        [driver.driver_name || "UNKNOWN", driver.dl_number]
      );
      driverId = res.insertId;
    }
  }

  // ── 4. Driver-Route ─────────────────────────────────────────────
  const [existingDriverRoutes] = await db.query(
    `SELECT driver_route_id FROM driver_route_master
     WHERE driver_id = ? AND route_id = ? AND is_active = 1 LIMIT 1`,
    [driverId, routeId]
  );

  let driverRouteId;
  if (existingDriverRoutes.length > 0) {
    driverRouteId = existingDriverRoutes[0].driver_route_id;
  } else {
    const [res] = await db.query(
      `INSERT INTO driver_route_master (driver_id, route_id, driver_payment, return_fare, additional_payment, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [driverId, routeId,
        driver_route?.driver_payment     || null,
        driver_route?.return_fare        || null,
        driver_route?.additional_payment || 0]
    );
    driverRouteId = res.insertId;
  }

  // ── 5. Route Toll ───────────────────────────────────────────────
  if (route_toll && (route_toll.manual_toll_fix_toll || route_toll.toll_amount)) {
    const [existing] = await db.query(
      `SELECT route_toll_id FROM route_toll_master WHERE route_id = ? LIMIT 1`,
      [routeId]
    );
    if (existing.length > 0) {
      await db.query(
        `UPDATE route_toll_master
         SET manual_toll_fix_toll = ?, toll_amount = ?
         WHERE route_id = ?`,
        [route_toll.manual_toll_fix_toll || null, route_toll.toll_amount || null, routeId]
      );
    } else {
      await db.query(
        `INSERT INTO route_toll_master (route_id, manual_toll_fix_toll, toll_amount, is_active)
         VALUES (?, ?, ?, 1)`,
        [routeId, route_toll.manual_toll_fix_toll || null, route_toll.toll_amount || null]
      );
    }
  }

  // ── 6. Route Tax ────────────────────────────────────────────────
  // route_tax is an object like { andhra_pradesh_tax: 500, karnataka_tax: 300 }
  if (route_tax && Object.keys(route_tax).length > 0) {
    const validCols = Object.keys(route_tax).filter(col => STATE_TAX_COLUMNS.includes(col));
    if (validCols.length > 0) {
      const [existing] = await db.query(
        `SELECT route_tax_id FROM route_tax_master WHERE route_id = ? LIMIT 1`,
        [routeId]
      );
      if (existing.length > 0) {
        const setClauses = validCols.map(col => `${col} = ?`).join(", ");
        const vals = validCols.map(col => route_tax[col]);
        await db.query(
          `UPDATE route_tax_master SET ${setClauses} WHERE route_id = ?`,
          [...vals, routeId]
        );
      } else {
        const cols = ["route_id", "is_active", ...validCols].join(", ");
        const placeholders = ["?", "1", ...validCols.map(() => "?")].join(", ");
        const vals = [routeId, ...validCols.map(col => route_tax[col])];
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
      approval_status           = 'ACTIVE',
      raw_dispatch_plant        = NULL,
      raw_delivery_location     = NULL,
      raw_state                 = NULL,
      raw_dealer_name           = NULL,
      raw_km                    = NULL,
      raw_vehicle_material_no   = NULL,
      raw_vehicle_model         = NULL,
      raw_vehicle_avg           = NULL,
      raw_driver_name           = NULL,
      raw_dl_number             = NULL
    WHERE shipment_id = ?`,
    [routeId, vehicleId, driverRouteId, shipmentId]
  );

  return { routeId, vehicleId, driverRouteId, driverId };
};

/* ================================================================
   REJECT SHIPMENT
   ================================================================ */
export const rejectShipment = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT shipment_id FROM shipment WHERE shipment_id = ? AND approval_status = 'PENDING'`,
    [shipmentId]
  );
  if (!shipment) return false;
  await db.query(`UPDATE shipment SET approval_status = 'REJECTED' WHERE shipment_id = ?`, [shipmentId]);
  return true;
};

/* ================================================================
   PENDING SHIPMENTS
   ================================================================ */
export const getPendingShipments = async () => {
  const [rows] = await db.query(
    `SELECT * FROM shipment WHERE approval_status = 'PENDING' ORDER BY created_at DESC`
  );
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
export const getShipments = async (status) => {
  let sql = `
    SELECT
      s.shipment_id, s.shipment_no, s.current_status, s.approval_status,
      s.shipment_date, s.billing_doc_number, s.billing_date,
      s.chassis_no, s.engine_no, s.allocation_date, s.dispatch_date,
      s.estimated_delivery_date, s.delivery_date, s.reason_for_delay,
      s.communicate_to_alcop,
      s.pump1_rate, s.pump1_qty, s.pump2_rate, s.pump2_qty,
      s.pump3_rate, s.pump3_qty, s.pump4_rate, s.pump4_qty,
      s.fuel_card_qty, s.fuel_card_rate, s.hsd_rate, s.hsd_qty,
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
    LEFT JOIN route_toll_master rt    ON rt.route_id         = r.route_id AND rt.is_active = 1
    LEFT JOIN route_tax_master rtax   ON rtax.route_id       = r.route_id AND rtax.is_active = 1
    WHERE s.is_active = 1 AND s.approval_status = 'ACTIVE'
  `;
  const params = [];
  if (status) { sql += " AND s.current_status = ?"; params.push(status); }
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
      s.*,
      r.dispatch_plant, r.delivery_location, r.km, r.dealer_name, r.state,
      v.material_no, v.model, v.avg,
      dm.driver_name, dm.driver_dl,
      dr.driver_payment, dr.return_fare, dr.additional_payment,
      rt.manual_toll_fix_toll, rt.toll_amount,
      rtax.route_tax_id,
      ${STATE_TAX_COLUMNS.map(c => `rtax.${c}`).join(", ")}
    FROM shipment s
    LEFT JOIN route_master r          ON r.route_id          = s.route_id
    LEFT JOIN vehicle_master v        ON v.vehicle_id        = s.vehicle_id
    LEFT JOIN driver_route_master dr  ON dr.driver_route_id  = s.driver_route_id
    LEFT JOIN driver_master dm        ON dm.driver_id        = dr.driver_id
    LEFT JOIN route_toll_master rt    ON rt.route_id         = r.route_id AND rt.is_active = 1
    LEFT JOIN route_tax_master rtax   ON rtax.route_id       = r.route_id AND rtax.is_active = 1
    WHERE s.shipment_id = ? AND s.is_active = 1
    LIMIT 1`,
    [shipmentId]
  );
  return rows[0] || null;
};

/* ================================================================
   UPDATE SHIPMENT (for View/Edit page)
   ================================================================ */
export const updateShipment = async (shipmentId, data) => {
  await db.query(
    `UPDATE shipment SET
      current_status          = ?,
      delivery_date           = ?,
      estimated_delivery_date = ?,
      reason_for_delay        = ?,
      communicate_to_alcop    = ?,
      pump1_rate = ?, pump1_qty = ?,
      pump2_rate = ?, pump2_qty = ?,
      pump3_rate = ?, pump3_qty = ?,
      pump4_rate = ?, pump4_qty = ?,
      fuel_card_qty  = ?, fuel_card_rate  = ?,
      hsd_qty        = ?, hsd_rate        = ?
    WHERE shipment_id = ?`,
    [
      data.current_status, data.delivery_date || null, data.estimated_delivery_date || null,
      data.reason_for_delay || null, data.communicate_to_alcop || null,
      data.pump1_rate || 0, data.pump1_qty || 0,
      data.pump2_rate || 0, data.pump2_qty || 0,
      data.pump3_rate || 0, data.pump3_qty || 0,
      data.pump4_rate || 0, data.pump4_qty || 0,
      data.fuel_card_qty || 0, data.fuel_card_rate || 0,
      data.hsd_qty || 0, data.hsd_rate || 0,
      shipmentId,
    ]
  );

  // Update toll if provided
  if (data.toll && data.route_id) {
    const [existing] = await db.query(
      `SELECT route_toll_id FROM route_toll_master WHERE route_id = ? LIMIT 1`,
      [data.route_id]
    );
    if (existing.length > 0) {
      await db.query(
        `UPDATE route_toll_master SET manual_toll_fix_toll = ?, toll_amount = ? WHERE route_id = ?`,
        [data.toll.manual_toll_fix_toll || null, data.toll.toll_amount || null, data.route_id]
      );
    }
  }

  // Update tax if provided
  if (data.tax && data.route_id) {
    const validCols = Object.keys(data.tax).filter(col => STATE_TAX_COLUMNS.includes(col));
    if (validCols.length > 0) {
      const [existing] = await db.query(
        `SELECT route_tax_id FROM route_tax_master WHERE route_id = ? LIMIT 1`,
        [data.route_id]
      );
      if (existing.length > 0) {
        const setClauses = validCols.map(col => `${col} = ?`).join(", ");
        await db.query(
          `UPDATE route_tax_master SET ${setClauses} WHERE route_id = ?`,
          [...validCols.map(col => data.tax[col]), data.route_id]
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
      shipment_no, shipment_date, billing_doc_number, billing_date,
      chassis_no, engine_no, allocation_date, dispatch_date,
      estimated_delivery_date, delivery_date, current_status,
      route_id, vehicle_id, driver_route_id,
      raw_dispatch_plant, raw_delivery_location, raw_state, raw_dealer_name, raw_km,
      raw_vehicle_material_no, raw_vehicle_model, raw_vehicle_avg,
      raw_driver_name, raw_dl_number, approval_status,
      pump1_qty, pump1_rate, pump2_qty, pump2_rate,
      pump3_qty, pump3_rate, pump4_qty, pump4_rate,
      fuel_card_qty, fuel_card_rate, hsd_qty, hsd_rate
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      data.shipment_no, data.shipment_date, data.billing_doc_number, data.billing_date,
      data.chassis_no, data.engine_no, data.allocation_date, data.dispatch_date,
      data.estimated_delivery_date, data.delivery_date, data.current_status,
      data.route_id, data.vehicle_id, data.driver_route_id,
      data.raw_dispatch_plant, data.raw_delivery_location, data.raw_state,
      data.raw_dealer_name, data.raw_km,
      data.raw_vehicle_material_no, data.raw_vehicle_model, data.raw_vehicle_avg,
      data.raw_driver_name, data.raw_dl_number, data.approval_status,
      data.pump1_qty, data.pump1_rate, data.pump2_qty, data.pump2_rate,
      data.pump3_qty, data.pump3_rate, data.pump4_qty, data.pump4_rate,
      data.fuel_card_qty, data.fuel_card_rate, data.hsd_qty, data.hsd_rate,
    ]
  );
  return result.insertId;
};