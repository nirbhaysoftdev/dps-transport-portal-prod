import express from "express";
import { listDrivers } from "../shipment/shipment.controller.js";

const router = express.Router();

router.get("/", listDrivers);

export default router;