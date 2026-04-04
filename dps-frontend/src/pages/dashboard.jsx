// src/pages/Dashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { apiFetch, getUser, isAdmin } from "../utils/apiClient";
import "../assets/css/dashboard.css";

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */
const fmtMoney = (n) =>
  `₹\u00A0${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtNum = (n) =>
  Number(n).toLocaleString("en-IN");

const fmtDate = (d) => d.toISOString().split("T")[0];

const ACCENT_COLORS = {
  blue: "#3b82f6", green: "#10b981", amber: "#f59e0b",
  red: "#ef4444", orange: "#ff6d41",
};
const SPARK_LINE = {
  blue:   "M0,22 C15,18 28,24 42,16 C56,8 68,13 90,5",
  green:  "M0,24 C18,21 32,25 48,17 C64,9 76,11 90,4",
  amber:  "M0,8 C14,13 28,10 44,17 C60,24 74,21 90,26",
  red:    "M0,6 C14,11 28,15 44,20 C60,24 74,25 90,27",
  orange: "M0,20 C18,16 32,21 48,14 C64,7 76,9 90,3",
};
const SPARK_AREA = {
  blue:   "M0,22 C15,18 28,24 42,16 C56,8 68,13 90,5 L90,32 L0,32 Z",
  green:  "M0,24 C18,21 32,25 48,17 C64,9 76,11 90,4 L90,32 L0,32 Z",
  amber:  "M0,8 C14,13 28,10 44,17 C60,24 74,21 90,26 L90,32 L0,32 Z",
  red:    "M0,6 C14,11 28,15 44,20 C60,24 74,25 90,27 L90,32 L0,32 Z",
  orange: "M0,20 C18,16 32,21 48,14 C64,7 76,9 90,3 L90,32 L0,32 Z",
};

/* ── KPI Card ────────────────────────────────────────────────────── */
const KPICard = ({ icon, label, value, sub, subLabel, accent, loading }) => (
  <div className={`db-kpi-card db-kpi-card--${accent}`}>
    <div className="db-kpi-header">
      <div className="db-kpi-header-left">
        <div className={`db-kpi-icon db-kpi-icon--${accent}`}>{icon}</div>
        <span className="db-kpi-label">{label}</span>
      </div>
      <span className="db-kpi-dots">···</span>
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
    <div className="db-kpi-spark">
      <svg viewBox="0 0 90 32" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sg-${accent}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT_COLORS[accent]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={ACCENT_COLORS[accent]} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={SPARK_AREA[accent]} fill={`url(#sg-${accent})`} />
        <path d={SPARK_LINE[accent]} fill="none" stroke={ACCENT_COLORS[accent]}
          strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);

