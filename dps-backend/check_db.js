import { db } from './src/config/database.js';
async function test() {
  const [rows] = await db.query("SHOW COLUMNS FROM shipment LIKE 'approval_status'");
  console.dir(rows, { depth: null });
  process.exit();
}
test();
