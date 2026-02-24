import express from "express";
import {
  createShipment,
  listShipments,
  listPendingShipments,
  approvePendingShipment,
  rejectPendingShipment,
  bulkConfirmShipments,
} from "./shipment.controller.js";

const requireAdmin = (req, res, next) => {
  // later: check JWT role === 'ADMIN'
  next();
};
const router = express.Router();

/* -------- ADMIN / SYSTEM ROUTES -------- */
router.get("/pending", listPendingShipments);
router.post("/approve", approvePendingShipment);
router.post("/reject", rejectPendingShipment);

/* -------- CORE SHIPMENT ROUTES -------- */
router.get("/", listShipments);
router.post("/", createShipment);

router.post("/bulk-confirm", bulkConfirmShipments);


export default router;
