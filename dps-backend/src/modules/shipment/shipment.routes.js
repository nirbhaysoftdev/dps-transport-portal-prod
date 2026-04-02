// src/modules/shipment/shipment.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  createShipment, listShipments, listPendingShipments, listApprovalShipments,
  approvePendingShipment, adminApproveShipmentHandler, rejectPendingShipment, bulkConfirmShipments,
  checkMastersHandler, getShipmentHandler, updateShipmentHandler,
  listDrivers, uploadPod, searchDriverByDLHandler, generateFundRequestHandler,
  getRejectedShipmentsHandler, moveToOperationsHandler, listPetrolPumps,
  listActiveShipments, listTrackingShipments, updateTrackingStatusHandler,
} from "./shipment.controller.js";
import {
  authenticate, requireShipmentAccess, injectScope,
} from "../../middleware/authMiddleware.js";

const router    = express.Router();
const podUpload = multer({
  dest: path.resolve(__dirname, "../../uploads/tmp"),
  limits: { fileSize: 400 * 1024 },
});

// All shipment routes:
// 1. Must be authenticated
// 2. Must be admin or branch (finance cannot access shipments)
// 3. Scope injected so queries are plant_code filtered automatically
router.use(authenticate, requireShipmentAccess, injectScope);

/* ── Lookup / master routes ── */
router.get("/petrol-pumps",          listPetrolPumps);
router.get("/check-masters",         checkMastersHandler);

/* ── Pending & rejected queue ── */
router.get("/pending",               listPendingShipments);
router.get("/approval",              listApprovalShipments);
router.post("/approve",              approvePendingShipment);
router.post("/admin-approve",        adminApproveShipmentHandler);
router.post("/reject",               rejectPendingShipment);
router.get("/rejected",              getRejectedShipmentsHandler);
router.get("/active",                listActiveShipments);
router.post("/move-to-operations",   moveToOperationsHandler);

/* ── Bulk ── */
router.post("/bulk-confirm",         bulkConfirmShipments);

/* ── Tracking ── */
router.get("/tracking",                 listTrackingShipments);
router.post("/:id/tracking-status",     updateTrackingStatusHandler);

/* ── Core CRUD ── */
router.get("/",                      listShipments);
router.post("/",                     createShipment);
router.get("/:id",                   getShipmentHandler);
router.put("/:id",                   updateShipmentHandler);

/* ── POD upload ── */
router.post("/:id/pod",              podUpload.single("pod"), uploadPod);

/* ── Fund Request ── */
router.post("/:id/fund-request",     generateFundRequestHandler);

export default router;