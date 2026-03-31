// finance.service.js
import { db } from "../../config/database.js";

import fs from "fs";
const num = (v) => Number(v) || 0;

/* ════════════════════════════════════════════════════════════════════
   UPSERT — called from generateFundRequest after activation
   Now accepts full expense breakdown for display in Finance page.
════════════════════════════════════════════════════════════════════ */
export const upsertFinanceRecord = async (shipmentId, shipmentNo, baseTotal) => {
  const [[existing]] = await db.query(
    `SELECT id FROM finance WHERE shipment_id = ?`,
    [shipmentId]
  );

  if (!existing) {
    // First time — grand_total = base_total (no extra expenses yet)
    await db.query(
      `INSERT INTO finance (shipment_id, shipment_no, base_total, grand_total)
       VALUES (?, ?, ?, ?)`,
      [shipmentId, shipmentNo, baseTotal, baseTotal]
    );
  } else {
    // Re-compute grand_total preserving any existing extra expenses
    const [[{ extra_sum }]] = await db.query(
      `SELECT COALESCE(SUM(extra_expense), 0) AS extra_sum
       FROM extra_expense WHERE shipment_id = ?`,
      [shipmentId]
    );
    const grandTotal = num(baseTotal) + num(extra_sum);
    await db.query(
      `UPDATE finance SET shipment_no = ?, base_total = ?, grand_total = ?
       WHERE shipment_id = ?`,
      [shipmentNo, baseTotal, grandTotal, shipmentId]
    );
  }
};

/* ── Recalculate grand_total after extra expense add/delete ─────── */
const recalcGrandTotal = async (shipmentId) => {
  const [[fin]] = await db.query(
    `SELECT base_total FROM finance WHERE shipment_id = ?`, [shipmentId]
  );
  if (!fin) return;
  const [[{ extra_sum }]] = await db.query(
    `SELECT COALESCE(SUM(extra_expense), 0) AS extra_sum FROM extra_expense WHERE shipment_id = ?`,
    [shipmentId]
  );
  await db.query(
    `UPDATE finance SET grand_total = ? WHERE shipment_id = ?`,
    [num(fin.base_total) + num(extra_sum), shipmentId]
  );
};

/* ════════════════════════════════════════════════════════════════════
   LIST
════════════════════════════════════════════════════════════════════ */
export const listFinanceRecords = async ({ from, to, status, plantCode } = {}) => {
  let where = `WHERE 1=1`;
  const params = [];

  if (status && status !== "all") { where += ` AND f.payment_status = ?`; params.push(status); }
  if (from) { where += ` AND DATE(s.dispatch_date) >= ?`; params.push(from); }
  if (to)   { where += ` AND DATE(s.dispatch_date) <= ?`; params.push(to); }
  // Branch filter — use plant_code column (authoritative) on shipment table
  if (plantCode) { where += ` AND s.plant_code = ?`; params.push(plantCode); }

  const [rows] = await db.query(
    `SELECT
       f.id,
       f.shipment_id,
       f.shipment_no,
       f.base_total,
       f.grand_total,
       f.payment_status,
       f.payment_date,
       f.transaction_slip,
       f.created_at,
       DATE_FORMAT(s.dispatch_date, '%Y-%m-%d')                        AS dispatch_date,
       s.chassis_no,
       r.dispatch_plant                                                 AS origin,
       r.delivery_location                                              AS destination,
       r.dealer_name,
       r.km                                                             AS distance,
       v.material_no                                                    AS vehicle_no,
       COUNT(e.id)                                                      AS extra_count,
       COALESCE(SUM(e.extra_expense), 0)                               AS extra_total,
       SUM(CASE WHEN e.payment_status='pending' THEN 1 ELSE 0 END)     AS extra_pending_count
     FROM finance f
     JOIN shipment s  ON s.shipment_id = f.shipment_id
     LEFT JOIN route_master r   ON r.route_id  = s.route_id
     LEFT JOIN vehicle_master v ON v.vehicle_id = s.vehicle_id
     LEFT JOIN extra_expense e  ON e.shipment_id = f.shipment_id
     ${where}
     GROUP BY f.id
     ORDER BY s.dispatch_date DESC, f.id DESC`,
    params
  );
  return rows;
};

