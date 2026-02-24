import { db } from "../../config/database.js";

/* ------------------------ APPROVE SHIPMENT ------------------------ */
export const approveShipment = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT * FROM shipment WHERE shipment_id = ?`,
    [shipmentId]
  );

  if (!shipment) throw new Error("Shipment not found");

  let routeId = shipment.route_id;
  let vehicleId = shipment.vehicle_id;
  let driverRouteId = shipment.driver_route_id;

  if (!vehicleId) vehicleId = await createVehicleFromShipment(shipment);
  if (!routeId) routeId = await createRouteFromShipment(shipment);
  if (!driverRouteId) {
    const driverId = await createDriverFromShipment(shipment);
    driverRouteId = await createDriverRoute(driverId, routeId);
  }

  await db.query(
    `UPDATE shipment SET route_id = ?, vehicle_id = ?, driver_route_id = ?, approval_status = 'ACTIVE' WHERE shipment_id = ?`,
    [routeId, vehicleId, driverRouteId, shipmentId]
  );

  return true;
};

/* ------------------------ REJECT SHIPMENT ------------------------ */
export const rejectShipment = async (shipmentId) => {
  const [[shipment]] = await db.query(
    `SELECT * FROM shipment WHERE shipment_id = ? AND approval_status = 'PENDING'`,
    [shipmentId]
  );

  if (!shipment) return false;

  await db.query(
    `UPDATE shipment SET approval_status = 'REJECTED' WHERE shipment_id = ?`,
    [shipmentId]
  );

  return true;
};

/* ------------------------ PENDING SHIPMENTS ------------------------ */
export const getPendingShipments = async () => {
  const [rows] = await db.query(
    `SELECT * FROM shipment WHERE approval_status = 'PENDING' ORDER BY created_at DESC`
  );
  return rows;
};

/* ------------------------ LOOKUPS ------------------------ */
export const getRouteByLocations = async (dispatch, delivery, dealer) => {
  const [rows] = await db.query(
    `SELECT route_id, km FROM route_master WHERE dispatch_plant = ? AND delivery_location = ? AND dealer_name = ? AND is_active = 1 LIMIT 1`,
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
    `SELECT driver_route_id FROM driver_route_master WHERE driver_route_id = ? AND route_id = ? AND is_active = 1`,
    [driverRouteId, routeId]
  );
  return rows[0];
};

/* ------------------------ CREATE MASTER RECORDS ------------------------ */
export const createVehicleFromShipment = async (shipment) => {
  const [existing] = await db.query(
    `SELECT vehicle_id FROM vehicle_master WHERE material_no = ?
      AND is_active = 1 LIMIT 1`,
    [shipment.raw_vehicle_material_no]
  );

  if (existing.length > 0) {
    return existing[0].vehicle_id;
  }
  const [result] = await db.query(
    `INSERT INTO vehicle_master ( material_no, model, avg, is_active ) VALUES (?, ?, ?, 1)`,
    [
      shipment.raw_vehicle_material_no,
      shipment.raw_vehicle_model || null,
      shipment.raw_vehicle_avg || null,
    ]
  );

  return result.insertId;
};


export const createRouteFromShipment = async (shipment) => {
  /* Check if route already exists */
  const [existing] = await db.query(
    `SELECT route_id FROM route_master WHERE dispatch_plant = ?
      AND delivery_location = ?
      AND dealer_name = ?
      AND is_active = 1
    LIMIT 1`,
    [
      shipment.raw_dispatch_plant,
      shipment.raw_delivery_location,
      shipment.raw_dealer_name,
    ]
  );

  if (existing.length > 0) { return existing[0].route_id; }
  const [result] = await db.query(
    `INSERT INTO route_master (
      dispatch_plant,
      delivery_location,
      dealer_name,
      state,
      km,
      is_active
    ) VALUES (?, ?, ?, ?, ?, 1)`,
    [
      shipment.raw_dispatch_plant,
      shipment.raw_delivery_location,
      shipment.raw_dealer_name,
      shipment.raw_state || null,
      shipment.raw_km || null,
    ]
  );

  return result.insertId;
};


export const createDriverFromShipment = async (shipment) => {
  /* 1️⃣ Check if driver already exists */
  const [existing] = await db.query(
    `
    SELECT driver_id
    FROM driver_master
    WHERE dl_number = ?
      AND is_active = 1
    LIMIT 1
    `,
    [shipment.raw_dl_number]
  );

  if (existing.length > 0) {
    return existing[0].driver_id;
  }
  const [result] = await db.query(
    `
    INSERT INTO driver_master (
      driver_name,
      dl_number,
      is_active
    ) VALUES (?, ?, 1)
    `,
    [
      shipment.raw_driver_name || "UNKNOWN",
      shipment.raw_dl_number,
    ]
  );

  return result.insertId;
};


export const createDriverRoute = async (driverId, routeId) => {
  const [res] = await db.query(
    `INSERT INTO driver_route_master (driver_id, route_id, is_active) VALUES (?, ?, 1)`,
    [driverId, routeId]
  );
  return res.insertId;
};

/* ------------------------ LIST SHIPMENTS ------------------------ */
export const getShipments = async (status) => {
  let sql = `
    SELECT 
      s.shipment_id,
      s.shipment_no,
      s.current_status,
      s.approval_status,
      r.dispatch_plant,
      r.delivery_location,
      r.km,
      r.dealer_name,
      v.material_no,
      dr.driver_route_id
    FROM shipment s
    LEFT JOIN route_master r 
      ON r.route_id = s.route_id
    LEFT JOIN vehicle_master v 
      ON v.vehicle_id = s.vehicle_id
    LEFT JOIN driver_route_master dr 
      ON dr.driver_route_id = s.driver_route_id
    WHERE s.is_active = 1
      AND s.approval_status = 'ACTIVE'
  `;

  const params = [];

  if (status) {
    sql += " AND s.current_status = ?";
    params.push(status);
  }

  sql += " ORDER BY s.created_at DESC";

  const [rows] = await db.query(sql, params);
  return rows;
};

/* ------------------------ INSERT SHIPMENT ------------------------ */
export const insertShipment = async (data) => {
  const [result] = await db.query(
    `
    INSERT INTO shipment (
      shipment_no, shipment_date, billing_doc_number, billing_date, chassis_no, engine_no, allocation_date, dispatch_date,
      estimated_delivery_date, delivery_date, current_status, route_id, vehicle_id, driver_route_id,
      raw_dispatch_plant, raw_delivery_location, raw_state, raw_dealer_name, raw_km,
      raw_vehicle_material_no, raw_vehicle_model, raw_vehicle_avg,
      raw_driver_name, raw_dl_number, approval_status,
      pump1_qty, pump1_rate, pump2_qty, pump2_rate, pump3_qty, pump3_rate, pump4_qty, pump4_rate,
      fuel_card_qty, fuel_card_rate, hsd_qty, hsd_rate
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    `,
    [
      data.shipment_no, data.shipment_date, data.billing_doc_number, data.billing_date, data.chassis_no, data.engine_no,
      data.allocation_date, data.dispatch_date, data.estimated_delivery_date, data.delivery_date, data.current_status,
      data.route_id, data.vehicle_id, data.driver_route_id,
      data.raw_dispatch_plant, data.raw_delivery_location, data.raw_state, data.raw_dealer_name, data.raw_km,
      data.raw_vehicle_material_no, data.raw_vehicle_model, data.raw_vehicle_avg,
      data.raw_driver_name, data.raw_dl_number, data.approval_status,
      data.pump1_qty, data.pump1_rate, data.pump2_qty, data.pump2_rate, data.pump3_qty, data.pump3_rate, data.pump4_qty, data.pump4_rate,
      data.fuel_card_qty, data.fuel_card_rate, data.hsd_qty, data.hsd_rate
    ]
  );
  return result.insertId;
};
