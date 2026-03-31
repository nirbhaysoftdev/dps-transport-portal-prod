// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../assets/css/Login.css";
import DPS_LOGO from "../assets/images/DPS-logo.png";

const API = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [message,  setMessage]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  // Already logged in → redirect, but check token not expired first
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user  = JSON.parse(localStorage.getItem("user") || "null");
    if (token && user) {
      // Check expiry
      try {
        const payload   = JSON.parse(atob(token.split(".")[1]));
        const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
        if (isExpired) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          return; // stay on login page
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return;
      }
      const destination = user.role === "finance" ? "/finance" : "/dashboard";
      navigate(destination, { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password }),
      });

      const data = await response.json();
      setLoading(false);

      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user",  JSON.stringify(data.user));

        // Remember me — persist token key so it survives tab close
        if (remember) {
          localStorage.setItem("remember", "true");
        }

        // finance users → /finance directly (no dashboard access)
        // admin, branch → /dashboard
        const destination = data.user.role === "finance" ? "/finance" : "/dashboard";
        navigate(destination, { replace: true });
      } else {
        setMessage(data.message || "Login failed. Check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoading(false);
      setMessage("Cannot connect to server. Please try again.");
    }
  };

  return (
    <div className="lg-root">
      <div className="lg-bg" />

      <div className="lg-card">
        {/* ── LEFT PANEL ── */}
        <div className="lg-left">
          <div className="lg-brand">
            <span className="lg-brand-name">Fleet Flow</span>
            <span className="lg-brand-powered">
              Powered By <span className="cx">CodeXpertz</span>
            </span>
          </div>
          <div className="lg-left-inner">
            <span className="lg-left-eyebrow">Transport Management System</span>
            <h1 className="lg-left-heading">
              Move Smarter.<br />Deliver Better.
            </h1>
            <p className="lg-left-para">
              Fleet Flow gives you real-time visibility over every vehicle,
              shipment and driver — from Yard to every dealer across India.
              One platform. Zero guesswork.
            </p>
            <div className="lg-left-stats">
              <div className="lg-stat">
                <span className="lg-stat-num">100%</span>
                <span className="lg-stat-lbl">Shipment Visibility</span>
              </div>
              <div className="lg-stat-divider" />
              <div className="lg-stat">
                <span className="lg-stat-num">Live</span>
                <span className="lg-stat-lbl">Route Tracking</span>
              </div>
              <div className="lg-stat-divider" />
              <div className="lg-stat">
                <span className="lg-stat-num">Pan-India</span>
                <span className="lg-stat-lbl">Coverage</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lg-right">
          <div className="lg-welcome">
            <h2 className="lg-welcome-title">Welcome Back</h2>
            <img src={DPS_LOGO} alt="DPS Globistic" className="lg-dps-logo" />
            <p className="lg-welcome-sub">
              Enter your credentials to access the portal
            </p>
          </div>

          <form className="lg-form" onSubmit={handleSubmit} autoComplete="off">
            <div className="lg-field">
              <label className="lg-label">Email</label>
              <input
                className="lg-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="lg-field">
              <label className="lg-label">Password</label>
              <div className="lg-input-wrap">
                <input
                  className="lg-input"
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPass(s => !s)}
                  tabIndex={-1}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div className="lg-row">
              <label className="lg-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            </div>

            {message && (
              <div className="lg-error">⚠ {message}</div>
            )}

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? <span className="lg-spinner" /> : "Sign In"}
            </button>
          </form>

          {/* Branch badge — shown after failed attempt to hint correct account */}
          <p className="lg-footer-note">
            Branch users: use your branch email assigned by admin
          </p>
        </div>
      </div>
    </div>
  );
}