/* ── Calendar dots ───────────────────────────────────────────────── */
export const calendarSummary = async (year, month, plantCode) => {
  let sql = `
    SELECT
       DATE_FORMAT(s.dispatch_date, '%Y-%m-%d')                        AS date,
       COUNT(f.id)                                                      AS total,
       SUM(CASE WHEN f.payment_status='paid'    THEN 1 ELSE 0 END)     AS paid,
       SUM(CASE WHEN f.payment_status='pending' THEN 1 ELSE 0 END)     AS pending
     FROM finance f
     JOIN shipment s ON s.shipment_id = f.shipment_id
     WHERE YEAR(s.dispatch_date) = ? AND MONTH(s.dispatch_date) = ?`;
  const params = [year, month];
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` GROUP BY DATE_FORMAT(s.dispatch_date, '%Y-%m-%d')`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ── Single detail with extras ───────────────────────────────────── */
export const getFinanceDetail = async (shipmentId) => {
  const [[finance]] = await db.query(
    `SELECT f.*,
            DATE_FORMAT(s.dispatch_date, '%Y-%m-%d') AS dispatch_date,
            s.chassis_no,
            (SELECT COALESCE(SUM(amount),0)
               FROM shipment_fuel_entries
               WHERE shipment_id = s.shipment_id)   AS fuel_total,
            r.dispatch_plant    AS origin,
            r.delivery_location AS destination,
            r.dealer_name,
            r.km                AS distance,
            v.material_no       AS vehicle_no,
            rt.manual_toll_fix_toll, rt.toll_amount,
            dr.driver_payment, dr.return_fare
     FROM finance f
     JOIN shipment s            ON s.shipment_id   = f.shipment_id
     LEFT JOIN route_master r   ON r.route_id      = s.route_id
     LEFT JOIN vehicle_master v ON v.vehicle_id    = s.vehicle_id
     LEFT JOIN route_toll_master rt  ON rt.route_id = s.route_id AND rt.is_active = 1
     LEFT JOIN driver_route_master dr ON dr.driver_route_id = s.driver_route_id
     WHERE f.shipment_id = ?`,
    [shipmentId]
  );
  if (!finance) return null;

  const [extras] = await db.query(
    `SELECT * FROM extra_expense WHERE shipment_id = ? ORDER BY created_at ASC`,
    [shipmentId]
  );

  // Attach fuel entries with pump master data via JOIN
  const [fuelEntries] = await db.query(
    `SELECT
       sfe.id, sfe.entry_type, sfe.pump_id,
       sfe.qty, sfe.rate, sfe.amount,
       ppm.pump_name, ppm.location, ppm.omc, ppm.fuel_category
     FROM shipment_fuel_entries sfe
     LEFT JOIN petrol_pump_master ppm ON ppm.id = sfe.pump_id
     WHERE sfe.shipment_id = ?
     ORDER BY sfe.id ASC`,
    [shipmentId]
  );

  return { ...finance, extras, fuel_entries: fuelEntries };
};

/* ════════════════════════════════════════════════════════════════════
   PAYMENTS
════════════════════════════════════════════════════════════════════ */
export const markFinancePaid = async (shipmentId, slipPath) => {
  const [[fin]] = await db.query(
    `SELECT id, payment_status FROM finance WHERE shipment_id = ?`, [shipmentId]
  );
  if (!fin)                          return { ok: false, error: "Finance record not found" };
  if (fin.payment_status === "paid") return { ok: false, error: "Already paid" };
  if (!slipPath)                     return { ok: false, error: "Transaction slip is required" };

  await db.query(
    `UPDATE finance SET payment_status='paid', payment_date=NOW(), transaction_slip=? WHERE shipment_id=?`,
    [slipPath, shipmentId]
  );
  return { ok: true };
};

export const bulkMarkPaid = async (shipmentIds, slipPath) => {
  if (!slipPath) return { ok: false, error: "Transaction slip required" };
  const ph = shipmentIds.map(() => "?").join(",");
  await db.query(
    `UPDATE finance SET payment_status='paid', payment_date=NOW(), transaction_slip=?
     WHERE shipment_id IN (${ph}) AND payment_status='pending'`,
    [slipPath, ...shipmentIds]
  );
  return { ok: true };
};

/* ════════════════════════════════════════════════════════════════════
   EXTRA EXPENSES  — now includes clause_reason
════════════════════════════════════════════════════════════════════ */
export const addExtraExpense = async (shipmentId, description, clauseReason, amount) => {
  const [[fin]] = await db.query(
    `SELECT shipment_no FROM finance WHERE shipment_id = ?`, [shipmentId]
  );
  if (!fin) return { ok: false, error: "No finance record for this shipment" };

  await db.query(
    `INSERT INTO extra_expense (shipment_id, shipment_no, description, clause_reason, extra_expense)
     VALUES (?, ?, ?, ?, ?)`,
    [shipmentId, fin.shipment_no, description || null, clauseReason || null, Number(amount)]
  );
  await recalcGrandTotal(shipmentId);
  return { ok: true };
};

export const markExtraExpensePaid = async (expenseId, slipPath) => {
  const [[exp]] = await db.query(
    `SELECT id, payment_status FROM extra_expense WHERE id = ?`, [expenseId]
  );
  if (!exp)                          return { ok: false, error: "Expense not found" };
  if (exp.payment_status === "paid") return { ok: false, error: "Already paid" };
  if (!slipPath)                     return { ok: false, error: "Transaction slip required" };

  await db.query(
    `UPDATE extra_expense SET payment_status='paid', payment_date=NOW(), transaction_slip=? WHERE id=?`,
    [slipPath, expenseId]
  );
  return { ok: true };
};

export const deleteExtraExpense = async (expenseId) => {
  const [[exp]] = await db.query(
    `SELECT id, shipment_id FROM extra_expense WHERE id = ?`, [expenseId]
  );
  if (!exp) return false;
  await db.query(`DELETE FROM extra_expense WHERE id = ?`, [expenseId]);
  await recalcGrandTotal(exp.shipment_id);
  return true;
};