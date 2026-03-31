// src/RoleRoute.jsx
import { Navigate } from "react-router-dom";
import { getUser } from "./utils/apiClient";

export default function RoleRoute({ allowedRoles, children }) {
  const token = localStorage.getItem("token");
  const user  = getUser();

  // Not logged in → login
  if (!token || !user) return <Navigate to="/" replace />;

  // Admin always passes — no restrictions
  if (user.role === "admin") return children;

  // Finance → only finance routes, redirect elsewhere to /finance
  if (user.role === "finance") {
    if (!allowedRoles.includes("finance")) {
      return <Navigate to="/finance" replace />;
    }
    return children;
  }

  // Branch → check allowed roles, redirect to /dashboard if not allowed
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}