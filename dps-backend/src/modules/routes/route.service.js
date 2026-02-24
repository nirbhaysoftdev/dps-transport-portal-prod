import { db } from "../../config/database.js";

export const getDispatchLocations = async () => {
  const [rows] = await db.query(
    "SELECT DISTINCT dispatch_plant FROM route_master WHERE is_active = 1"
  );
  return rows;
};

export const getDeliveryLocations = async (dispatch) => {
  const [rows] = await db.query(
    `SELECT delivery_location 
     FROM route_master 
     WHERE dispatch_plant = ? AND is_active = 1`,
    [dispatch]
  );
  return rows;
};

export const getRouteDetails = async (dispatch, delivery, dealer) => {
  const [rows] = await db.query(
    `SELECT route_id, km
     FROM route_master
     WHERE dispatch_plant = ?
       AND delivery_location = ?
       AND dealer_name = ?
       AND is_active = 1
     LIMIT 1`,
    [dispatch, delivery, dealer]
  );
  return rows[0];
};

export const getDealersByRoute = async (dispatch, delivery) => {
  const [rows] = await db.query(
    `SELECT DISTINCT dealer_name
     FROM route_master
     WHERE dispatch_plant = ?
       AND delivery_location = ?
       AND dealer_name IS NOT NULL
       AND is_active = 1`,
    [dispatch, delivery]
  );
  return rows;
};

export const getDriverRoutesByRoute = async (route_id) => {
  const [rows] = await db.query(
    `SELECT
       dr.driver_route_id,
       d.driver_name
     FROM driver_route_master dr
     JOIN driver_master d ON d.driver_id = dr.driver_id
     WHERE dr.route_id = ?
       AND dr.is_active = 1`,
    [route_id]
  );
  return rows;
};
