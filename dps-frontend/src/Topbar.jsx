// src/Topbar.jsx
import "./assets/css/topbar.css";
import { useState } from "react";
import UserMenu from "./UserMenu";

export default function Topbar({ onNavToggle }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar-box">
      {/* Hamburger for mobile */}
      <button className="nav-toggle" onClick={onNavToggle} aria-label="Toggle navigation">
        ☰
      </button>

      <div className="search-box">
        <input type="text" placeholder="Search task" />
        <span className="shortcut">⌘ F</span>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn">✉️</button>
        <button className="icon-btn">🔔</button>

        <div className="profile-box" onClick={() => setMenuOpen(!menuOpen)}>
          <img
            src={`https://i.pravatar.cc/100?u=${user?.email}`}
            alt="User"
            className="avatar"
          />
          <div className="profile-text">
            <span className="name">{user?.name || "User"}</span>
            <span className="email">{user?.email}</span>
          </div>
        </div>

        {menuOpen && <UserMenu close={() => setMenuOpen(false)} />}
      </div>
    </header>
  );
}
