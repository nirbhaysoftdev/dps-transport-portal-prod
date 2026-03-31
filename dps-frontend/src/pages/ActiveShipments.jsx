import { useEffect, useState, useCallback, useMemo } from "react";
import "../assets/css/ActiveShipments.css";
import { apiFetch, getUser } from "../utils/apiClient";
import ShipmentView from "../components/shipments/ShipmentView";

const API = import.meta.env.VITE_API_URL;

/* ── Helpers ── */
const fmt = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const money = (v) =>
  v != null && Number(v) > 0
    ? `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`
    : "—";

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE SHIPMENTS PAGE — Fund Tracking
═══════════════════════════════════════════════════════════════════ */
export default function ActiveShipments() {
  const user = getUser();
  const isAdmin = user?.role === "admin";

  const [rows, setRows]         = useState([]);
  const [summary, setSummary]   = useState({ totalGenerated: 0, totalPaid: 0, totalPending: 0 });
  const [loading, setLoading]   = useState(true);
  const [viewingId, setViewingId] = useState(null);
  const [slipView, setSlipView] = useState(null); // filename of paid slip to display

  // ── Filters ──
  const [search, setSearch]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  // ── Sorting ──
  const [sortCol, setSortCol]   = useState("dispatch_date");
  const [sortDir, setSortDir]   = useState("desc");

  /* ── Fetch ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/shipments/active`;
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to", dateTo);
      if (params.toString()) url += `?${params}`;

      const res = await apiFetch(url);
      if (!res || !res.ok) { setRows([]); setSummary({ totalGenerated: 0, totalPaid: 0, totalPending: 0 }); return; }
      const json = await res.json();
      setRows(json.data || []);
      setSummary(json.summary || { totalGenerated: 0, totalPaid: 0, totalPending: 0 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  /* ── Search filter ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r =>
      String(r.shipment_no ?? "").toLowerCase().includes(q) ||
      String(r.billing_doc_number ?? "").toLowerCase().includes(q) ||
      String(r.chassis_no ?? "").toLowerCase().includes(q) ||
      String(r.dispatch_plant ?? "").toLowerCase().includes(q) ||
      String(r.delivery_location ?? "").toLowerCase().includes(q) ||
      String(r.dealer_name ?? "").toLowerCase().includes(q) ||
      String(r.material_no ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  /* ── Sorting ── */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === "grand_total" || sortCol === "base_total") {
        va = Number(va || 0); vb = Number(vb || 0);
      } else {
        va = String(va ?? "").toLowerCase();
        vb = String(vb ?? "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => (
    <span className="as-sort-icon">
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  /* ── View detail ── */
  if (viewingId) {
    return (
      <ShipmentView
        shipmentId={viewingId}
        onBack={() => { setViewingId(null); load(); }}
      />
    );
  }

  return (
    <div className="as-page">
      {/* Header */}
      <div className="as-header">
        <div>
          <h1 className="as-title">Active Shipments</h1>
          <p className="as-subtitle">Fund tracking for activated shipments</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="as-summary">
        <div className="as-summary-card as-summary-card--generated">
          <div className="as-summary-label">Total Fund Generated</div>
          <div className="as-summary-value">{money(summary.totalGenerated)}</div>
        </div>
        <div className="as-summary-card as-summary-card--paid">
          <div className="as-summary-label">Total Paid</div>
          <div className="as-summary-value">{money(summary.totalPaid)}</div>
        </div>
        <div className="as-summary-card as-summary-card--pending">
          <div className="as-summary-label">Total Pending</div>
          <div className="as-summary-value">{money(summary.totalPending)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="as-toolbar">
        <div className="as-search-wrap">
          <span className="as-search-icon">🔍</span>
          <input
            className="as-search"
            placeholder="Search by shipment no, billing doc, chassis, dealer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="as-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="as-filter-group">
          <span className="as-filter-label">Dispatch</span>
          <input className="as-date-input" type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} />
          <span className="as-filter-label">to</span>
          <input className="as-date-input" type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)} />
        </div>

        <button className="as-refresh-btn" onClick={load}>↻ Refresh</button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="as-loader">
          <div className="as-spinner" />
          <span>Loading active shipments…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="as-empty">
          <div className="as-empty-icon">📋</div>
          <p>{search || dateFrom || dateTo ? "No results match your filters." : "No active shipments yet."}</p>
        </div>
      )}

      {/* Table */}
      {!loading && sorted.length > 0 && (
        <div className="as-table-wrap">
          <table className="as-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("shipment_no")} className={sortCol === "shipment_no" ? "as-sorted" : ""}>
                  Shipment No <SortIcon col="shipment_no" />
                </th>
                <th onClick={() => toggleSort("dispatch_plant")} className={sortCol === "dispatch_plant" ? "as-sorted" : ""}>
                  Route <SortIcon col="dispatch_plant" />
                </th>
                <th onClick={() => toggleSort("dealer_name")} className={sortCol === "dealer_name" ? "as-sorted" : ""}>
                  Dealer <SortIcon col="dealer_name" />
                </th>
                <th onClick={() => toggleSort("material_no")} className={sortCol === "material_no" ? "as-sorted" : ""}>
                  Vehicle <SortIcon col="material_no" />
                </th>
                <th onClick={() => toggleSort("dispatch_date")} className={sortCol === "dispatch_date" ? "as-sorted" : ""}>
                  Dispatch Date <SortIcon col="dispatch_date" />
                </th>
                <th onClick={() => toggleSort("current_status")} className={sortCol === "current_status" ? "as-sorted" : ""}>
                  Status <SortIcon col="current_status" />
                </th>
                <th onClick={() => toggleSort("grand_total")} className={sortCol === "grand_total" ? "as-sorted" : ""}>
                  Total Amount <SortIcon col="grand_total" />
                </th>
                <th onClick={() => toggleSort("finance_payment_status")} className={sortCol === "finance_payment_status" ? "as-sorted" : ""}>
                  Payment <SortIcon col="finance_payment_status" />
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const isPaid = row.finance_payment_status === "paid";
                const hasFund = !!row.finance_id;
                return (
                  <tr key={row.shipment_id} className={isPaid ? "as-row-paid" : ""}>
                    <td><span className="as-shipno">#{row.shipment_no}</span></td>
                    <td>{row.dispatch_plant || "—"} → {row.delivery_location || "—"}</td>
                    <td>{row.dealer_name || "—"}</td>
                    <td>{row.material_no || "—"}</td>
                    <td>{fmt(row.dispatch_date)}</td>
                    <td>
                      <span className={`status ${row.current_status?.toLowerCase() || ""}`}>
                        {row.current_status || "—"}
                      </span>
                    </td>
                    <td className="as-amount">{money(row.grand_total)}</td>
                    <td>
                       {isPaid ? (
                        <div className="as-paid-cell">
                          <span className="as-badge as-badge--paid">✓ Paid</span>
                          {row.transaction_slip && (
                            <button
                              className="as-slip-btn"
                              onClick={() => setSlipView(row.transaction_slip)}
                            >
                              View Slip 🧾
                            </button>
                          )}
                        </div>
                      ) : hasFund ? (
                        <span className="as-badge as-badge--pending">⏳ Pending</span>
                      ) : (
                        <span className="as-badge as-badge--no-fund">No Fund</span>
                      )}
                    </td>
                    <td>
                      <button className="as-view-btn" onClick={() => setViewingId(row.shipment_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Slip Viewer Overlay */}
      {slipView && <SlipViewerOverlay slip={slipView} onClose={() => setSlipView(null)} />}
    </div>
  );
}

/* ── Inline Slip Viewer Overlay ── */
function SlipViewerOverlay({ slip, onClose }) {
  return (
    <div
      className="as-slip-overlay"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -16, right: -16,
            background: "#fff", border: "none", borderRadius: "50%",
            width: 34, height: 34, cursor: "pointer", fontSize: 16,
            fontWeight: 700, boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >✕</button>
        <img
          src={`${API}/uploads/slips/${slip}`}
          alt="Paid Transaction Slip"
          style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
        />
      </div>
    </div>
  );
}
