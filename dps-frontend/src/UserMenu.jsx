// src/UserMenu.jsx
import "./assets/css/usermenu.css";

export default function UserMenu({ close }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("remember");
    window.location.href = "/";
  };

  const roleBadge = () => {
    if (!user) return null;
    switch (user.role) {
      case "admin":
        return { icon: "🛡️", text: "Admin — All Branches", cls: "badge--admin" };
      case "finance":
        return { icon: "💰", text: "Finance — Accounts", cls: "badge--finance" };
      case "branch":
        return { icon: "🏭", text: `${user.plant_code} · ${user.site || "Branch"}`, cls: "badge--branch" };
      default:
        return { icon: "👤", text: user.role, cls: "" };
    }
  };

  const badge = roleBadge();

  return (
    <div className="user-menu-popup">
      <div className="popup-header">
        <span>User Menu</span>
        <button className="close-btn" onClick={close}>✕</button>
      </div>

      {user && (
        <div className="popup-user-info">
          <div className="popup-user-name">{user.name}</div>
          <div className="popup-user-email">{user.email}</div>
          {badge && (
            <div className={`popup-user-role ${badge.cls}`}>
              {badge.icon} {badge.text}
            </div>
          )}
        </div>
      )}

      <ul className="popup-options">
        <li>Edit Profile</li>
        <li className="popup-logout" onClick={handleLogout}>
          Logout <span className="power-icon">⏻</span>
        </li>
      </ul>
    </div>
  );
}