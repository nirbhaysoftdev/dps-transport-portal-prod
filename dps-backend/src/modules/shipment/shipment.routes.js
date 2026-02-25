import express from "express";
import {
  createShipment, listShipments, listPendingShipments,
  approvePendingShipment, rejectPendingShipment, bulkConfirmShipments,
  checkMastersHandler, getShipmentHandler, updateShipmentHandler,
} from "./shipment.controller.js";
import { listDrivers } from "./shipment.controller.js";

const router = express.Router();

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

export default router;