// src/modules/dashboard/dashboard.controller.js
import { getDashboardKPIs } from "./dashboard.service.js";
import { listPlants } from "../auth/auth.service.js";

export const getDashboard = async (req, res) => {
  try {
    const { from, to } = req.query;

    // Branch: always their plant from JWT
    // Admin: use query param plant_code if provided, else all branches
    const plantCode = req.scope?.isBranch
      ? req.scope.plantCode
      : (req.query.plant_code || null);

    const data = await getDashboardKPIs({ from, to, plantCode });
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /dashboard:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDashboardPlants = async (req, res) => {
  try {
    const plants = await listPlants();
    res.json({ success: true, data: plants });
  } catch (err) {
    console.error("❌ GET /dashboard/plants:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};