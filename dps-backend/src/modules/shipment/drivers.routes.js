import express from "express";
import { listDrivers, searchDriverByDLHandler } from "../shipment/shipment.controller.js";

const router = express.Router();

router.get("/",       listDrivers);
router.get("/search", searchDriverByDLHandler);  // GET /api/drivers/search?dl=MH01XX1234

export default router;