import { db } from "../../config/database.js";

export const getVehicles = async () => {
  const [rows] = await db.query(
    "SELECT vehicle_id, model, avg FROM vehicle_master WHERE is_active = 1"
  );
  return rows;
};
