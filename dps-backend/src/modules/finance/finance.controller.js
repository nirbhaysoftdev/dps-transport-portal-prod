// finance.controller.js
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  listFinanceRecords, calendarSummary, getFinanceDetail,
  markFinancePaid, addExtraExpense, markExtraExpensePaid,
  deleteExtraExpense, bulkMarkPaid,
} from "./finance.service.js";

/* ── Multer slip upload ───────────────────────────────────────────── */
const SLIP_DIR = "src/uploads/slips";
if (!fs.existsSync(SLIP_DIR)) fs.mkdirSync(SLIP_DIR, { recursive: true });

export const slipUpload = multer({
  dest: "src/uploads/tmp",
  limits: { fileSize: 420 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only PNG/JPG allowed"));
  },
});

const saveSlip = (tmpPath, originalName) => {
  const ext  = path.extname(originalName).toLowerCase();
  const name = `slip_${Date.now()}${ext}`;
  const dest = path.join(SLIP_DIR, name);
  fs.renameSync(tmpPath, dest);
  return name;
};

/* ── LIST ─────────────────────────────────────────────────────────── */
export const listFinance = async (req, res) => {
  try {
    const { from, to, status } = req.query;

    // For branch role: always scope to their plant (from JWT)
    // For admin/finance: use query param if provided (dropdown selection), else show all
    const plantCode = req.scope?.isBranch
      ? req.scope.plantCode
      : (req.query.plant_code || null);

    const data = await listFinanceRecords({ from, to, status, plantCode });
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /finance:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── CALENDAR SUMMARY ─────────────────────────────────────────────── */
export const getCalendarSummary = async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    // Branch: always their plant. Admin/finance: use dropdown selection if provided
    const plantCode = req.scope?.isBranch
      ? req.scope.plantCode
      : (req.query.plant_code || null);

    const data  = await calendarSummary(year, month, plantCode);
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /finance/calendar:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── DETAIL ───────────────────────────────────────────────────────── */
export const financeDetail = async (req, res) => {
  try {
    const data = await getFinanceDetail(parseInt(req.params.shipmentId));
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    console.error("GET /finance/:shipmentId:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── MARK PAID ────────────────────────────────────────────────────── */
export const payFinance = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Slip required" });
    if (req.file.size > 300 * 1024) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "File too large (max 300 KB)" });
    }
    const slipName = saveSlip(req.file.path, req.file.originalname);
    const result   = await markFinancePaid(parseInt(req.params.shipmentId), slipName);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: "Payment marked as paid", slip: slipName });
  } catch (err) {
    console.error("POST /finance/:shipmentId/pay:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── BULK PAY ─────────────────────────────────────────────────────── */
export const bulkPay = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Slip required" });
    if (req.file.size > 300 * 1024) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "File too large (max 300 KB)" });
    }
    const shipmentIds = JSON.parse(req.body.shipment_ids || "[]").map(Number);
    if (!shipmentIds.length) return res.status(400).json({ success: false, message: "No shipments selected" });

    const slipName = saveSlip(req.file.path, req.file.originalname);
    const result   = await bulkMarkPaid(shipmentIds, slipName);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: `${shipmentIds.length} payment(s) marked as paid` });
  } catch (err) {
    console.error("POST /finance/bulk-pay:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── ADD EXTRA EXPENSE ────────────────────────────────────────────── */
export const createExtraExpense = async (req, res) => {
  try {
    const { description, clause_reason, amount } = req.body;
    if (!amount || isNaN(amount))
      return res.status(400).json({ success: false, message: "Valid amount required" });
    const result = await addExtraExpense(parseInt(req.params.shipmentId), description, clause_reason, amount);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: "Extra expense added" });
  } catch (err) {
    console.error("POST /finance/:shipmentId/extra:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── MARK EXTRA EXPENSE PAID ──────────────────────────────────────── */
export const payExtraExpense = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Slip required" });
    if (req.file.size > 300 * 1024) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "File too large (max 300 KB)" });
    }
    const slipName = saveSlip(req.file.path, req.file.originalname);
    const result   = await markExtraExpensePaid(parseInt(req.params.expenseId), slipName);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: "Expense marked as paid" });
  } catch (err) {
    console.error("POST /finance/extra/:expenseId/pay:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── DELETE EXTRA EXPENSE ─────────────────────────────────────────── */
export const removeExtraExpense = async (req, res) => {
  try {
    const ok = await deleteExtraExpense(parseInt(req.params.expenseId));
    if (!ok) return res.status(404).json({ success: false, message: "Expense not found" });
    res.json({ success: true, message: "Expense removed" });
  } catch (err) {
    console.error("DELETE /finance/extra/:expenseId:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};