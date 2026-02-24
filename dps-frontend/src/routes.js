import Dashboard from "./pages/dashboard";
import Finance from "./pages/finance";
import Shipments from "./pages/shipments";
import PendingShipments from "./pages/PendingShipments";

export const appRoutes = [
  {
    path: "/dashboard",
    element: <Dashboard />,
    roles: ["Admin"]
  },
  {
    path: "/finance",
    element: <Finance />,
    roles: ["Admin", "Accounts"]
  },
   {
    path: "/shipments",
    element: <Shipments />,
    roles: ["Admin", "Accounts"]
  },
   {
    path: "/PendingShipments",
    element: <PendingShipments />,
    roles: ["Admin", "Accounts"]
  }
];
