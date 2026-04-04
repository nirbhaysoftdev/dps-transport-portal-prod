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

/* ── 10. Fuel / petrol pump stats ───────────────────────────────── */
const TAX_COLS = [
  "ts_armed_forces_tax","andhra_pradesh_tax","arunachal_pradesh_tax","assam_tax",
  "bihar_tax","chhattisgarh_tax","delhi_tax","goa_tax","gujarat_tax","haryana_tax",
  "himachal_pradesh_tax","jharkhand_tax","karnataka_tax","kerala_tax",
  "madhya_pradesh_tax","maharashtra_tax","manipur_tax","meghalaya_tax",
  "mizoram_tax","nagaland_tax","odisha_tax","punjab_tax","rajasthan_tax",
  "sikkim_tax","tamil_nadu_tax","telangana_tax","tripura_tax",
  "uttar_pradesh_tax","uttarakhand_tax","west_bengal_tax",
];

export const getFuelStats = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COALESCE(SUM(fe.qty * fe.rate),0) AS total_sales,
                    COUNT(DISTINCT NULLIF(fe.pump_id,'')) AS pump_count
             FROM shipment_fuel_entries fe
             JOIN shipment s ON s.shipment_id = fe.shipment_id
             WHERE s.is_active = 1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { total_sales: Number(row.total_sales), pump_count: Number(row.pump_count) };
};

export const getTopPumps = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT fe.pump_id,
                    COALESCE(SUM(fe.qty * fe.rate),0) AS total_sales,
                    COALESCE(SUM(fe.qty),0) AS total_qty
             FROM shipment_fuel_entries fe
             JOIN shipment s ON s.shipment_id = fe.shipment_id
             WHERE s.is_active = 1 AND fe.pump_id IS NOT NULL AND fe.pump_id != '' ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` GROUP BY fe.pump_id ORDER BY total_sales DESC LIMIT 5`;
  const [rows] = await db.query(sql, params);
  return rows;
};

export const getTollStats = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COALESCE(SUM(
               CASE WHEN rtm.manual_toll_fix_toll > 0
                    THEN rtm.manual_toll_fix_toll
                    ELSE COALESCE(rtm.toll_amount, 0) END
             ), 0) AS total_toll
             FROM shipment s
             LEFT JOIN route_toll_master rtm ON rtm.route_id = s.route_id AND rtm.vehicle_id = s.vehicle_id
             WHERE s.is_active = 1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { total_toll: Number(row.total_toll) };
};

export const getTaxStats = async ({ from, to, plantCode } = {}) => {
  const sumExpr = TAX_COLS.map(c => `COALESCE(rtx.${c}, 0)`).join(" + ");
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT COALESCE(SUM(${sumExpr}), 0) AS total_tax
             FROM shipment s
             LEFT JOIN route_tax_master rtx ON rtx.route_id = s.route_id AND rtx.vehicle_id = s.vehicle_id
             WHERE s.is_active = 1 ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  const [[row]] = await db.query(sql, params);
  return { total_tax: Number(row.total_tax) };
};

export const getPlantMapData = async ({ from, to, plantCode } = {}) => {
  const { clause, params } = buildDateFilter("s", from, to);
  let sql = `SELECT
               s.raw_dispatch_plant AS plant,
               COUNT(*) AS total,
               SUM(CASE WHEN s.current_status = 'Delivered' THEN 1 ELSE 0 END) AS delivered,
               SUM(CASE WHEN s.current_status != 'Delivered' THEN 1 ELSE 0 END) AS undelivered,
               SUM(CASE WHEN s.current_status IN ('In Transit','Running') THEN 1 ELSE 0 END) AS running,
               SUM(CASE WHEN s.approval_status IN ('ACTIVE','HOLD') THEN 1 ELSE 0 END) AS dispatched
             FROM shipment s
             WHERE s.is_active = 1 AND s.raw_dispatch_plant IS NOT NULL ${clause}`;
  if (plantCode) { sql += ` AND s.plant_code = ?`; params.push(plantCode); }
  sql += ` GROUP BY s.raw_dispatch_plant ORDER BY undelivered DESC`;
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
    fuelStats,
    topPumps,
    tollStats,
    taxStats,
    plantMapData,
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
    getFuelStats({ from, to, plantCode }),
    getTopPumps({ from, to, plantCode }),
    getTollStats({ from, to, plantCode }),
    getTaxStats({ from, to, plantCode }),
    getPlantMapData({ from, to, plantCode }),
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
    fuelStats,
    topPumps,
    tollStats,
    taxStats,
    plantMapData,
  };
};