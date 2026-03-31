// src/modules/dashboard/dashboard.routes.js
import express from "express";
import { getDashboard, getDashboardPlants } from "./dashboard.controller.js";
import { authenticate, injectScope } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, injectScope);

router.get("/",        getDashboard);
router.get("/plants",  getDashboardPlants);

export default router;