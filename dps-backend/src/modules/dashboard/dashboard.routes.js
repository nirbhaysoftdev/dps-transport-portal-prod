// src/modules/dashboard/dashboard.routes.js
import express from "express";
import { getDashboard, getDashboardPlants, getDashboardCSV } from "./dashboard.controller.js";
import { authenticate, injectScope } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, injectScope);

router.get("/",        getDashboard);
router.get("/plants",  getDashboardPlants);
router.get("/csv",     getDashboardCSV);

export default router;