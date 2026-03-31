// src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dps_secret_change_in_prod";

/* ── Verify JWT — attaches req.user ─────────────────────────────── */
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ success: false, message: "Unauthorized — no token" });

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized — invalid or expired token" });
  }
};

/* ── Admin only ──────────────────────────────────────────────────── */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ success: false, message: "Forbidden — admin only" });
  next();
};

/* ── Admin or Finance only ───────────────────────────────────────── */
export const requireFinanceAccess = (req, res, next) => {
  if (!["admin", "finance"].includes(req.user?.role))
    return res.status(403).json({ success: false, message: "Forbidden — finance access only" });
  next();
};

/* ── Admin or Branch only (no finance on shipments) ─────────────── */
export const requireShipmentAccess = (req, res, next) => {
  if (!["admin", "branch"].includes(req.user?.role))
    return res.status(403).json({ success: false, message: "Forbidden — shipment access only" });
  next();
};

/* ── Inject plant scope into req ─────────────────────────────────── 
   req.scope.plantCode:
     admin   → null (sees all branches)
     branch  → "5110" (sees only their plant)
     finance → null (finance sees all, but only finance routes)
*/
export const injectScope = (req, res, next) => {
  req.scope = {
    plantCode: req.user?.plant_code || null,
    role:      req.user?.role       || "branch",
    isAdmin:   req.user?.role === "admin",
    isBranch:  req.user?.role === "branch",
    isFinance: req.user?.role === "finance",
  };
  next();
};