import express from "express";
import { listVehicles } from "./vehicle.controller.js";

const router = express.Router();
router.get("/", listVehicles);

export default router;
