import { db } from './src/config/database.js';
async function run() {
  await db.query("ALTER TABLE shipment MODIFY COLUMN approval_status ENUM('ACTIVE','HOLD','PENDING','APPROVAL','REJECTED') DEFAULT 'ACTIVE'");
  const [rows] = await db.query("SHOW COLUMNS FROM shipment LIKE 'approval_status'");
  console.dir(rows, { depth: null });
  process.exit();
}
run();
