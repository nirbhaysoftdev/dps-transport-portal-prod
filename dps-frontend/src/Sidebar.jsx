// src/Sidebar.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./assets/css/sidebar.css";
import { getUser } from "./utils/apiClient";

import DPS_LOGO from "./assets/images/DPS-logo.png";
import DPS_ICON from "./assets/images/DPS_Icon.png";

/* ── SVG Icon renderer ──────────────────────────────────────────── */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const ICONS = {
  Dashboard: ["M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M9 22V12h6v10"],
  Finance: ["M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  Shipments: ["M1 3h15v13H1zM16 8h4l3 3v5h-7V8z", "M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM20.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"],
  "Pending Shipments": ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  "Approval Shipments": ["M9 11l3 3L22 4", "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
  "Rejected Shipments": ["M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"],
  Tracking: ["M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z", "M15 11a3 3 0 11-6 0 3 3 0 016 0z"],
  "Fund Requests": ["M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"],
  Calendar: ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"],
  Analytics: ["M18 20V10M12 20V4M6 20v-6"],
  Team: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75", "M9 7a4 4 0 100 8 4 4 0 000-8z"],
};

// roles: null = everyone, ["admin"] = admin only, ["admin","branch"] = both
const ALL_MENU_ITEMS = [
  { label: "Dashboard", path: "/dashboard", roles: ["admin", "branch"] },
  { label: "Shipments", path: "/shipments", roles: ["admin", "branch"] },
  { label: "Tracking", path: "/Tracking", roles: ["admin", "branch"] },
  { label: "Pending Shipments", path: "/PendingShipments", roles: ["admin", "branch"] },
  { label: "Approval Shipments", path: "/ApprovalShipments", roles: ["admin", "branch"] },
  { label: "Rejected Shipments", path: "/RejectedShipments", roles: ["admin", "branch"] },
  { label: "Fund Requests", path: "/ActiveShipments", roles: ["admin", "branch"] },
  { label: "Finance", path: "/finance", roles: ["admin", "finance"] },
  { label: "Calendar", path: "/calendar", roles: ["admin", "branch"] },
  { label: "Analytics", path: "/analytics", roles: ["admin"] },
  { label: "Team", path: "/team", roles: ["admin"] },
];

/* ── Animated chevron that rotates on collapse ──────────────────── */
const ChevronIcon = ({ collapsed }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    className={`sb-chevron ${collapsed ? "sb-chevron--right" : "sb-chevron--left"}`}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════════════ */
export default function Sidebar({ onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(null);

  const user = getUser();
  const userRole = user?.role || "branch";
  const isAdmin = userRole === "admin";

  // Filter menu items based on role
  // null roles = everyone, otherwise check if userRole is in the list
  const menuItems = ALL_MENU_ITEMS.filter(item =>
    !item.roles || item.roles.includes(userRole)
  );

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (onToggle) onToggle(next);
  };

  return (
    <aside className={`sb-root ${collapsed ? "sb-collapsed" : "sb-expanded"}`}>

      {/* ── Decorative top accent ── */}
      <div className="sb-accent-bar" />

      {/* ── Logo zone ── */}
      <div className="sb-logo-zone">
        <div className="sb-logo-inner">
          {collapsed
            ? <img src={DPS_ICON} alt="DPS" className="sb-logo-icon" />
            : <img src={DPS_LOGO} alt="DPS Globistic" className="sb-logo-full" />
          }
        </div>
      </div>

      {/* ── Section label ── */}
      <div className="sb-section-label-wrap">
        {!collapsed && <span className="sb-section-label">NAVIGATION</span>}
        {collapsed && <span className="sb-section-divider" />}
      </div>

      {/* ── Nav list ── */}
      <nav className="sb-nav">
        <ul className="sb-list">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isPending = item.label === "Pending Shipments";
            const isApproval = item.label === "Approval Shipments";
            const isRejected = item.label === "Rejected Shipments";
            const iconPaths = ICONS[item.label];

            return (
              <li
                key={item.path}
                className="sb-item-wrap"
                onMouseEnter={() => setHovered(item.path)}
                onMouseLeave={() => setHovered(null)}
              >
                <button
                  className={`sb-item ${isActive ? "sb-item--active" : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  {/* Active pill indicator */}
                  {isActive && <span className="sb-pill" />}

                  {/* Icon container */}
                  <span className={`sb-icon ${isActive ? "sb-icon--active" : ""}`}>
                    {iconPaths ? <Icon d={iconPaths} size={18} /> : <span className="sb-dot" />}
                  </span>

                  {/* Label — always in DOM, width + opacity controlled by CSS */}
                  <span className="sb-label">{item.label}</span>

                  {/* Badges */}
                  {isPending && !collapsed && (
                    <span className="sb-badge sb-badge--alert">!</span>
                  )}
                  {isApproval && !collapsed && (
                    <span className="sb-badge sb-badge--alert">?</span>
                  )}
                  {isRejected && !collapsed && (
                    <span className="sb-badge sb-badge--reject">✕</span>
                  )}
                </button>

                {/* Tooltip shown only in collapsed mode */}
                {collapsed && hovered === item.path && (
                  <div className="sb-tooltip">
                    {item.label}
                    {(isPending || isApproval) && <span className="sb-tooltip-dot">!</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Spacer pushes toggle to bottom ── */}
      <div className="sb-spacer" />

      {/* ── User role badge ── */}
      {!collapsed && (
        <div className="sb-user-badge">
          {userRole === "admin"
            ? <><span className="sb-badge-icon">🛡️</span><span className="sb-badge-text">Admin · All Branches</span></>
            : userRole === "finance"
              ? <><span className="sb-badge-icon">💰</span><span className="sb-badge-text">Finance · Accounts</span></>
              : <><span className="sb-badge-icon">🏭</span><span className="sb-badge-text">{user?.plant_code} · {user?.site || "Branch"}</span></>
          }
        </div>
      )}

      {/* ── Bottom toggle button — INSIDE sidebar, no z-index fights ── */}
      <div className="sb-footer">
        <div className="sb-footer-line" />
        <button
          className="sb-toggle"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="sb-toggle-icon">
            <ChevronIcon collapsed={collapsed} />
          </span>
          {!collapsed && <span className="sb-toggle-text">Collapse</span>}
        </button>
      </div>

    </aside>
  );
}