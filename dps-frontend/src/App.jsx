import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "./layout/AppLayout";

import RoleRoute from "./RoleRoute"; 

import Dashboard from "./pages/dashboard";
import Finance from "./pages/finance";
import Shipments from "./pages/shipments";
import PendingShipments from "./pages/PendingShipments";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login */}
        <Route path="/" element={<Login />} />

        {/* EVERYTHING ELSE PROTECTED */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard → all roles */}
          <Route
            path="/dashboard"
            element={
              <RoleRoute allowedRoles={["Admin"]}>
                <Dashboard />
              </RoleRoute>
            }
          />

          {/* Finance → admin & finance only */}
          <Route
            path="/finance"
            element={
              <RoleRoute allowedRoles={["Admin", "Accounts" ]}>
                <Finance />
              </RoleRoute>
            }
          />
             <Route
            path="/shipments"
            element={
              <RoleRoute allowedRoles={["Admin", "Accounts" ]}>
                <Shipments />
              </RoleRoute>
            }
          />
              <Route
            path="/PendingShipments"
            element={
              <RoleRoute allowedRoles={["Admin", "Accounts" ]}>
                <PendingShipments />
              </RoleRoute>
            }
          />

          {/* Tasks → all roles */}
          {/* <Route
            path="/tasks"
            element={
              <RoleRoute allowedRoles={["admin", "finance", "user"]}>
                <Tasks />
              </RoleRoute>
            }
          /> */}

          {/* Add more pages safely with roles */}
          {/* <Route path="/pageX" element={<RoleRoute allowedRoles={["admin"]}><PageX /></RoleRoute>} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
