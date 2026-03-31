// src/modules/finance/finance.routes.js
import express from "express";
import {
  slipUpload,
  listFinance, getCalendarSummary, financeDetail,
  payFinance, bulkPay,
  createExtraExpense, payExtraExpense, removeExtraExpense,
} from "./finance.controller.js";
import {
  authenticate, requireFinanceAccess, injectScope,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// All finance routes:
// 1. Must be authenticated
// 2. Must be admin or finance (branch cannot access finance)
// 3. Scope injected (admin can filter by branch, finance sees all)
router.use(authenticate, requireFinanceAccess, injectScope);

/* ── Finance list & calendar ── */
router.get("/",                               listFinance);
router.get("/calendar",                       getCalendarSummary);

/* ── Bulk payment ── */
router.post("/bulk-pay",                      slipUpload.single("slip"), bulkPay);

/* ── Per-shipment detail & payment ── */
router.get("/:shipmentId",                    financeDetail);
router.post("/:shipmentId/pay",               slipUpload.single("slip"), payFinance);
router.post("/:shipmentId/extra",             createExtraExpense);

/* ── Extra expense actions ── */
router.post("/extra/:expenseId/pay",          slipUpload.single("slip"), payExtraExpense);
router.delete("/extra/:expenseId",            removeExtraExpense);

export default router;