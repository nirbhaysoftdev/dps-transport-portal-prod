// src/modules/dashboard/dashboard.controller.js
import { getDashboardKPIs, getPlantMapData } from "./dashboard.service.js";
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

export const getDashboardCSV = async (req, res) => {
  try {
    const { from, to } = req.query;
    const plantCode = req.scope?.isBranch ? req.scope.plantCode : (req.query.plant_code || null);
    const data = await getDashboardKPIs({ from, to, plantCode });

    const rows = [
      ["Metric", "Value"],
      ["Total Shipments", data.totalShipments],
      ["Delivered Shipments", data.deliveredShipments],
      ["Pending Shipments", data.pendingCount],
      ["Active Shipments", data.activeCount],
      ["Total Fund Requests", data.fundRequests.count],
      ["Total Fund Amount", data.fundRequests.amount],
      ["Pending Funds Count", data.pendingFunds.count],
      ["Pending Funds Amount", data.pendingFunds.amount],
      ["Paid Funds Count", data.paidFunds.count],
      ["Paid Funds Amount", data.paidFunds.amount],
      ["Total Fuel Sales", data.fuelStats.total_sales],
      ["Active Petrol Pumps", data.fuelStats.pump_count],
      ["Total Toll Amount", data.tollStats.total_toll],
      ["Total Tax Paid", data.taxStats.total_tax],
      [],
      ["Top Petrol Pumps", ""],
      ["Pump ID", "Total Sales (₹)", "Total Qty (L)"],
      ...(data.topPumps || []).map(p => [p.pump_id, p.total_sales, p.total_qty]),
      [],
      ["Dispatch Plant Map Data", ""],
      ["Plant", "Total", "Delivered", "Undelivered", "Running", "Dispatched"],
      ...(data.plantMapData || []).map(p => [p.plant, p.total, p.delivered, p.undelivered, p.running, p.dispatched]),
    ];

    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="dashboard_${from || "all"}_${to || "all"}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("❌ GET /dashboard/csv:", err);
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