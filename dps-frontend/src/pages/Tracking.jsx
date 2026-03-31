// src/pages/Tracking.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, getUser } from "../utils/apiClient";
import "../assets/css/Tracking.css";

const API = import.meta.env.VITE_API_URL;

const STATUSES = ["Running", "Accident", "Other", "Delivered"];

const STATUS_STYLE = {
    Running: { bg: "#eff6ff", color: "#2563eb", dot: "#3b82f6" },
    Accident: { bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
    Other: { bg: "#f5f3ff", color: "#7c3aed", dot: "#8b5cf6" },
    Delivered: { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
    Dispatched: { bg: "#f9fafb", color: "#6b7280", dot: "#9ca3af" },
};

const StatusChip = ({ status }) => {
    const s = STATUS_STYLE[status] || STATUS_STYLE.Dispatched;
    return (
        <span className="tr-status-chip" style={{ background: s.bg, color: s.color }}>
            <span className="tr-status-dot" style={{ background: s.dot }} />
            {status || "—"}
        </span>
    );
};

const fmtDate = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
};

/* ══════════════════════════════════════════════════════════════════
   POD UPLOAD MODAL
══════════════════════════════════════════════════════════════════ */
const PodModal = ({ shipment, onUploaded, onClose }) => {
    const [file, setFile] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const inputRef = useRef();

    const handleFile = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
            setErr("Only JPG / PNG allowed"); return;
        }
        if (f.size > 300 * 1024) {
            setErr("Max file size is 300 KB"); return;
        }
        setErr(""); setFile(f);
    };

    const handleSubmit = async () => {
        if (!file) { setErr("Please upload a POD image first"); return; }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("pod", file);
            const res = await apiFetch(`/api/shipments/${shipment.shipment_id}/pod`, {
                method: "POST",
                body: fd,
            });
            if (!res) return;
            const json = await res.json();
            if (json.success) {
                onUploaded(json.pod_path);
            } else {
                setErr(json.message || "Upload failed");
            }
        } catch {
            setErr("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tr-modal-backdrop" onClick={onClose}>
            <div className="tr-modal" onClick={e => e.stopPropagation()}>
                <div className="tr-modal-header">
                    <h3 className="tr-modal-title">Upload Proof of Delivery</h3>
                    <button className="tr-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="tr-modal-body">
                    <p className="tr-modal-desc">
                        Shipment <strong>#{shipment.shipment_no}</strong> — POD is required before marking as Delivered.
                    </p>
                    <div
                        className={`tr-dropzone ${file ? "tr-dropzone--ready" : ""}`}
                        onClick={() => inputRef.current?.click()}
                    >
                        {file
                            ? <><span className="tr-dz-icon">✅</span><span className="tr-dz-name">{file.name}</span></>
                            : <><span className="tr-dz-icon">📎</span><span className="tr-dz-hint">Click to choose POD image</span><span className="tr-dz-sub">JPG, PNG · Max 300 KB</span></>
                        }
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            style={{ display: "none" }}
                            onChange={handleFile}
                        />
                    </div>
                    {err && <p className="tr-modal-err">⚠ {err}</p>}
                </div>
                <div className="tr-modal-footer">
                    <button className="tr-btn tr-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="tr-btn tr-btn--primary" onClick={handleSubmit} disabled={loading}>
                        {loading ? "Uploading…" : "Upload & Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   STATUS UPDATE MODAL
══════════════════════════════════════════════════════════════════ */
const StatusModal = ({ shipment, onUpdated, onClose }) => {
    const [selected, setSelected] = useState(shipment.current_status || "");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [showPodModal, setShowPodModal] = useState(false);
    const [podPath, setPodPath] = useState(shipment.pod_path || null);

    const hasPod = !!podPath;

    const handleUpdate = async (statusToSave = selected) => {
        if (!statusToSave) { setErr("Select a status"); return; }

        // If Delivered and no POD — show POD modal first
        if (statusToSave === "Delivered" && !hasPod) {
            setShowPodModal(true);
            return;
        }

        setLoading(true);
        setErr("");
        try {
            const res = await apiFetch(`/api/shipments/${shipment.shipment_id}/tracking-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: statusToSave }),
            });
            if (!res) return;
            const json = await res.json();
            if (json.success) {
                onUpdated(shipment.shipment_id, statusToSave);
                onClose();
            } else {
                // If backend says POD required (double safety)
                if (json.requiresPOD) { setShowPodModal(true); return; }
                setErr(json.message || "Update failed");
            }
        } catch {
            setErr("Network error");
        } finally {
            setLoading(false);
        }
    };

    // After POD uploaded — continue with Delivered status
    const handlePodUploaded = (path) => {
        setPodPath(path);
        setShowPodModal(false);
        // Now proceed with Delivered
        handleUpdate("Delivered");
    };

    return (
        <>
            <div className="tr-modal-backdrop" onClick={onClose}>
                <div className="tr-modal tr-modal--status" onClick={e => e.stopPropagation()}>
                    <div className="tr-modal-header">
                        <div>
                            <h3 className="tr-modal-title">Update Shipment Status</h3>
                            <p className="tr-modal-ship-no">#{shipment.shipment_no} — {shipment.dispatch_plant} → {shipment.delivery_location}</p>
                        </div>
                        <button className="tr-modal-close" onClick={onClose}>✕</button>
                    </div>
                    <div className="tr-modal-body">
                        <p className="tr-status-select-label">Select new status:</p>
                        <div className="tr-status-options">
                            {STATUSES.map(s => {
                                const style = STATUS_STYLE[s] || STATUS_STYLE.Dispatched;
                                const isSelected = selected === s;
                                return (
                                    <button
                                        key={s}
                                        className={`tr-status-option ${isSelected ? "tr-status-option--selected" : ""}`}
                                        style={isSelected ? { background: style.bg, borderColor: style.dot, color: style.color } : {}}
                                        onClick={() => setSelected(s)}
                                    >
                                        <span className="tr-status-dot" style={{ background: style.dot }} />
                                        {s}
                                        {s === "Delivered" && !hasPod && (
                                            <span className="tr-pod-required">📎 POD required</span>
                                        )}
                                        {s === "Delivered" && hasPod && (
                                            <span className="tr-pod-done">✅ POD ready</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {err && <p className="tr-modal-err">⚠ {err}</p>}
                    </div>
                    <div className="tr-modal-footer">
                        <button className="tr-btn tr-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
                        <button
                            className="tr-btn tr-btn--primary"
                            onClick={() => handleUpdate()}
                            disabled={loading || !selected}
                        >
                            {loading ? "Saving…" : "Update Status"}
                        </button>
                    </div>
                </div>
            </div>

            {showPodModal && (
                <PodModal
                    shipment={shipment}
                    onUploaded={handlePodUploaded}
                    onClose={() => setShowPodModal(false)}
                />
            )}
        </>
    );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN TRACKING PAGE
══════════════════════════════════════════════════════════════════ */
export default function Tracking() {
    const user = getUser();
    const isAdmin = user?.role === "admin";

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionRow, setActionRow] = useState(null);
    const [viewPod, setViewPod] = useState(null);
    const [toast, setToast] = useState("");

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch("/api/shipments/tracking");
            if (!res) return;
            const json = await res.json();
            setRows(json.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleUpdated = (shipmentId, newStatus) => {
        setRows(prev => prev.map(r =>
            r.shipment_id === shipmentId
                ? {
                    ...r,
                    current_status: newStatus,
                    delivery_date: newStatus === "Delivered"
                        ? new Date().toISOString().slice(0, 10)
                        : r.delivery_date,
                }
                : r
        ));
        showToast(`✅ Status updated to ${newStatus}`);
    };

    const canEdit = (row) => {
        // Branch cannot edit Delivered shipments
        if (row.current_status === "Delivered" && user?.role === "branch") return false;
        return true;
    };

    const filtered = rows.filter(r => {
        const q = search.toLowerCase();
        return !q
            || String(r.shipment_no).toLowerCase().includes(q)
            || (r.billing_doc_number || "").toLowerCase().includes(q)
            || (r.dispatch_plant || "").toLowerCase().includes(q)
            || (r.delivery_location || "").toLowerCase().includes(q);
    });

    return (
        <div className="tr-page">
            {/* ── Header ── */}
            <div className="tr-header">
                <div>
                    <h2 className="tr-title">Shipment Tracking</h2>
                    <p className="tr-subtitle">{filtered.length} active shipments</p>
                </div>
                <div className="tr-header-right">
                    <div className="tr-search-wrap">
                        <span className="tr-search-icon">⌕</span>
                        <input
                            className="tr-search"
                            placeholder="Search shipment no, route…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            {loading ? (
                <div className="tr-loading">
                    <div className="tr-spinner" /> Loading shipments…
                </div>
            ) : (
                <div className="tr-table-card">
                    <table className="tr-table">
                        <thead>
                            <tr>
                                <th>Shipment No</th>
                                <th>Billing Doc No</th>
                                <th>Route</th>
                                <th>Dispatch Date</th>
                                <th>Expected Delivery</th>
                                <th>Delivery Date</th>
                                <th>Status</th>
                                <th>POD</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="tr-empty-row">
                                        <div className="tr-empty-icon">🚚</div>
                                        No active shipments found
                                    </td>
                                </tr>
                            )}
                            {filtered.map(row => (
                                <tr
                                    key={row.shipment_id}
                                    className={row.current_status === "Delivered" ? "tr-row--delivered" : ""}
                                >
                                    <td>
                                        <span className="tr-ship-no">#{row.shipment_no}</span>
                                        {row.plant_code && (
                                            <span className="tr-plant-badge">{row.plant_code}</span>
                                        )}
                                    </td>
                                    <td className="tr-td-muted">{row.billing_doc_number || "—"}</td>
                                    <td>
                                        <span className="tr-route">
                                            {row.dispatch_plant || "—"}
                                            <span className="tr-route-arrow"> → </span>
                                            {row.delivery_location || "—"}
                                        </span>
                                    </td>
                                    <td className="tr-td-muted">{fmtDate(row.dispatch_date)}</td>
                                    <td>
                                        <span className={`tr-eta ${row.estimated_delivery_date &&
                                                row.current_status !== "Delivered" &&
                                                new Date(row.estimated_delivery_date) < new Date()
                                                ? "tr-eta--overdue" : ""
                                            }`}>
                                            {fmtDate(row.estimated_delivery_date)}
                                        </span>
                                    </td>
                                    <td className="tr-td-muted">
                                        {row.current_status === "Delivered"
                                            ? <span className="tr-delivered-date">✅ {fmtDate(row.delivery_date)}</span>
                                            : "—"
                                        }
                                    </td>
                                    <td><StatusChip status={row.current_status} /></td>
                                    <td>
                                        {row.pod_path ? (
                                            <button
                                                className="tr-pod-btn"
                                                onClick={() => setViewPod(`${API}/${row.pod_path}`)}
                                            >
                                                🧾 View
                                            </button>
                                        ) : (
                                            <span className="tr-no-pod">—</span>
                                        )}
                                    </td>
                                    <td>
                                        {canEdit(row) ? (
                                            <button
                                                className="tr-action-btn"
                                                onClick={() => setActionRow(row)}
                                            >
                                                Update Status
                                            </button>
                                        ) : (
                                            <span className="tr-locked-badge">🔒 Admin only</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Status update modal ── */}
            {actionRow && (
                <StatusModal
                    shipment={actionRow}
                    onUpdated={handleUpdated}
                    onClose={() => setActionRow(null)}
                />
            )}

            {/* ── POD viewer ── */}
            {viewPod && (
                <div className="tr-modal-backdrop" onClick={() => setViewPod(null)}>
                    <div className="tr-pod-viewer" onClick={e => e.stopPropagation()}>
                        <button className="tr-modal-close tr-pod-close" onClick={() => setViewPod(null)}>✕</button>
                        <img src={viewPod} alt="Proof of Delivery" className="tr-pod-img" />
                    </div>
                </div>
            )}

            {toast && <div className="tr-toast">{toast}</div>}
        </div>
    );
}