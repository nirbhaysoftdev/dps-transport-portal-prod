// src/Sidebar.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./assets/css/sidebar.css";

export default function Sidebar({ isOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(location.pathname); // track active path

  const menuItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Finance", path: "/finance" },
    { label: "Shipments", path: "/shipments" },
    { label: "Pending Shipments", path: "/PendingShipments" },
    { label: "Calendar", path: "/calendar" },
    { label: "Analytics", path: "/analytics" },
    { label: "Team", path: "/team" },
  ];

  const handleClick = (path) => {
    setActive(path);   // mark active
    navigate(path);    // navigate
  };

  return (
    <>
      {/* Always visible logo on mobile */}
      <div className="logo-box mobile-logo">
        <img src="src/assets/images/DPS-logo.png" alt="DPS Logistic" />
      </div>

      {/* Sidebar menu popup */}
      <aside className={`sidebar-box ${isOpen ? "open" : ""}`}>
        <div className="logo-box desktop-logo">
          <img src="src/assets/images/DPS-logo.png" alt="DPS Logistic" />
        </div>

        <p className="menu-label">MENU</p>
        <ul className="sidebar-nav">
          {menuItems.map((item) => (
            <li
              key={item.path}
              className={active === item.path ? "active" : ""}
              onClick={() => handleClick(item.path)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
