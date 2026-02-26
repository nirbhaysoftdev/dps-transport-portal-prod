import express from "express";
import multer from "multer";
import {
  createShipment, listShipments, listPendingShipments,
  approvePendingShipment, rejectPendingShipment, bulkConfirmShipments,
  checkMastersHandler, getShipmentHandler, updateShipmentHandler,
  listDrivers, uploadPod,
} from "./shipment.controller.js";

const router  = express.Router();
// Multer for POD — store in temp, controller moves to final destination
const podUpload = multer({
  dest: "src/uploads/tmp",
  limits: { fileSize: 400 * 1024 }, // generous limit; controller enforces 300 KB
});

/* ── Admin / system ── */
router.get("/pending",        listPendingShipments);
router.get("/check-masters",  checkMastersHandler);
router.post("/approve",       approvePendingShipment);
router.post("/reject",        rejectPendingShipment);
router.post("/bulk-confirm",  bulkConfirmShipments);

/* ── Core shipment CRUD ── */
router.get("/",               listShipments);
router.post("/",              createShipment);
router.get("/:id",            getShipmentHandler);
router.put("/:id",            updateShipmentHandler);

/* ── POD upload ── */
router.post("/:id/pod",       podUpload.single("pod"), uploadPod);

export default router;