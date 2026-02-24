import { useState } from "react";
import Papa from "papaparse";

/* ------------------ CONFIG ------------------ */
const REQUIRED_HEADERS = [
  "shipment_no",
  "shipment_date",
  "billing_doc_number",
  "billing_date",
  "chassis_no",
  "material_no",
  "dispatch_location",
  "delivery_location",
  "state",
  "allocation_date",
  "dispatch_date",
  "model",
  "dealer_name",
];

/* ------------------ HELPERS ------------------ */
const normalizeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
};

export default function BulkUploadModal({ onClose, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [headerError, setHeaderError] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ------------------ FILE HANDLER ------------------ */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        if (!validateHeaders(meta.fields)) return;
        validateRows(data);
      },
    });
  };

  /* ------------------ HEADER VALIDATION ------------------ */
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

  /* ------------------ ROW VALIDATION ------------------ */
  const validateRows = (data = []) => {
    const shipmentSet = new Set();

    const processed = data.map((row, index) => {
      let status = "READY"; // frontend-only state
      let reason = "";

      // Normalize dates
      // row.shipment_date = normalizeDate(row.shipment_date);
      // row.billing_date = normalizeDate(row.billing_date);
      // row.allocation_date = normalizeDate(row.allocation_date);
      // row.dispatch_date = normalizeDate(row.dispatch_date);

      // Required field check
      for (const field of REQUIRED_HEADERS) {
        if (!row[field]) {
          status = "ERROR";
          reason = `Missing ${field}`;
          break;
        }
      }

      // Date format validation
      if (status !== "ERROR" && !row.dispatch_date) {
        status = "ERROR";
        reason = "Invalid dispatch_date format";
      }

      // Duplicate shipment_no in CSV
      if (status !== "ERROR") {
        if (shipmentSet.has(row.shipment_no)) {
          status = "ERROR";
          reason = "Duplicate shipment_no in CSV";
        } else {
          shipmentSet.add(row.shipment_no);
        }
      }

      return {
        ...row,
        _row: index + 2, // CSV row number
        _status: status, // READY | ERROR
        _reason: reason,
      };
    });

    setRows(processed);
  };

  /* ------------------ COMMIT ------------------ */
  const commitUpload = async () => {
    setLoading(true);
    try {
      const validRows = rows.filter(r => r._status !== "ERROR");

      const res = await fetch(
        "http://localhost:4000/api/shipments/bulk/commit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: validRows }),
        }
      );

      const json = await res.json();
      console.log("Bulk commit result:", json);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Bulk commit failed:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ UI ------------------ */
  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-6xl">
        <div className="modal-header">
          <h3>Bulk CSV Upload – Preview</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <input type="file" accept=".csv" onChange={handleFile} />

          {headerError && (
            <div className="error-box">{headerError}</div>
          )}

          {rows.length > 0 && (
            <table className="preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Shipment No</th>
                  <th>Route</th>
                  <th>Dispatch Date</th>
                  <th>Preview Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r._row}>
                    <td>{r._row}</td>
                    <td>{r.shipment_no}</td>
                    <td>
                      {r.dispatch_location} → {r.delivery_location}
                    </td>
                    <td>{r.dispatch_date || "—"}</td>
                    <td>
                      <span className={`badge ${r._status.toLowerCase()}`}>
                        {r._status}
                      </span>
                      {r._reason && (
                        <div className="muted">{r._reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={loading || !rows.some(r => r._status !== "ERROR")}
            onClick={commitUpload}
          >
            {loading ? "Uploading..." : "Upload Valid Rows"}
          </button>
        </div>
      </div>
    </div>
  );
}
