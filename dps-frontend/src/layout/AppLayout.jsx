// src/layout/AppLayout.jsx
import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";
import "../assets/css/dashboard.css";
import { getUser } from "../utils/apiClient";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/", { replace: true }); // ← go to / not /login
  }, [navigate]);

  return (
    <div className="app-shell">
      <Sidebar onToggle={(isNowCollapsed) => setCollapsed(isNowCollapsed)} />
      <div
        className="app-main"
        style={{
          marginLeft: collapsed ? "72px" : "248px",
          transition: "margin-left 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <Topbar user={user} />
        <Outlet />
      </div>
    </div>
  );
}