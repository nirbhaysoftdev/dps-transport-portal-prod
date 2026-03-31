// src/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user  = localStorage.getItem("user");

  // Not logged in → go to login
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  // Check JWT expiry
  try {
    const payload   = JSON.parse(atob(token.split(".")[1]));
    const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
    if (isExpired) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return <Navigate to="/" replace />;
    }
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }

  return children;
}