import { db } from "../../config/database.js";

export const getStatuses = async () => {
  const [rows] = await db.query(
    "SELECT status_name FROM status_master WHERE is_active = 1"
  );
  return rows;
};
