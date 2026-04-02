import mysql from "mysql2/promise";
import env from "./env.js";

console.log("🔌 Initializing MySQL pool...");
console.log("DB Host:", env.DB.HOST);
console.log("DB Name:", env.DB.NAME);

export const db = mysql.createPool({
  host: env.DB.HOST,
  user: env.DB.USER,
  password: env.DB.PASSWORD,
  database: env.DB.NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.on("connection", (connection) => {
  connection.query("SET SESSION sql_mode = \'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION\'");
});

(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ MySQL pool connected successfully");
    connection.release();
  } catch (error) {
    console.error("❌ MySQL pool connection failed");
    console.error(error);
    process.exit(1);
  }
})();
