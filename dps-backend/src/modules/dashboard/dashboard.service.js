// src/modules/dashboard/dashboard.service.js
import { db } from "../../config/database.js";

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD KPI SERVICE
   All functions accept { from, to, plantCode } for filtering
══════════════════════════════════════════════════════════════════ */

const buildDateFilter = (alias, from, to) => {
  let clause = "";
  const params = [];
  if (from) { clause += ` AND DATE(${alias}.dispatch_date) >= ?`; params.push(from); }
  if (to)   { clause += ` AND DATE(${alias}.dispatch_date) <= ?`; params.push(to); }
  return { clause, params };
};

/* ── 1. Total Shipments Created ─────────────────────────────────── */
export const getTotalShipments = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(*) AS total FROM shipment s WHERE s.is_active = 1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return Number(row.total);
};

/* ── 2. Shipments Delivered ─────────────────────────────────────── */
export const getDeliveredShipments = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(*) AS total FROM shipment s
             WHERE s.is_active = 1 AND s.current_status = 'Delivered' ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return Number(row.total);
};

/* ── 3. Pending Shipments (PENDING + APPROVAL) ──────────────────── */
export const getPendingCount = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(*) AS total FROM shipment s
             WHERE s.is_active = 1
               AND s.approval_status IN ('PENDING','APPROVAL') ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return Number(row.total);
};

/* ── 4. Active Shipments (ACTIVE + HOLD) ────────────────────────── */
export const getActiveCount = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(*) AS total FROM shipment s
             WHERE s.is_active = 1
               AND s.approval_status IN ('ACTIVE','HOLD') ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return Number(row.total);
};

/* ── 5. Total Fund Requests (finance records) ───────────────────── */
export const getTotalFundRequests = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(f.id) AS total, COALESCE(SUM(f.grand_total),0) AS amount
             FROM finance f
             JOIN shipment s ON s.shipment_id = f.shipment_id
             WHERE 1=1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { count: Number(row.total), amount: Number(row.amount) };
};

/* ── 6. Pending Funds (payment_status = pending) ────────────────── */
export const getPendingFunds = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(f.id) AS total, COALESCE(SUM(f.grand_total),0) AS amount
             FROM finance f
             JOIN shipment s ON s.shipment_id = f.shipment_id
             WHERE f.payment_status = 'pending' ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { count: Number(row.total), amount: Number(row.amount) };
};

/* ── 7. Paid Funds ──────────────────────────────────────────────── */
export const getPaidFunds = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COUNT(f.id) AS total, COALESCE(SUM(f.grand_total),0) AS amount
             FROM finance f
             JOIN shipment s ON s.shipment_id = f.shipment_id
             WHERE f.payment_status = 'paid' ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { count: Number(row.total), amount: Number(row.amount) };
};

/* ── 8. Shipments by status breakdown ──────────────────────────── */
export const getStatusBreakdown = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT s.approval_status, COUNT(*) AS total
             FROM shipment s
             WHERE s.is_active = 1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` GROUP BY s.approval_status`;
  const [rows] = await db.query(sql, params);
  const map = {};
  rows.forEach(r => { map[r.approval_status] = Number(r.total); });
  return {
    PENDING:  map.PENDING  || 0,
    APPROVAL: map.APPROVAL || 0,
    HOLD:     map.HOLD     || 0,
    ACTIVE:   map.ACTIVE   || 0,
    REJECTED: map.REJECTED || 0,
  };
};

/* ── 9. Monthly shipment trend (last 6 months) ──────────────────── */
export const getMonthlyTrend = async ({ plantCode } = {}) => {
  let sql = `
    SELECT
      DATE_FORMAT(s.dispatch_date, '%b %Y') AS month_label,
      DATE_FORMAT(s.dispatch_date, '%Y-%m') AS month_key,
      COUNT(*) AS total
    FROM shipment s
    WHERE s.is_active = 1
      AND s.dispatch_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
  `;
  const params = [];
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` GROUP BY month_key, month_label ORDER BY month_key ASC`;
  const [rows] = await db.query(sql, params);
  return rows;
};

/* ── MASTER: all KPIs in one call ───────────────────────────────── */
export const getDashboardKPIs = async ({ from, to, plantCode } = {}) => {
  const [
    totalShipments,
    deliveredShipments,
    pendingCount,
    activeCount,
    fundRequests,
    pendingFunds,
    paidFunds,
    statusBreakdown,
    monthlyTrend,
  ] = await Promise.all([
    getTotalShipments({ from, to, plantCode }),
    getDeliveredShipments({ from, to, plantCode }),
    getPendingCount({ from, to, plantCode }),
    getActiveCount({ from, to, plantCode }),
    getTotalFundRequests({ from, to, plantCode }),
    getPendingFunds({ from, to, plantCode }),
    getPaidFunds({ from, to, plantCode }),
    getStatusBreakdown({ from, to, plantCode }),
    getMonthlyTrend({ plantCode }),
  ]);

  return {
    totalShipments,
    deliveredShipments,
    pendingCount,
    activeCount,
    fundRequests,
    pendingFunds,
    paidFunds,
    statusBreakdown,
    monthlyTrend,
  };
};