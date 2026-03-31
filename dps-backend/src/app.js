
import express from "express";
import cors from "cors";
import authRouter     from "./modules/auth/auth.routes.js";
import shipmentRouter from "./modules/shipment/shipment.routes.js";
import financeRouter  from "./modules/finance/finance.routes.js";
import dashboardRouter from "./modules/dashboard/dashboard.routes.js";

const app = express();

// ── Middleware FIRST ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────────
app.use("/uploads",       express.static("src/uploads"));
app.use("/uploads/slips", express.static("src/uploads/slips"));

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth",      authRouter);       // ← NEW: no auth required on login
app.use("/api/shipments", shipmentRouter);   // ← auth middleware applied inside
app.use("/api/finance",   financeRouter);    // ← auth middleware applied inside
app.use("/api/dashboard", dashboardRouter);  // ← auth middleware applied inside

export default app;