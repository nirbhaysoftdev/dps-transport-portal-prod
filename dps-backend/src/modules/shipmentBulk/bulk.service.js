import { db } from "../../config/database.js";

export const resolveMasters = async (row) => {
  const result = {
    route_id: null,
    vehicle_id: null,
    requiresApproval: false,
  };

  // ROUTE
  const [[route]] = await db.query(
    `SELECT route_id, km FROM route_master
     WHERE dispatch_plant=? AND delivery_location=? AND dealer_name=? AND is_active=1`,
    [row.dispatch_plant, row.delivery_location, row.dealer_name]
  );

  if (route) {
    result.route_id = route.route_id;
    result.km = route.km;
  } else {
    result.requiresApproval = true;
  }

  // VEHICLE
  const [[vehicle]] = await db.query(
    `SELECT vehicle_id FROM vehicle_master
     WHERE material_no=? AND is_active=1`,
    [row.material_no]
  );

  if (vehicle) {
    result.vehicle_id = vehicle.vehicle_id;
  } else {
    result.requiresApproval = true;
  }

  return result;
};
