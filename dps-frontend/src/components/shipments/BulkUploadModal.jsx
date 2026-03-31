import { useState } from "react";
import Papa from "papaparse";
import "../../assets/css/BulkUploadModal.css";
import { apiFetch } from "../../utils/apiClient";

/* ── Required headers ───────────────────────────────────────────── */
const REQUIRED_HEADERS = [
  "shipment_no", "shipment_date", "billing_doc_number", "billing_date",
  "chassis_no", "material_no", "dispatch_location", "delivery_location",
  "state", "allocation_date", "dispatch_date", "model", "dealer_name",
];

export default function BulkUploadModal({ onClose, onSuccess }) {
  const [rows, setRows]           = useState([]);
  const [headerError, setHeaderError] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [summary, setSummary]     = useState(null); // post-commit summary

  /* ── File handler ────────────────────────────────────────────── */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!validateHeaders(meta.fields)) return;
        validateRows(data);
      },
    });
  };

  /* ── Header validation ───────────────────────────────────────── */
  const validateHeaders = (headers = []) => {
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length) {
      setHeaderError(`Missing required columns: ${missing.join(", ")}`);
      setRows([]);
      return false;
    }
    setHeaderError(null);
    return true;
  };

  /* ── Row validation (frontend only) ─────────────────────────── */
  const validateRows = (data = []) => {
    const shipmentSet = new Set();

    const processed = data.map((row, index) => {
      let status = "READY";
      let reason = "";

      for (const field of REQUIRED_HEADERS) {
        if (!row[field]) {
          status  = "ERROR";
          reason  = `Missing ${field}`;
          break;
        }
      }

      if (status !== "ERROR") {
        if (shipmentSet.has(row.shipment_no)) {
          status = "ERROR";
          reason = "Duplicate shipment_no in CSV";
        } else {
          shipmentSet.add(row.shipment_no);
        }
      }

      return { ...row, _row: index + 2, _status: status, _reason: reason };
    });

    setRows(processed);
  };

  /* ── Commit ──────────────────────────────────────────────────── */
  const commitUpload = async () => {
    setLoading(true);
    setSummary(null);
    try {
      const validRows = rows.filter(r => r._status !== "ERROR");

      const res  = await apiFetch(`/api/shipments/bulk/commit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: validRows }),
      });

      const json = await res.json();

      if (json.success) {
        setSummary({
          total:   json.inserted_count || 0,
          hold:    json.hold_count     || 0,   // matched → HOLD
          pending: json.pending_count  || 0,
          failed:  json.failed_count   || 0,
        });
        if (onSuccess) onSuccess();
        // Don't close yet — let user read the summary
      }
    } catch (err) {
      console.error("Bulk commit failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const validCount = rows.filter(r => r._status !== "ERROR").length;
  const errorCount = rows.filter(r => r._status === "ERROR").length;

  /* ── UI ──────────────────────────────────────────────────────── */
  return (
    <div className="bum-overlay">
      <div className="bum-modal">

        {/* Header */}
        <div className="bum-header">
          <a
  href="/templates/shipment_template.csv"
  download
  className="template-btn"
>
  ⬇ Download Template
</a>
          <h3 className="bum-title">Bulk CSV Upload</h3>
          <button className="bum-close" onClick={onClose}>✕</button>
        </div>

        <div className="bum-body">

          {/* File input */}
          <label className="bum-file-area">
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
            <span className="bum-file-icon">📂</span>
            <span className="bum-file-text">Click to choose a CSV file</span>
            <span className="bum-file-hint">Must match template columns exactly</span>
          </label>

          {/* Header error */}
          {headerError && (
            <div className="bum-alert bum-alert-error">{headerError}</div>
          )}

          {/* Row counts */}
          {rows.length > 0 && !summary && (
            <div className="bum-counts">
              <span className="bum-count bum-count-total">Total: {rows.length}</span>
              <span className="bum-count bum-count-ready">✓ Valid: {validCount}</span>
              {errorCount > 0 && <span className="bum-count bum-count-error">✕ Errors: {errorCount}</span>}
            </div>
          )}

          {/* Post-commit summary */}
          {summary && (
            <div className="bum-summary">
              <div className="bum-summary-title">🎉 Upload Complete</div>
              <div className="bum-summary-grid">
                <div className="bum-summary-card bum-sc-total">
                  <span className="bum-sc-num">{summary.total}</span>
                  <span className="bum-sc-label">Total Uploaded</span>
                </div>
                <div className="bum-summary-card bum-sc-active">
                  <span className="bum-sc-num">{summary.hold}</span>
                  <span className="bum-sc-label">On Hold (Matched)</span>
                </div>
                <div className="bum-summary-card bum-sc-pending">
                  <span className="bum-sc-num">{summary.pending}</span>
                  <span className="bum-sc-label">Pending Approval</span>
                </div>
                {summary.failed > 0 && (
                  <div className="bum-summary-card bum-sc-failed">
                    <span className="bum-sc-num">{summary.failed}</span>
                    <span className="bum-sc-label">Failed to Insert</span>
                  </div>
                )}
              </div>
              {summary.hold > 0 && (
                <p className="bum-summary-note" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
                  ℹ {summary.hold} shipment{summary.hold !== 1 ? "s" : ""} matched and are On Hold — fill driver + fuel + toll + tax, then Generate Fund Request to activate.
                </p>
              )}
              {summary.pending > 0 && (
                <p className="bum-summary-note">
                  ℹ {summary.pending} shipment{summary.pending !== 1 ? "s" : ""} need admin approval — route or vehicle not matched.
                </p>
              )}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="bum-table-wrap">
              <table className="bum-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Shipment No</th>
                    <th>Route</th>
                    <th>Dispatch Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r._row} className={r._status === "ERROR" ? "bum-row-error" : ""}>
                      <td>{r._row}</td>
                      <td className="bum-shipno">{r.shipment_no}</td>
                      <td>{r.dispatch_location} → {r.delivery_location}</td>
                      <td>{r.dispatch_date || "—"}</td>
                      <td>
                        <span className={`bum-badge bum-badge-${r._status.toLowerCase()}`}>
                          {r._status}
                        </span>
                        {r._reason && <div className="bum-reason">{r._reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bum-footer">
          <button className="bum-btn-cancel" onClick={onClose}>
            {summary ? "Close" : "Cancel"}
          </button>
          {!summary && (
            <button
              className="bum-btn-upload"
              disabled={loading || validCount === 0}
              onClick={commitUpload}
            >
              {loading
                ? <><span className="bum-spinner" /> Uploading…</>
                : `Upload ${validCount} Valid Row${validCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}