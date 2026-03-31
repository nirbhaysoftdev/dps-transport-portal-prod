// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { apiFetch, getUser, isAdmin } from "../utils/apiClient";
import "../assets/css/Dashboard.css";

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */
const fmtMoney = (n) =>
  `₹\u00A0${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtNum = (n) =>
  Number(n).toLocaleString("en-IN");

/* ── KPI Card ────────────────────────────────────────────────────── */
const KPICard = ({ icon, label, value, sub, subLabel, accent, loading }) => (
  <div className={`db-kpi-card db-kpi-card--${accent}`}>
    <div className="db-kpi-top">
      <div className={`db-kpi-icon db-kpi-icon--${accent}`}>{icon}</div>
      <span className="db-kpi-label">{label}</span>
    </div>
    {loading
      ? <div className="db-kpi-skeleton" />
      : <div className="db-kpi-value">{value}</div>
    }
    {sub !== undefined && !loading && (
      <div className="db-kpi-sub">
        <span className="db-kpi-sub-val">{sub}</span>
        {subLabel && <span className="db-kpi-sub-lbl">{subLabel}</span>}
      </div>
    )}
  </div>
);

/* ── Status Bar Chart ────────────────────────────────────────────── */
const StatusBar = ({ breakdown, loading }) => {
  const statuses = [
    { key: "PENDING", label: "Pending", color: "#f59e0b" },
    { key: "APPROVAL", label: "Approval", color: "#8b5cf6" },
    { key: "HOLD", label: "Hold", color: "#3b82f6" },
    { key: "ACTIVE", label: "Active", color: "#10b981" },
    { key: "REJECTED", label: "Rejected", color: "#ef4444" },
  ];

  const total = statuses.reduce((s, st) => s + (breakdown?.[st.key] || 0), 0) || 1;

  return (
    <div className="db-status-card">
      <div className="db-card-title">Shipments by Status</div>
      {loading
        ? <div className="db-skeleton-bar" />
        : (
          <>
            <div className="db-status-bar">
              {statuses.map(st => {
                const pct = ((breakdown?.[st.key] || 0) / total) * 100;
                return pct > 0 ? (
                  <div
                    key={st.key}
                    className="db-status-segment"
                    style={{ width: `${pct}%`, background: st.color }}
                    title={`${st.label}: ${breakdown?.[st.key] || 0}`}
                  />
                ) : null;
              })}
            </div>
            <div className="db-status-legend">
              {statuses.map(st => (
                <div key={st.key} className="db-legend-item">
                  <span className="db-legend-dot" style={{ background: st.color }} />
                  <span className="db-legend-label">{st.label}</span>
                  <span className="db-legend-val">{breakdown?.[st.key] || 0}</span>
                </div>
              ))}
            </div>
          </>
        )
      }
    </div>
  );
};

/* ── Monthly Trend Chart ─────────────────────────────────────────── */
const TrendChart = ({ trend, loading }) => {
  if (loading) return (
    <div className="db-trend-card">
      <div className="db-card-title">Monthly Shipment Trend</div>
      <div className="db-skeleton-chart" />
    </div>
  );

  const max = Math.max(...(trend || []).map(r => r.total), 1);

  return (
    <div className="db-trend-card">
      <div className="db-card-title">Monthly Shipment Trend (Last 6 Months)</div>
      <div className="db-trend-chart">
        {(trend || []).map((row, i) => (
          <div key={i} className="db-trend-col">
            <div className="db-trend-bar-wrap">
              <div
                className="db-trend-bar"
                style={{ height: `${(row.total / max) * 100}%` }}
                title={`${row.month_label}: ${row.total} shipments`}
              >
                <span className="db-trend-bar-val">{row.total}</span>
              </div>
            </div>
            <span className="db-trend-month">{row.month_label}</span>
          </div>
        ))}
        {(!trend || trend.length === 0) && (
          <div className="db-trend-empty">No data for the selected period</div>
        )}
      </div>
    </div>
  );
};

/* ── Finance Summary Card ────────────────────────────────────────── */
const FinanceSummary = ({ pendingFunds, paidFunds, loading }) => (
  <div className="db-finance-card">
    <div className="db-card-title">Fund Summary</div>
    {loading
      ? <><div className="db-skeleton-row" /><div className="db-skeleton-row" /></>
      : (
        <>
          <div className="db-finance-row db-finance-row--pending">
            <div className="db-finance-left">
              <span className="db-finance-icon">⏳</span>
              <div>
                <div className="db-finance-label">Pending Payments</div>
                <div className="db-finance-count">{pendingFunds?.count || 0} shipments</div>
              </div>
            </div>
            <div className="db-finance-amount db-finance-amount--pending">
              {fmtMoney(pendingFunds?.amount || 0)}
            </div>
          </div>
          <div className="db-finance-divider" />
          <div className="db-finance-row db-finance-row--paid">
            <div className="db-finance-left">
              <span className="db-finance-icon">✅</span>
              <div>
                <div className="db-finance-label">Paid</div>
                <div className="db-finance-count">{paidFunds?.count || 0} shipments</div>
              </div>
            </div>
            <div className="db-finance-amount db-finance-amount--paid">
              {fmtMoney(paidFunds?.amount || 0)}
            </div>
          </div>
        </>
      )
    }
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const user = getUser();
  const _isAdmin = isAdmin();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  /* ── Load plant list for admin ── */
  useEffect(() => {
    if (!_isAdmin) return;
    apiFetch("/api/dashboard/plants")
      .then(r => r?.json())
      .then(j => { if (j?.success) setPlants(j.data); })
      .catch(() => { });
  }, [_isAdmin]);

  /* ── Fetch KPIs ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/dashboard?";
      if (from) url += `from=${from}&`;
      if (to) url += `to=${to}&`;
      if (branchFilter) url += `plant_code=${branchFilter}&`;

      const res = await apiFetch(url);
      if (!res) return;
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [from, to, branchFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Clear filters ── */
  const clearFilters = () => {
    setFrom(""); setTo(""); setBranchFilter("");
  };

  const hasFilters = from || to || branchFilter;

  /* ── Derived values ── */
  const deliveryRate = data?.totalShipments > 0
    ? Math.round((data.deliveredShipments / data.totalShipments) * 100)
    : 0;

  return (
    <div className="db-page">

      {/* ── Header ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">
            {user?.role === "branch"
              ? `Branch: ${user.plant_code} · ${user.site || ""}`
              : "All Branches Overview"
            }
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="db-filters">
          {/* Branch selector — admin only */}
          {_isAdmin && (
            <select
              className="db-filter-select"
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
            >
              <option value="">All Branches</option>
              {plants.map(p => (
                <option key={p.plant_code} value={p.plant_code}>
                  {p.plant_code} — {p.site}
                </option>
              ))}
            </select>
          )}

          {/* Date range */}
          <div className="db-date-range">
            <span className="db-date-icon">📅</span>
            <input
              type="date"
              className="db-date-input"
              value={from}
              onChange={e => setFrom(e.target.value)}
            />
            <span className="db-date-sep">→</span>
            <input
              type="date"
              className="db-date-input"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>

          {hasFilters && (
            <button className="db-clear-btn" onClick={clearFilters}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards Row 1 — Shipments ── */}
      <div className="db-kpi-grid">
        <KPICard
          icon="🚚"
          label="Total Shipments"
          value={fmtNum(data?.totalShipments || 0)}
          sub={`${data?.activeCount || 0} active`}
          subLabel="in transit"
          accent="blue"
          loading={loading}
        />
        <KPICard
          icon="✅"
          label="Shipments Delivered"
          value={fmtNum(data?.deliveredShipments || 0)}
          sub={`${deliveryRate}%`}
          subLabel="delivery rate"
          accent="green"
          loading={loading}
        />
        <KPICard
          icon="⏳"
          label="Pending Shipments"
          value={fmtNum(data?.pendingCount || 0)}
          sub={`${data?.statusBreakdown?.APPROVAL || 0} in approval`}
          subLabel="awaiting admin"
          accent="amber"
          loading={loading}
        />
        <KPICard
          icon="❌"
          label="Rejected"
          value={fmtNum(data?.statusBreakdown?.REJECTED || 0)}
          accent="red"
          loading={loading}
        />
      </div>

      {/* ── KPI Cards Row 2 — Finance ── */}
      <div className="db-kpi-grid">
        <KPICard
          icon="💰"
          label="Total Fund Requests"
          value={fmtNum(data?.fundRequests?.count || 0)}
          sub={fmtMoney(data?.fundRequests?.amount || 0)}
          subLabel="total value"
          accent="orange"
          loading={loading}
        />
        <KPICard
          icon="⏳"
          label="Pending Funds"
          value={fmtNum(data?.pendingFunds?.count || 0)}
          sub={fmtMoney(data?.pendingFunds?.amount || 0)}
          subLabel="unpaid"
          accent="amber"
          loading={loading}
        />
        <KPICard
          icon="✅"
          label="Paid Funds"
          value={fmtNum(data?.paidFunds?.count || 0)}
          sub={fmtMoney(data?.paidFunds?.amount || 0)}
          subLabel="cleared"
          accent="green"
          loading={loading}
        />
        <KPICard
          icon="📦"
          label="Hold (Ready for Fund)"
          value={fmtNum(data?.statusBreakdown?.HOLD || 0)}
          sub={`${data?.statusBreakdown?.ACTIVE || 0} active`}
          subLabel="fund requested"
          accent="blue"
          loading={loading}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="db-charts-row">
        <TrendChart trend={data?.monthlyTrend} loading={loading} />
        <StatusBar breakdown={data?.statusBreakdown} loading={loading} />
      </div>

      {/* ── Finance Summary ── */}
      <FinanceSummary
        pendingFunds={data?.pendingFunds}
        paidFunds={data?.paidFunds}
        loading={loading}
      />

    </div>
  );
}