/* ── Status Donut Chart ──────────────────────────────────────────── */
const StatusBar = ({ breakdown, loading }) => {
  const statuses = [
    { key: "PENDING",  label: "Pending",  color: "#f59e0b" },
    { key: "APPROVAL", label: "Approval", color: "#8b5cf6" },
    { key: "HOLD",     label: "Hold",     color: "#3b82f6" },
    { key: "ACTIVE",   label: "Active",   color: "#10b981" },
    { key: "REJECTED", label: "Rejected", color: "#ef4444" },
  ];
  const total = statuses.reduce((s, st) => s + (breakdown?.[st.key] || 0), 0) || 1;
  const R = 52, CIRC = 2 * Math.PI * R;
  let cumulRot = -90;

  return (
    <div className="db-status-card">
      <div className="db-card-header">
        <div className="db-card-title">Shipments by Status</div>
        <span className="db-card-badge">All Time ▾</span>
      </div>
      {loading ? <div className="db-skeleton-bar" /> : (
        <div className="db-donut-layout">
          <div className="db-donut-wrap">
            <svg viewBox="0 0 160 160" className="db-donut-svg">
              <circle cx="80" cy="80" r={R} fill="none" stroke="#f3f4f6" strokeWidth="22" />
              {statuses.map(st => {
                const count = breakdown?.[st.key] || 0;
                if (!count) return null;
                const pct = count / total;
                const dash = pct * CIRC;
                const rot = cumulRot;
                cumulRot += pct * 360;
                return (
                  <circle key={st.key} cx="80" cy="80" r={R}
                    fill="none" stroke={st.color} strokeWidth="22"
                    strokeDasharray={`${dash} ${CIRC}`}
                    transform={`rotate(${rot}, 80, 80)`}
                    className="db-donut-seg"
                  />
                );
              })}
              <text x="80" y="75" textAnchor="middle" className="db-donut-val">{fmtNum(total)}</text>
              <text x="80" y="91" textAnchor="middle" className="db-donut-lbl">Total</text>
            </svg>
          </div>
          <div className="db-donut-legend">
            {statuses.map(st => {
              const count = breakdown?.[st.key] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={st.key} className="db-donut-row">
                  <div className="db-donut-row-info">
                    <span className="db-legend-dot" style={{ background: st.color }} />
                    <span className="db-legend-label">{st.label}</span>
                    <span className="db-legend-val">{count}</span>
                    <span className="db-donut-pct">{pct}%</span>
                  </div>
                  <div className="db-donut-track">
                    <div className="db-donut-fill" style={{ width: `${pct}%`, background: st.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Monthly Trend Chart (SVG Area) ─────────────────────────────── */
const TrendChart = ({ trend, loading }) => {
  const [hovered, setHovered] = useState(null);
  const rows = trend || [];
  const max = Math.max(...rows.map(r => r.total), 1);
  const VW = 560, VH = 200;
  const PAD = { l: 34, r: 14, t: 14, b: 28 };
  const CW = VW - PAD.l - PAD.r, CH = VH - PAD.t - PAD.b;

  const pts = rows.map((row, i) => ({
    x: PAD.l + (rows.length > 1 ? (i / (rows.length - 1)) * CW : CW / 2),
    y: PAD.t + CH - (row.total / max) * CH,
    label: row.month_label,
    total: row.total,
  }));

  const linePath = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = pts[i - 1], cpx = (prev.x + p.x) / 2;
    return `${d} C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, "");
  const areaPath = pts.length > 0
    ? `${linePath} L ${pts[pts.length - 1].x},${PAD.t + CH} L ${pts[0].x},${PAD.t + CH} Z`
    : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.t + CH * f, val: Math.round(max * (1 - f)),
  }));

  return (
    <div className="db-trend-card">
      <div className="db-card-header">
        <div className="db-card-title">Monthly Shipment Trend</div>
        <span className="db-card-badge">Last 6 Months ▾</span>
      </div>
      {loading ? <div className="db-skeleton-chart" /> : rows.length === 0 ? (
        <div className="db-trend-empty">No data for the selected period</div>
      ) : (
        <div className="db-area-wrap">
          <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none"
            className="db-area-svg" onMouseLeave={() => setHovered(null)}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {gridLines.map((g, i) => (
              <line key={i} x1={PAD.l} y1={g.y} x2={VW - PAD.r} y2={g.y}
                stroke="#f0f2f5" strokeWidth="1" />
            ))}
            {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
            {linePath && <path d={linePath} fill="none" stroke="#3b82f6"
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="7" fill="transparent"
                  onMouseEnter={() => setHovered(p)} />
                {hovered?.label === p.label && (
                  <circle cx={p.x} cy={p.y} r="4.5"
                    fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
                )}
              </g>
            ))}
            {pts.map((p, i) => (
              <text key={i} x={p.x} y={VH - 5} textAnchor="middle"
                fontSize="9.5" fill="#9ca3af" fontFamily="Inter,system-ui,sans-serif">
                {p.label}
              </text>
            ))}
            {gridLines.filter((_, i) => i < 4).map((g, i) => (
              <text key={i} x={PAD.l - 4} y={g.y + 4} textAnchor="end"
                fontSize="9" fill="#c4c9d4" fontFamily="Inter,system-ui,sans-serif">
                {g.val}
              </text>
            ))}
            {hovered && (
              <g>
                <line x1={hovered.x} y1={PAD.t} x2={hovered.x} y2={PAD.t + CH}
                  stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
                <rect x={hovered.x - 48} y={hovered.y - 38} width="96" height="26"
                  rx="7" fill="#1a1f3a" />
                <text x={hovered.x} y={hovered.y - 20} textAnchor="middle"
                  fontSize="10.5" fontWeight="600" fill="#fff"
                  fontFamily="Inter,system-ui,sans-serif">
                  {hovered.label}: {hovered.total}
                </text>
              </g>
            )}
          </svg>
        </div>
      )}
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

/* ── Top Pumps Card ──────────────────────────────────────────────── */
const TopPumpsCard = ({ pumps, loading }) => (
  <div className="db-pumps-card">
    <div className="db-card-title">Top Petrol Pumps</div>
    {loading
      ? [1,2,3].map(i => <div key={i} className="db-skeleton-row" style={{ height: 36, marginBottom: 8 }} />)
      : (pumps || []).length === 0
        ? <div className="db-trend-empty">No fuel entries in this period</div>
        : (pumps || []).map((p, i) => {
            const maxSales = pumps[0]?.total_sales || 1;
            const pct = Math.round((p.total_sales / maxSales) * 100);
            return (
              <div key={i} className="db-pump-row">
                <div className="db-pump-rank">#{i + 1}</div>
                <div className="db-pump-info">
                  <div className="db-pump-name">{p.pump_id || "—"}</div>
                  <div className="db-pump-bar-wrap">
                    <div className="db-pump-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="db-pump-sales">{fmtMoney(p.total_sales)}</div>
              </div>
            );
          })
    }
  </div>
);

/* ── Plant Map Section ───────────────────────────────────────────── */
const PlantMapSection = ({ plants, loading }) => {
  const [selected, setSelected] = useState(null);

  if (loading) return (
    <div className="db-map-card">
      <div className="db-card-title">Dispatch Plant Overview</div>
      <div className="db-skeleton-chart" style={{ height: 260 }} />
    </div>
  );

  return (
    <div className="db-map-card">
      <div className="db-map-header">
        <div className="db-card-title" style={{ marginBottom: 0 }}>Dispatch Plant Overview</div>
        <span className="db-map-hint">Click a plant for breakdown</span>
      </div>

      {(!plants || plants.length === 0) ? (
        <div className="db-trend-empty" style={{ height: 120 }}>No plant data available</div>
      ) : (
        <div className="db-map-grid">
          {plants.map((p, i) => (
            <button
              key={i}
              className={`db-plant-pin${selected?.plant === p.plant ? " db-plant-pin--active" : ""}`}
              onClick={() => setSelected(prev => prev?.plant === p.plant ? null : p)}
            >
              <div className="db-plant-pin-count">{p.undelivered}</div>
              <div className="db-plant-pin-name">{p.plant}</div>
              <div className="db-plant-pin-label">undelivered</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="db-plant-detail">
          <div className="db-plant-detail-header">
            <span className="db-plant-detail-name">📍 {selected.plant}</span>
            <button className="db-plant-detail-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="db-plant-detail-grid">
            <div className="db-plant-stat db-plant-stat--total">
              <div className="db-plant-stat-val">{selected.total}</div>
              <div className="db-plant-stat-lbl">Total</div>
            </div>
            <div className="db-plant-stat db-plant-stat--green">
              <div className="db-plant-stat-val">{selected.delivered}</div>
              <div className="db-plant-stat-lbl">Delivered</div>
            </div>
            <div className="db-plant-stat db-plant-stat--red">
              <div className="db-plant-stat-val">{selected.undelivered}</div>
              <div className="db-plant-stat-lbl">Undelivered</div>
            </div>
            <div className="db-plant-stat db-plant-stat--blue">
              <div className="db-plant-stat-val">{selected.running}</div>
              <div className="db-plant-stat-lbl">Running</div>
            </div>
            <div className="db-plant-stat db-plant-stat--amber">
              <div className="db-plant-stat-val">{selected.dispatched}</div>
              <div className="db-plant-stat-lbl">Dispatched</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [quickPeriod, setQuickPeriod] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  /* ── Load plant list for admin ── */
  useEffect(() => {
    if (!_isAdmin) return;
    apiFetch("/api/dashboard/plants")
      .then(r => r?.json())
      .then(j => { if (j?.success) setPlants(j.data); })
      .catch(() => {});
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

  /* ── Quick period select ── */
  const applyQuickPeriod = (period) => {
    const today = new Date();
    const todayStr = fmtDate(today);
    setQuickPeriod(period);
    setShowCustom(false);
    if (period === "1W") {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      setFrom(fmtDate(d)); setTo(todayStr);
    } else if (period === "6M") {
      const d = new Date(today); d.setMonth(d.getMonth() - 6);
      setFrom(fmtDate(d)); setTo(todayStr);
    } else if (period === "1Y") {
      const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
      setFrom(fmtDate(d)); setTo(todayStr);
    } else if (period === "custom") {
      setShowCustom(true);
    }
  };

  /* ── Clear filters ── */
  const clearFilters = () => {
    setFrom(""); setTo(""); setBranchFilter("");
    setQuickPeriod(""); setShowCustom(false);
  };

  const hasFilters = from || to || branchFilter;

  /* ── CSV Download ── */
  const downloadCSV = async () => {
    setCsvLoading(true);
    try {
      let url = "/api/dashboard/csv?";
      if (from) url += `from=${from}&`;
      if (to) url += `to=${to}&`;
      if (branchFilter) url += `plant_code=${branchFilter}&`;
      const res = await apiFetch(url);
      if (!res) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `dashboard_${from || "all"}_${to || "all"}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("CSV download error:", e);
    } finally {
      setCsvLoading(false);
    }
  };

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

          {/* Quick-select period buttons */}
          <div className="db-quick-periods">
            {["1W","6M","1Y"].map(p => (
              <button
                key={p}
                className={`db-period-btn${quickPeriod === p ? " db-period-btn--active" : ""}`}
                onClick={() => applyQuickPeriod(p)}
              >
                {p}
              </button>
            ))}
            <button
              className={`db-period-btn${quickPeriod === "custom" ? " db-period-btn--active" : ""}`}
              onClick={() => applyQuickPeriod("custom")}
            >
              Custom
            </button>
          </div>

          {/* Date range — visible when custom selected or has existing dates */}
          {(showCustom || (from && to && !["1W","6M","1Y"].includes(quickPeriod))) && (
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
          )}

          {hasFilters && (
            <button className="db-clear-btn" onClick={clearFilters}>
              ✕ Clear
            </button>
          )}

          {/* CSV Download */}
          <button className="db-csv-btn" onClick={downloadCSV} disabled={csvLoading}>
            {csvLoading ? "⏳" : "⬇"} CSV
          </button>
        </div>
      </div>

      {/* ── KPI Cards Row 1 — Shipments ── */}
      <div className="db-kpi-grid">
        <KPICard icon="🚚" label="Total Shipments"
          value={fmtNum(data?.totalShipments || 0)}
          sub={`${data?.activeCount || 0} active`} subLabel="in transit"
          accent="blue" loading={loading} />
        <KPICard icon="✅" label="Shipments Delivered"
          value={fmtNum(data?.deliveredShipments || 0)}
          sub={`${deliveryRate}%`} subLabel="delivery rate"
          accent="green" loading={loading} />
        <KPICard icon="⏳" label="Pending Shipments"
          value={fmtNum(data?.pendingCount || 0)}
          sub={`${data?.statusBreakdown?.APPROVAL || 0} in approval`} subLabel="awaiting admin"
          accent="amber" loading={loading} />
        <KPICard icon="❌" label="Rejected"
          value={fmtNum(data?.statusBreakdown?.REJECTED || 0)}
          accent="red" loading={loading} />
      </div>

      {/* ── KPI Cards Row 2 — Finance ── */}
      <div className="db-kpi-grid">
        <KPICard icon="💰" label="Total Fund Requests"
          value={fmtNum(data?.fundRequests?.count || 0)}
          sub={fmtMoney(data?.fundRequests?.amount || 0)} subLabel="total value"
          accent="orange" loading={loading} />
        <KPICard icon="⏳" label="Pending Funds"
          value={fmtNum(data?.pendingFunds?.count || 0)}
          sub={fmtMoney(data?.pendingFunds?.amount || 0)} subLabel="unpaid"
          accent="amber" loading={loading} />
        <KPICard icon="✅" label="Paid Funds"
          value={fmtNum(data?.paidFunds?.count || 0)}
          sub={fmtMoney(data?.paidFunds?.amount || 0)} subLabel="cleared"
          accent="green" loading={loading} />
        <KPICard icon="📦" label="Hold (Ready for Fund)"
          value={fmtNum(data?.statusBreakdown?.HOLD || 0)}
          sub={`${data?.statusBreakdown?.ACTIVE || 0} active`} subLabel="fund requested"
          accent="blue" loading={loading} />
      </div>

      {/* ── KPI Cards Row 3 — Petrol Pump Analytics ── */}
      <div className="db-kpi-grid">
        <KPICard icon="⛽" label="Total Fuel Sales"
          value={fmtMoney(data?.fuelStats?.total_sales || 0)}
          sub={`${data?.fuelStats?.pump_count || 0} pumps`} subLabel="active"
          accent="orange" loading={loading} />
        <KPICard icon="🛣️" label="Total Toll Generated"
          value={fmtMoney(data?.tollStats?.total_toll || 0)}
          accent="blue" loading={loading} />
        <KPICard icon="🧾" label="Total Tax Paid"
          value={fmtMoney(data?.taxStats?.total_tax || 0)}
          accent="amber" loading={loading} />
        <KPICard icon="🏪" label="Petrol Pumps Used"
          value={fmtNum(data?.fuelStats?.pump_count || 0)}
          sub={fmtMoney(data?.fuelStats?.total_sales || 0)} subLabel="total sales"
          accent="green" loading={loading} />
      </div>

      {/* ── Charts Row ── */}
      <div className="db-charts-row">
        <TrendChart trend={data?.monthlyTrend} loading={loading} />
        <StatusBar breakdown={data?.statusBreakdown} loading={loading} />
      </div>

      {/* ── Finance + Top Pumps Row ── */}
      <div className="db-bottom-row">
        <FinanceSummary pendingFunds={data?.pendingFunds} paidFunds={data?.paidFunds} loading={loading} />
        <TopPumpsCard pumps={data?.topPumps} loading={loading} />
      </div>

      {/* ── Dispatch Plant Map ── */}
      <PlantMapSection plants={data?.plantMapData} loading={loading} />

    </div>
  );
}
