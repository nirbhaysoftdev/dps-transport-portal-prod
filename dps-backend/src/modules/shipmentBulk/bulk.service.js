import { db } from "../../config/database.js";

/* ================================================================
   RESOLVE MASTERS
   Only matches route + vehicle.
   Driver is excluded — if route matches, driver_route will be
   resolved at approval time via driver_route_master.route_id.
   ================================================================ */
export const resolveMasters = async (row) => {
  const result = {
    route_id:        null,
    vehicle_id:      null,
    driver_route_id: null,   // always null at upload time
    requiresApproval: false,
  };

  // ── Route ──────────────────────────────────────────────────────
  const [[route]] = await db.query(
    `SELECT route_id, km FROM route_master
     WHERE dispatch_plant = ? AND delivery_location = ? AND dealer_name = ? AND is_active = 1
     LIMIT 1`,
    [row.dispatch_plant, row.delivery_location, row.dealer_name]
  );

  if (route) {
    result.route_id = route.route_id;
    result.km = route.km;
  } else {
    result.requiresApproval = true;
  }

  // ── Vehicle ────────────────────────────────────────────────────
  const [[vehicle]] = await db.query(
    `SELECT vehicle_id FROM vehicle_master
     WHERE material_no = ? AND is_active = 1
     LIMIT 1`,
    [row.material_no]
  );

  if (vehicle) {
    result.vehicle_id = vehicle.vehicle_id;
  } else {
    result.requiresApproval = true;
  }

  // Note: driver_route_id intentionally left null.
  // When both route and vehicle match, the shipment still goes to
  // PENDING so an admin can assign a driver via the approval form.
  // Only mark ACTIVE when route + vehicle are both found AND
  // a driver_route exists for this route.
  if (!result.requiresApproval && result.route_id) {
    const [[dr]] = await db.query(
      `SELECT driver_route_id FROM driver_route_master
       WHERE route_id = ? AND is_active = 1 LIMIT 1`,
      [result.route_id]
    );
    if (dr) {
      result.driver_route_id = dr.driver_route_id;
    } else {
      // Route + vehicle found but no driver assigned yet → still needs approval
      result.requiresApproval = true;
    }
  }

  return result;
};