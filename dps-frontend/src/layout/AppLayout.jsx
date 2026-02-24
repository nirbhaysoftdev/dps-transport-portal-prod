// src/layout/AppLayout.jsx
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";
import "../assets/css/dashboard.css";

export default function AppLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isNavOpen} />

      <div className="main-area">
        <Topbar onNavToggle={() => setIsNavOpen(!isNavOpen)} />
        <Outlet /> {/*  Pages render here */}
      </div>
    </div>
  );
}
