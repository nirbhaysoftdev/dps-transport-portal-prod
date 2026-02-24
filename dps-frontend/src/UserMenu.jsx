
import "./assets/css/usermenu.css";
export default function UserMenu({ close }) {
  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  return (
    <div className="user-menu-popup">
      <div className="popup-header">
        <span>User Menu</span>
        <button className="close-btn" onClick={close}>
          x
        </button>
      </div>
      <ul className="popup-options">
        <li>Edit Profile</li>
        <li onClick={handleLogout}>
          Logout <span className="power-icon">⏻</span>
        </li>
      </ul>
    </div>
  );
}

// admin@test.com
// admin123

