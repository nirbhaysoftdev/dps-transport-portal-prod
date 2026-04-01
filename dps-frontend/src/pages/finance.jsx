// Finance.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, getUser, isAdmin, isFinance, canMakePayment } from "../utils/apiClient";
import "../assets/css/finance.css";

const API = import.meta.env.VITE_API_URL;

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */

const fmtMoney = (n) =>
  n > 0
    ? `₹\u00A0${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`
    : "₹\u00A00";

const fmtDate = (d) => {
  if (!d) return "—";
  // Parse YYYY-MM-DD directly to avoid UTC→local timezone shift
  const str = typeof d === "string" ? d : d.toISOString();
  const [year, month, day] = str.slice(0, 10).split("-");
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(month) - 1]} ${year}`;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── Status chips ────────────────────────────────────────────────── */
const StatusChip = ({ status }) => (
  <span className={`fn-chip fn-chip--${status}`}>
    {status === "paid" ? "Paid" : "Pending"}
  </span>
);

/* ── Payment modal ───────────────────────────────────────────────── */
const PayModal = ({ title, onConfirm, onClose, loading }) => {
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const inputRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      setErr("Only PNG/JPG allowed"); return;
    }
    if (f.size > 300 * 1024) {
      setErr("File too large — max 300 KB"); return;
    }
    setErr(""); setFile(f);
  };

  const submit = () => {
    if (!file) { setErr("Please upload transaction slip"); return; }
    onConfirm(file);
  };

  return (
    <div className="fn-modal-backdrop" onClick={onClose}>
      <div className="fn-modal" onClick={e => e.stopPropagation()}>
        <div className="fn-modal-header">
          <span className="fn-modal-title">{title}</span>
          <button className="fn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="fn-modal-body">
          <p className="fn-modal-desc">
            Upload a transaction slip to confirm payment. Accepted: PNG / JPG · Max 300 KB
          </p>
          <div
            className={`fn-dropzone ${file ? "fn-dropzone--ready" : ""}`}
            onClick={() => inputRef.current.click()}
          >
            {file
              ? <><span className="fn-dz-icon">✅</span><span className="fn-dz-name">{file.name}</span></>
              : <><span className="fn-dz-icon">📎</span><span className="fn-dz-hint">Click to choose file</span></>
            }
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: "none" }}
              onChange={handleFile}
            />
          </div>
          {err && <p className="fn-modal-err">{err}</p>}
        </div>
        <div className="fn-modal-footer">
          <button className="fn-btn fn-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="fn-btn fn-btn--primary" onClick={submit} disabled={loading}>
            {loading ? "Processing…" : "Mark as Paid"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Add Extra Expense modal ─────────────────────────────────────── */
const ExtraModal = ({ shipmentId, onDone, onClose }) => {
  const [desc, setDesc] = useState("");
  const [clauseReason, setClauseReason] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setErr("Enter a valid amount"); return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/finance/${shipmentId}/extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, clause_reason: clauseReason, amount }),
      });
      if (!res) return; const json = await res.json();
      if (json.success) onDone();
      else setErr(json.message);
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fn-modal-backdrop" onClick={onClose}>
      <div className="fn-modal fn-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="fn-modal-header">
          <span className="fn-modal-title">Add Extra Expense</span>
          <button className="fn-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="fn-modal-body">
          <div className="fn-field">
            <label className="fn-label">Description <span className="fn-opt">(optional)</span></label>
            <input
              className="fn-input"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Parking charges"
            />
          </div>
          <div className="fn-field">
            <label className="fn-label">Clause / Reason <span className="fn-opt">(optional)</span></label>
            <textarea
              className="fn-input fn-textarea"
              value={clauseReason}
              onChange={e => setClauseReason(e.target.value)}
              placeholder="e.g. As per contract clause 4.2 — detention beyond 48 hrs"
              rows={3}
            />
          </div>
          <div className="fn-field">
            <label className="fn-label">Amount <span className="fn-req">*</span></label>
            <div className="fn-input-prefix">
              <span className="fn-prefix">₹</span>
              <input
                className="fn-input fn-input--prefixed"
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          {err && <p className="fn-modal-err">{err}</p>}
        </div>
        <div className="fn-modal-footer">
          <button className="fn-btn fn-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="fn-btn fn-btn--primary" onClick={submit} disabled={loading}>
            {loading ? "Adding…" : "Add Expense"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Slip viewer modal ───────────────────────────────────────────── */
const SlipViewer = ({ slip, onClose }) => (
  <div className="fn-modal-backdrop" onClick={onClose}>
    <div className="fn-slip-viewer" onClick={e => e.stopPropagation()}>
      <button className="fn-modal-close fn-slip-close" onClick={onClose}>✕</button>
      <img
        src={`${API}/uploads/slips/${slip}`}
        alt="Transaction Slip"
        className="fn-slip-img"
      />
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════
   GOOGLE-STYLE CALENDAR
══════════════════════════════════════════════════════════════════ */
const FinanceCalendar = ({ calData, year, month, onMonthChange, onDateClick, selectedDate }) => {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build 6×7 grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Cal data map: "YYYY-MM-DD" → { total, paid, pending }
  const calMap = {};
  calData.forEach(row => {
    if (!row.date) return;
    // Ensure plain YYYY-MM-DD string — guard against JS Date object serialization
    const key = typeof row.date === "string"
      ? row.date.slice(0, 10)
      : row.date.toISOString().slice(0, 10);
    calMap[key] = row;
  });

  const today = new Date();
  const isToday = (d) =>
    d && today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;

  const padded = (d) => String(d).padStart(2, "0");
  const getKey = (d) => `${year}-${padded(month)}-${padded(d)}`;

  const getDotStatus = (d) => {
    if (!d) return null;
    const row = calMap[getKey(d)];
    if (!row) return null;
    if (row.pending === 0) return "all-paid";
    if (row.paid > 0) return "mixed";
    return "pending";
  };

  const prev = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const next = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };
  const goToday = () => {
    onMonthChange(today.getFullYear(), today.getMonth() + 1);
  };

  return (
    <div className="fn-cal">
      {/* Header */}
      <div className="fn-cal-head">
        <div className="fn-cal-nav">
          <button className="fn-cal-arrow" onClick={prev}>‹</button>
          <button className="fn-cal-arrow" onClick={next}>›</button>
          <h2 className="fn-cal-title">{MONTHS[month - 1]} {year}</h2>
          <button className="fn-cal-today-btn" onClick={goToday}>Today</button>
        </div>
        <div className="fn-cal-legend">
          <span className="fn-leg fn-leg--paid">All Paid</span>
          <span className="fn-leg fn-leg--mixed">Partial / Mixed</span>
          <span className="fn-leg fn-leg--pending">Pending</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="fn-cal-grid fn-cal-dayrow">
        {DAYS.map(d => <div key={d} className="fn-cal-dayname">{d}</div>)}
      </div>

      {/* Cells */}
      <div className="fn-cal-grid fn-cal-body">
        {cells.map((d, i) => {
          const status = getDotStatus(d);
          const key = d ? getKey(d) : `empty-${i}`;
          const row = d ? calMap[getKey(d)] : null;
          const sel = d && selectedDate === getKey(d);

          return (
            <div
              key={key}
              className={[
                "fn-cal-cell",
                d ? "fn-cal-cell--active" : "fn-cal-cell--empty",
                isToday(d) ? "fn-cal-cell--today" : "",
                sel ? "fn-cal-cell--selected" : "",
              ].join(" ")}
              onClick={() => d && onDateClick(getKey(d))}
            >
              {d && (
                <>
                  <span className="fn-cal-date-num">{d}</span>
                  {status && (
                    <div className={`fn-cal-event fn-cal-event--${status}`}>
                      {status === "all-paid"
                        ? <span>All Paid <b>{row.total}</b></span>
                        : status === "mixed"
                          ? <><span>Mixed <b>{row.total}</b></span><span className="fn-cal-sub">{row.pending} pending</span></>
                          : <span>{row.pending} pending</span>
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   BILLING SUMMARY PANEL (right side)
══════════════════════════════════════════════════════════════════ */
const BillingSummary = ({ selected, allRows, onPayNow, canPay = false }) => {
  // Only count rows that are PENDING (paid ones should never be in `selected` anyway,
  // but guard here too so the total is always correct)
  const rows = selected.length > 0
    ? allRows.filter(r => selected.includes(r.shipment_id) && r.payment_status !== "paid")
    : [];

  const grandTotal = rows.reduce((s, r) => s + Number(r.grand_total), 0);
  const baseTotals = rows.reduce((s, r) => s + Number(r.base_total), 0);
  const extraTotals = rows.reduce((s, r) => s + Number(r.extra_total || 0), 0);
  const pendingRows = rows.filter(r => r.payment_status === "pending");

  return (
    <div className="fn-summary">
      <div className="fn-summary-header">
        <span className="fn-summary-title">Billing Summary</span>
      </div>

      <div className="fn-summary-stats">
        <div className="fn-stat-row">
          <span className="fn-stat-label">Shipments</span>
          <span className="fn-stat-val">{rows.length}</span>
        </div>
        <div className="fn-stat-row">
          <span className="fn-stat-label">Dates</span>
          <span className="fn-stat-val">
            {[...new Set(rows.map(r => r.dispatch_date?.slice(0, 10)))].length}
          </span>
        </div>
      </div>

      <div className="fn-summary-breakdown">
        <div className="fn-breakdown-row">
          <span>Base Expense</span>
          <span>{fmtMoney(baseTotals)}</span>
        </div>
        <div className="fn-breakdown-row">
          <span>Extra Charges</span>
          <span>{fmtMoney(extraTotals)}</span>
        </div>
        <div className="fn-breakdown-row fn-breakdown-row--total">
          <span>Grand Total</span>
          <span className="fn-breakdown-total-val">{fmtMoney(grandTotal)}</span>
        </div>
      </div>

      {pendingRows.length > 0 ? (
        canPay ? (
          <button
            className="fn-pay-now-btn"
            onClick={() => onPayNow(pendingRows.map(r => r.shipment_id))}
          >
            <span className="fn-pay-icon">💳</span>
            Pay Now
          </button>
        ) : (
          <div className="fn-view-only-note">👁 View Only — contact admin to process payment</div>
        )
      ) : rows.length > 0 ? (
        <div className="fn-all-paid-note">✅ All selected payments are paid</div>
      ) : (
        <div className="fn-empty-summary">
          <p>Select shipments from the calendar or table below.</p>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   DETAIL DRAWER — single shipment finance details
══════════════════════════════════════════════════════════════════ */
const DetailDrawer = ({ shipmentId, onClose, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);   // pay base
  const [extraModal, setExtraModal] = useState(false);   // add extra
  const [payExtra, setPayExtra] = useState(null);    // pay extra {id}
  const [slipView, setSlipView] = useState(null);
  const [actionLoad, setActionLoad] = useState(false);
  const [toast, setToast] = useState("");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/finance/${shipmentId}`);
      if (!res) return; const json = await res.json();
      if (json.success) setData(json.data);
    } catch { }
    finally { setLoading(false); }
  }, [shipmentId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const handlePayBase = async (file) => {
    setActionLoad(true);
    const fd = new FormData();
    fd.append("slip", file);
    try {
      const res = await apiFetch(`/api/finance/${shipmentId}/pay`, { method: "POST", body: fd });
      if (!res) return; const json = await res.json();
      if (json.success) { showToast("Payment marked as paid"); setPayModal(false); fetchDetail(); onRefresh(); }
      else showToast(json.message);
    } catch { showToast("Network error"); }
    finally { setActionLoad(false); }
  };

  const handlePayExtra = async (file) => {
    setActionLoad(true);
    const fd = new FormData();
    fd.append("slip", file);
    try {
      const res = await apiFetch(`/api/finance/extra/${payExtra}/pay`, { method: "POST", body: fd });
      if (!res) return; const json = await res.json();
      if (json.success) { showToast("Extra expense paid"); setPayExtra(null); fetchDetail(); onRefresh(); }
      else showToast(json.message);
    } catch { showToast("Network error"); }
    finally { setActionLoad(false); }
  };

  const handleDeleteExtra = async (id) => {
    if (!window.confirm("Remove this extra expense?")) return;
    try {
      await apiFetch(`/api/finance/extra/${id}`, { method: "DELETE" });
      fetchDetail(); onRefresh();
    } catch { }
  };

  return (
    <div className="fn-drawer-backdrop" onClick={onClose}>
      <div className="fn-drawer" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="fn-drawer-head">
          <div>
            <h3 className="fn-drawer-title">Shipment #{data?.shipment_no || shipmentId}</h3>
            {data && <p className="fn-drawer-sub">{data.origin} → {data.destination}</p>}
          </div>
          <button className="fn-drawer-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="fn-drawer-loading">Loading…</div>}

        {!loading && data && (
          <div className="fn-drawer-body">
            {/* Base payment card */}
            <div className="fn-detail-card">
              <div className="fn-detail-card-head">
                <span className="fn-detail-card-title">Base Payment</span>
                <StatusChip status={data.payment_status} />
              </div>
              <div className="fn-detail-amounts">
                {(() => {
                  // fuel_total = SUM(shipment_fuel_entries.amount) — from API via subquery
                  const fuelTotal = Number(data.fuel_total || 0);
                  const tollTotal = Number(data.manual_toll_fix_toll || 0) + Number(data.toll_amount || 0);
                  const driverTotal = Number(data.driver_payment || 0) + Number(data.return_fare || 0);
                  const taxTotal = Math.max(0, Number(data.base_total) - fuelTotal - tollTotal - driverTotal);
                  const extraTotal = data.extras?.reduce((s, e) => s + Number(e.extra_expense), 0) || 0;
                  return (
                    <>
                      <div className="fn-detail-amount-row">
                        <span>⛽ Fuel</span>
                        <span>{fmtMoney(fuelTotal)}</span>
                      </div>
                      <div className="fn-detail-amount-row">
                        <span>🛣️ Toll</span>
                        <span>{fmtMoney(tollTotal)}</span>
                      </div>
                      <div className="fn-detail-amount-row">
                        <span>🧾 State Tax</span>
                        <span>{fmtMoney(taxTotal)}</span>
                      </div>
                      <div className="fn-detail-amount-row">
                        <span>🧑‍✈️ Driver</span>
                        <span>{fmtMoney(driverTotal)}</span>
                      </div>
                      <div className="fn-detail-amount-row fn-detail-subtotal">
                        <span>Base Total</span>
                        <span>{fmtMoney(data.base_total)}</span>
                      </div>
                      <div className="fn-detail-amount-row">
                        <span>➕ Extra Charges</span>
                        <span>{fmtMoney(extraTotal)}</span>
                      </div>
                      <div className="fn-detail-amount-row fn-detail-grand">
                        <span>Grand Total</span>
                        <span>{fmtMoney(data.grand_total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {data.payment_status === "paid" ? (
                <div className="fn-detail-paid-info">
                  <span>Paid on {fmtDate(data.payment_date)}</span>
                  {data.transaction_slip && (
                    <button className="fn-slip-btn" onClick={() => setSlipView(data.transaction_slip)}>
                      View Slip 🧾
                    </button>
                  )}
                </div>
              ) : (
                <button className="fn-btn fn-btn--primary fn-btn--full" onClick={() => setPayModal(true)}>
                  💳 Mark as Paid
                </button>
              )}
            </div>

            {/* Extra expenses */}
            <div className="fn-detail-extras">
              <div className="fn-detail-extras-head">
                <span className="fn-detail-card-title">Extra Expenses</span>
                <button className="fn-add-extra-btn" onClick={() => setExtraModal(true)}>
                  + Add
                </button>
              </div>

              {(!data.extras || data.extras.length === 0) && (
                <div className="fn-extras-empty">No extra expenses added.</div>
              )}

              {data.extras?.map(exp => (
                <div key={exp.id} className="fn-extra-row">
                  <div className="fn-extra-info">
                    <span className="fn-extra-desc">{exp.description || "Extra Expense"}</span>
                    {exp.clause_reason && (
                      <span className="fn-extra-clause">📋 {exp.clause_reason}</span>
                    )}
                    <span className="fn-extra-amount">{fmtMoney(exp.extra_expense)}</span>
                  </div>
                  <div className="fn-extra-actions">
                    <StatusChip status={exp.payment_status} />
                    {exp.payment_status === "pending" && (
                      <button className="fn-extra-pay-btn" onClick={() => setPayExtra(exp.id)}>Pay</button>
                    )}
                    {exp.payment_status === "paid" && exp.transaction_slip && (
                      <button className="fn-slip-btn" onClick={() => setSlipView(exp.transaction_slip)}>🧾</button>
                    )}
                    {exp.payment_status === "pending" && (
                      <button className="fn-extra-del-btn" onClick={() => handleDeleteExtra(exp.id)}>🗑</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && <div className="fn-drawer-toast">{toast}</div>}
      </div>

      {/* Nested modals */}
      {payModal && (
        <PayModal
          title={`Mark Shipment #${shipmentId} as Paid`}
          onConfirm={handlePayBase}
          onClose={() => setPayModal(false)}
          loading={actionLoad}
        />
      )}
      {payExtra && (
        <PayModal
          title="Mark Extra Expense as Paid"
          onConfirm={handlePayExtra}
          onClose={() => setPayExtra(null)}
          loading={actionLoad}
        />
      )}
      {extraModal && (
        <ExtraModal
          shipmentId={shipmentId}
          onDone={() => { setExtraModal(false); fetchDetail(); onRefresh(); }}
          onClose={() => setExtraModal(false)}
        />
      )}
      {slipView && <SlipViewer slip={slipView} onClose={() => setSlipView(null)} />}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN FINANCE PAGE
══════════════════════════════════════════════════════════════════ */
export default function Finance() {
  const today = new Date();
  const user = getUser();
  const _isAdmin = isAdmin();
  const _canPay = canMakePayment(); // admin OR finance role can pay

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [calData, setCalData] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkLoad, setBulkLoad] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState("");
  // Branch filter — admin can select any branch, finance sees all by default
  const [branchFilter, setBranchFilter] = useState(null);
  const [plants, setPlants] = useState([]);

  // Load plant list for admin + finance branch selector
  useEffect(() => {
    if (!_isAdmin && !isFinance()) return;
    apiFetch("/api/auth/plants")
      .then(r => r?.json())
      .then(j => { if (j?.success) setPlants(j.data); })
      .catch(() => { });
  }, [_isAdmin]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3200); };

  /* ── fetch calendar dots ── */
  const fetchCal = useCallback(async () => {
    try {
      let url = `/api/finance/calendar?year=${year}&month=${month}`;
      if (branchFilter) url += `&plant_code=${branchFilter}`;
      const res = await apiFetch(url);
      if (!res) return;
      const json = await res.json();
      if (json?.success) setCalData(json.data);
    } catch { }
  }, [year, month, branchFilter]);

  /* ── fetch table rows ── */
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/finance?status=${statusFilter}`;
      if (selectedDate) url += `&from=${selectedDate}&to=${selectedDate}`;
      if (branchFilter) url += `&plant_code=${branchFilter}`;
      const res = await apiFetch(url);
      if (!res) return; // null = 401, apiClient already redirected to login
      const json = await res.json();
      if (json.success) setRows(json.data);
    } catch { }
    finally { setLoading(false); }
  }, [statusFilter, selectedDate, branchFilter]);

  useEffect(() => { fetchCal(); }, [fetchCal]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleMonthChange = (y, m) => { setYear(y); setMonth(m); };

  const handleDateClick = (dateStr) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
    setSelected([]);
  };

  /* ── checkbox selection ── */
  const toggleSelect = (no) =>
    setSelected(prev => prev.includes(no) ? prev.filter(x => x !== no) : [...prev, no]);

  const toggleAll = () => {
    // Only pending shipments can be selected — skip paid ones
    const visible = filtered.filter(r => r.payment_status !== "paid").map(r => r.shipment_id);
    setSelected(prev => prev.length === visible.length ? [] : visible);
  };

  /* ── filter rows ── */
  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q
      || String(r.shipment_no).toLowerCase().includes(q)
      || (r.origin + " " + r.destination).toLowerCase().includes(q)
      || (r.vehicle_no || "").toLowerCase().includes(q)
      || (r.dealer_name || "").toLowerCase().includes(q);
  });

  /* ── group by dispatch_date ── */
  const groups = filtered.reduce((acc, r) => {
    const raw = r.dispatch_date;
    const key = !raw ? "—"
      : typeof raw === "string" ? raw.slice(0, 10)
        : new Date(raw).toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  /* ── group summary ── */
  const groupSummary = (list) => ({
    tax: list.reduce((s, r) => s + Number(r.base_total), 0),
    extra: list.reduce((s, r) => s + Number(r.extra_total || 0), 0),
    grand: list.reduce((s, r) => s + Number(r.grand_total), 0),
  });

  /* ── bulk pay ── */
  const handleBulkPay = async (file) => {
    setBulkLoad(true);
    const fd = new FormData();
    fd.append("slip", file);
    fd.append("shipment_ids", JSON.stringify(selected));
    try {
      const res = await apiFetch(`/api/finance/bulk-pay`, { method: "POST", body: fd });
      if (!res) return; const json = await res.json();
      if (json.success) {
        showToast(json.message);
        setBulkModal(false);
        setSelected([]);
        fetchRows(); fetchCal();
      } else showToast(json.message);
    } catch { showToast("Network error"); }
    finally { setBulkLoad(false); }
  };

  /* ── render ── */
  return (
    <div className="fn-page">
      {/* ── Page title bar ── */}
      <div className="fn-topbar">
        <div className="fn-topbar-left">
          <span className="fn-breadcrumb">Accounts › Billing</span>
          <h1 className="fn-page-title">Shipment Billing</h1>
        </div>
        <div className="fn-topbar-right">
          {/* Branch selector — admin and finance can filter by branch */}
          {(_isAdmin || isFinance()) && (
            <select
              className="fn-filter-select fn-branch-select"
              value={branchFilter || ""}
              onChange={e => { setBranchFilter(e.target.value || null); setSelected([]); }}
            >
              <option value="">All Branches</option>
              {plants.map(p => (
                <option key={p.plant_code} value={p.plant_code}>
                  {p.plant_code} — {p.site} ({p.type})
                </option>
              ))}
            </select>
          )}
          <div className="fn-search-wrap">
            <span className="fn-search-icon">⌕</span>
            <input
              className="fn-search"
              placeholder="Search shipment no. or route…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="fn-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <button className="fn-export-btn">↓ Export CSV</button>
        </div>
      </div>

      {/* ── Two-column layout: Calendar + Summary ── */}
      <div className="fn-top-section">
        <FinanceCalendar
          calData={calData}
          year={year}
          month={month}
          onMonthChange={handleMonthChange}
          onDateClick={handleDateClick}
          selectedDate={selectedDate}
        />
        <BillingSummary
          selected={selected}
          allRows={rows}
          canPay={_canPay}
          onPayNow={(nos) => { setSelected(nos); setBulkModal(true); }}
        />
      </div>

      {/* ── Table section ── */}
      <div className="fn-table-section">
        <div className="fn-table-header">
          <div className="fn-table-title-row">
            <h2 className="fn-table-title">
              All Shipments
              {selectedDate && (
                <span className="fn-date-filter-chip">
                  {fmtDate(selectedDate)}
                  <button onClick={() => setSelectedDate(null)}>✕</button>
                </span>
              )}
            </h2>
            <span className="fn-row-count">{filtered.length} records</span>
          </div>
          {selected.length > 0 && (
            <div className="fn-bulk-bar">
              <span>{selected.length} selected</span>
              {_canPay && (
                <button
                  className="fn-btn fn-btn--primary fn-btn--sm"
                  onClick={() => setBulkModal(true)}
                >
                  💳 Pay Selected
                </button>
              )}
              <button
                className="fn-btn fn-btn--ghost fn-btn--sm"
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="fn-loader">
            <div className="fn-spinner" />
            <span>Loading finance records…</span>
          </div>
        )}

        {!loading && (
          <div className="fn-table-wrap">
            <table className="fn-table">
              <thead>
                <tr>
                  <th className="fn-th-check">
                    <input
                      type="checkbox"
                      className="fn-checkbox"
                      onChange={toggleAll}
                      checked={selected.length > 0 && selected.length === filtered.length}
                    />
                  </th>
                  <th>Shipment No</th>
                  <th>Dispatch Date</th>
                  <th>Route</th>
                  <th>Distance</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map(dateKey => {
                  const list = groups[dateKey];
                  const sum = groupSummary(list);
                  const allSelected = list.every(r => selected.includes(r.shipment_id));

                  return [
                    /* ── Date group header ── */
                    <tr key={`grp-${dateKey}`} className="fn-group-row">
                      <td>
                        <input
                          type="checkbox"
                          className="fn-checkbox"
                          checked={allSelected}
                          onChange={() => {
                            // Only include pending rows in group selection
                            const pendingNos = list.filter(r => r.payment_status !== "paid").map(r => r.shipment_id);
                            if (allSelected) setSelected(prev => prev.filter(x => !pendingNos.includes(x)));
                            else setSelected(prev => [...new Set([...prev, ...pendingNos])]);
                          }}
                        />
                      </td>
                      <td colSpan={2} className="fn-group-date">
                        <span className="fn-cal-icon">📅</span>
                        {fmtDate(dateKey)}
                        <span className="fn-group-badge">{list.length} shipments</span>
                      </td>
                      <td colSpan={2} />
                      <td className="fn-group-num fn-group-grand">
                        {fmtMoney(sum.grand)}
                      </td>
                      <td colSpan={2} />
                    </tr>,

                    /* ── Shipment rows ── */
                    ...list.map(r => {
                      const isPaid = r.payment_status === "paid";
                      return (
                        <tr
                          key={r.shipment_no}
                          className={`fn-row ${selected.includes(r.shipment_id) ? "fn-row--selected" : ""} ${isPaid ? "fn-row--paid" : ""}`}
                        >
                          <td className="fn-th-check">
                            <input
                              type="checkbox"
                              className="fn-checkbox"
                              checked={selected.includes(r.shipment_id)}
                              onChange={() => !isPaid && toggleSelect(r.shipment_id)}
                              disabled={isPaid}
                              title={isPaid ? "Already paid — cannot select" : undefined}
                            />
                          </td>
                          <td>
                            <button
                              className="fn-shipment-link"
                              onClick={() => setDrawer(r.shipment_id)}
                            >
                              {r.shipment_no}
                            </button>
                          </td>
                          <td className="fn-td-muted">{fmtDate(r.dispatch_date)}</td>
                          <td>
                            <span className="fn-route">
                              {r.origin} <span className="fn-arrow">→</span> {r.destination}
                            </span>
                          </td>
                          <td className="fn-td-muted">
                            {r.distance ? `${r.distance} km` : "—"}
                          </td>
                          <td className="fn-td-num fn-td-grand">{fmtMoney(r.grand_total)}</td>
                          <td><StatusChip status={r.payment_status} /></td>
                          <td>
                            <button
                              className="fn-detail-btn"
                              onClick={() => setDrawer(r.shipment_id)}
                            >
                              Details →
                            </button>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}

                {sortedKeys.length === 0 && (
                  <tr>
                    <td colSpan={8} className="fn-empty-row">
                      No finance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail drawer ── */}
      {drawer && (
        <DetailDrawer
          shipmentId={drawer}
          onClose={() => setDrawer(null)}
          onRefresh={() => { fetchRows(); fetchCal(); }}
        />
      )}

      {/* ── Bulk pay modal ── */}
      {bulkModal && (
        <PayModal
          title={`Pay ${selected.length} Shipment(s)`}
          onConfirm={handleBulkPay}
          onClose={() => setBulkModal(false)}
          loading={bulkLoad}
        />
      )}

      {/* ── Toast ── */}
      {toast && <div className="fn-toast">{toast}</div>}
    </div>
  );
}