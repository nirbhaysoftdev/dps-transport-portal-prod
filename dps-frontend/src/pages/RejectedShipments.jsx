import { useEffect, useState, useCallback } from "react";
import "../assets/css/RejectedShipments.css";
import "../assets/css/shipments.css";
import { apiFetch } from "../utils/apiClient";
import { useShipmentFilters } from "../components/shared/ShipmentFilters";

/* ── Move-to-Operations confirm dialog ──────────────────────────── */
const MoveConfirm = ({ shipment, onConfirm, onCancel, loading }) => (
  <div className="rs-overlay">
    <div className="rs-confirm-card">
      <div className="rs-confirm-icon">🔄</div>
      <h3 className="rs-confirm-title">Move to Operations?</h3>
      <p className="rs-confirm-msg">
        Shipment <strong>#{shipment.shipment_no}</strong> will be moved back to{" "}
        <strong>Pending Approval</strong> queue.
      </p>
      <div className="rs-confirm-actions">
        <button className="rs-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="rs-btn-confirm" onClick={onConfirm} disabled={loading}>
          {loading ? "Moving…" : "Yes, Move to Operations"}
        </button>
      </div>
    </div>
  </div>
);

/* ── Success toast ───────────────────────────────────────────────── */
const Toast = ({ msg, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="rs-toast">✅ {msg}</div>;
};

/* ── Empty state ─────────────────────────────────────────────────── */
const EmptyState = () => (
  <div className="rs-empty">
    <div className="rs-empty-icon">🗂️</div>
    <h3 className="rs-empty-title">No Rejected Shipments</h3>
    <p className="rs-empty-sub">All shipments are in good shape — nothing was rejected.</p>
  </div>
);

/* ── Status badge ────────────────────────────────────────────────── */
const Badge = ({ label, cls }) => (
  <span className={`rs-badge rs-badge--${cls}`}>{label}</span>
);

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmt = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const money = (v) =>
  v != null && v !== "" && Number(v) > 0
    ? `₹${Number(v).toLocaleString("en-IN")}`
    : "—";

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function RejectedShipments() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [movingRow, setMovingRow] = useState(null);
  const [movingLoader, setMovingLoader] = useState(false);
  const [toast, setToast]         = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await apiFetch(`/api/shipments/rejected`);
      if (!res || !res.ok) { setRows([]); setError("Failed to load"); return; }
      const json = await res.json();
      if (json.success) setRows(json.data);
      else setError("Failed to load rejected shipments.");
    } catch {
      setError("Network error — could not fetch rejected shipments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Use shared filters
  const { filterBar, sorted, SortTh } = useShipmentFilters(rows, {
    searchFields: ["shipment_no", "chassis_no", "raw_dealer_name", "raw_dispatch_plant", "raw_delivery_location"],
    showLocationFilters: false,
    defaultSort: { col: "created_at", dir: "desc" },
  });

  /* ── Move to Operations ── */
  const confirmMove = async () => {
    if (!movingRow) return;
    setMovingLoader(true);
    try {
      const res  = await apiFetch(`/api/shipments/move-to-operations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ shipment_id: movingRow.shipment_id }),
      });
      const json = await res.json();
      if (json.success) {
        setRows(r => r.filter(x => x.shipment_id !== movingRow.shipment_id));
        setToast(`Shipment #${movingRow.shipment_no} moved to Pending Approval.`);
      }
    } catch {
      /* silently ignore */
    } finally {
      setMovingLoader(false);
      setMovingRow(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="rs-page">
      {/* Header */}
      <div className="rs-header">
        <div className="rs-header-left">
          <h1 className="rs-title">Rejected Shipments</h1>
          <p className="rs-subtitle">
            Shipments rejected during approval — move back to Pending to re-process.
          </p>
        </div>
        <div className="rs-header-right">
          <div className="rs-count-chip">
            <span className="rs-count-num">{rows.length}</span>
            <span className="rs-count-label">Rejected</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      {!loading && rows.length > 0 && filterBar}

      {/* States */}
      {loading && (
        <div className="rs-loader">
          <div className="rs-spinner" />
          <span>Loading rejected shipments…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rs-error">
          <span>⚠️ {error}</span>
          <button onClick={fetchData}>Retry</button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && <EmptyState />}

      {/* Table */}
      {!loading && !error && sorted.length > 0 && (
        <div className="rs-table-wrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>#</th>
                <SortTh col="shipment_no">Shipment No</SortTh>
                <SortTh col="created_at">Date</SortTh>
                <th>Route</th>
                <th>Vehicle</th>
                <SortTh col="raw_dealer_name">Dealer</SortTh>
                <SortTh col="chassis_no">Chassis No</SortTh>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr key={row.shipment_id}>
                  <td className="rs-td-idx">{idx + 1}</td>
                  <td className="rs-td-no">
                    <span className="rs-shipment-no">#{row.shipment_no}</span>
                  </td>
                  <td>{fmt(row.dispatch_date || row.created_at)}</td>
                  <td>
                    <div className="rs-route">
                      <span className="rs-origin">{row.raw_dispatch_plant || row.origin || "—"}</span>
                      <span className="rs-arrow">→</span>
                      <span className="rs-dest">{row.raw_delivery_location || row.destination || "—"}</span>
                    </div>
                  </td>
                  <td>{row.raw_vehicle_material_no || row.vehicle_no || "—"}</td>
                  <td>{row.raw_dealer_name || row.dealer_name || "—"}</td>
                  <td>{row.chassis_no || "—"}</td>
                  <td>
                    <Badge label="Rejected" cls="rejected" />
                  </td>
                  <td>
                    <button
                      className="rs-move-btn"
                      onClick={() => setMovingRow(row)}
                    >
                      Move to Operations
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="rs-no-results">
              No results match your filters.
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      {movingRow && (
        <MoveConfirm
          shipment={movingRow}
          onConfirm={confirmMove}
          onCancel={() => setMovingRow(null)}
          loading={movingLoader}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast("")} />}
    </div>
  );
}