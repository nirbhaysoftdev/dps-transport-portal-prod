// src/routes.js
// No JSX here — just path, component, and role config
// Elements are created in App.jsx

import Dashboard         from "./pages/dashboard";
import Finance           from "./pages/finance";
import Shipments         from "./pages/shipments";
import PendingShipments  from "./pages/PendingShipments";
import ApprovalShipments from "./pages/ApprovalShipments";
import RejectedShipments from "./pages/RejectedShipments";
import ActiveShipments   from "./pages/ActiveShipments";
import Tracking          from "./pages/Tracking";

export const appRoutes = [
  {
    path:      "/dashboard",
    component: Dashboard,
    roles:     ["admin", "branch"],
  },
  {
    path:      "/shipments",
    component: Shipments,
    roles:     ["admin", "branch"],
  },
  {
    path:      "/PendingShipments",
    component: PendingShipments,
    roles:     ["admin", "branch"],
  },
  {
    path:      "/ApprovalShipments",
    component: ApprovalShipments,
    roles:     ["admin", "branch"], // Branch can view only
  },
  {
    path:      "/RejectedShipments",
    component: RejectedShipments,
    roles:     ["admin", "branch"],
  },
  {
    path:      "/ActiveShipments",
    component: ActiveShipments,
    roles:     ["admin", "branch"],
  },
  {
    path:      "/finance",
    component: Finance,
    roles:     ["admin", "finance"],
  },
  {
    path:      "/Tracking",
    component: Tracking,
    roles:     ["admin", "branch"],
  },
];