// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { appRoutes } from "./routes";
import AppLayout from "./layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import Login from "./pages/login";
import { getUser } from "./utils/apiClient";

function DefaultRedirect() {
  const user = getUser();
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={user.role === "finance" ? "/finance" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public: Login at both / and /login ── */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* ── Protected layout — pathless, wraps all app pages ── */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/redirect" element={<DefaultRedirect />} />

          {appRoutes.map(({ path, component: Component, roles }) => (
            <Route
              key={path}
              path={path}
              element={
                <RoleRoute allowedRoles={roles}>
                  <Component />
                </RoleRoute>
              }
            />
          ))}
        </Route>

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}