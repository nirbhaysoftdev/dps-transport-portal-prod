import { useEffect, useState, useCallback } from "react";
import "../assets/css//PendingShipments.css";

/* ── State columns → display label ─────────────────────────────── */
const STATE_TAX_COLUMNS = [
  { col: "ts_armed_forces_tax",   label: "TS Armed Forces" },
  { col: "andhra_pradesh_tax",    label: "Andhra Pradesh" },
  { col: "arunachal_pradesh_tax", label: "Arunachal Pradesh" },
  { col: "assam_tax",             label: "Assam" },
  { col: "bihar_tax",             label: "Bihar" },
  { col: "chhattisgarh_tax",      label: "Chhattisgarh" },
  { col: "delhi_tax",             label: "Delhi" },
  { col: "goa_tax",               label: "Goa" },
  { col: "gujarat_tax",           label: "Gujarat" },
  { col: "haryana_tax",           label: "Haryana" },
  { col: "himachal_pradesh_tax",  label: "Himachal Pradesh" },
  { col: "jharkhand_tax",         label: "Jharkhand" },
  { col: "karnataka_tax",         label: "Karnataka" },
  { col: "kerala_tax",            label: "Kerala" },
  { col: "madhya_pradesh_tax",    label: "Madhya Pradesh" },
  { col: "maharashtra_tax",       label: "Maharashtra" },
  { col: "manipur_tax",           label: "Manipur" },
  { col: "meghalaya_tax",         label: "Meghalaya" },
  { col: "mizoram_tax",           label: "Mizoram" },
  { col: "nagaland_tax",          label: "Nagaland" },
  { col: "odisha_tax",            label: "Odisha" },
  { col: "punjab_tax",            label: "Punjab" },
  { col: "rajasthan_tax",         label: "Rajasthan" },
  { col: "sikkim_tax",            label: "Sikkim" },
  { col: "tamil_nadu_tax",        label: "Tamil Nadu" },
  { col: "telangana_tax",         label: "Telangana" },
  { col: "tripura_tax",           label: "Tripura" },
  { col: "uttar_pradesh_tax",     label: "Uttar Pradesh" },
  { col: "uttarakhand_tax",       label: "Uttarakhand" },
  { col: "west_bengal_tax",       label: "West Bengal" },
];

/* ── Small helpers ──────────────────────────────────────────────── */
const MatchBadge = ({ text }) => (
  <span className="ps-match-badge">✓ {text}</span>
);

const Field = ({ label, name, value, onChange, type = "text", required, hint, disabled, children }) => (
  <div className={`ps-field ${required ? "ps-required" : ""} ${disabled ? "ps-disabled-field" : ""}`}>
    <label className="ps-label">
      {label}{required && <span className="ps-star">*</span>}
    </label>
    {children || (
      <input
        className="ps-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={disabled ? undefined : onChange}
        disabled={disabled}
        placeholder={disabled ? "—" : `Enter ${label.toLowerCase()}`}
      />
    )}
    {hint && <span className="ps-hint">{hint}</span>}
  </div>
);

const Section = ({ title, matched, children }) => (
  <div className="ps-section">
    <div className="ps-section-head">
      <span className="ps-section-title">{title}</span>
      {matched && <MatchBadge text="Existing record found — linked" />}
    </div>
    <div className="ps-section-body">{children}</div>
  </div>
);

/* ── Firecracker celebration overlay ────────────────────────────── */
const Celebration = ({ onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const crackers = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.2}s`,
    color: ["#ff6d41","#ffcd3c","#4ade80","#60a5fa","#f472b6","#a78bfa"][i % 6],
    size: `${6 + Math.random() * 8}px`,
  }));

  return (
    <div className="ps-celebrate-overlay">
      {crackers.map(c => (
        <div key={c.id} className="ps-cracker" style={{
          left: c.left, animationDelay: c.delay,
          background: c.color, width: c.size, height: c.size,
        }} />
      ))}
      <div className="ps-celebrate-card">
        <div className="ps-celebrate-emoji">🎉</div>
        <h3 className="ps-celebrate-title">Shipment Approved!</h3>
        <p className="ps-celebrate-sub">Your shipment is ready to go 🚛</p>
      </div>
    </div>
  );
};

/* ── Reject confirm dialog ───────────────────────────────────────── */
const RejectConfirm = ({ shipment, onConfirm, onCancel }) => (
  <div className="ps-reject-overlay">
    <div className="ps-reject-card">
      <div className="ps-reject-icon">⚠️</div>
      <h3 className="ps-reject-title">Reject Shipment?</h3>
      <p className="ps-reject-msg">
        Are you sure you want to reject shipment <strong>#{shipment.shipment_no}</strong>?
        This action cannot be undone.
      </p>
      <div className="ps-reject-actions">
        <button className="ps-btn-no" onClick={onCancel}>No, Keep It</button>
        <button className="ps-btn-yes" onClick={onConfirm}>Yes, Reject</button>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   APPROVAL FORM (inline, replaces listing)
═══════════════════════════════════════════════════════════════════ */
function ApprovalForm({ shipment, onClose, onApproved }) {
  const emptyForm = {
    dispatch_plant: "", delivery_location: "", state: "", dealer_name: "", km: "",
    material_no: "", model: "", avg: "",
    driver_id: "", driver_name: "", dl_number: "",
    driver_payment: "", return_fare: "", additional_payment: "0",
    manual_toll_fix_toll: "", toll_amount: "",
    taxes: [], // [{ col, label, amount }]
  };

  const [form, setForm]           = useState(emptyForm);
  const [match, setMatch]         = useState({ route: null, vehicle: null, driver: null, toll: null });
  const [drivers, setDrivers]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  /* Pre-fill from raw_ on mount */
  useEffect(() => {
    setForm(f => ({
      ...f,
      dispatch_plant:    shipment.raw_dispatch_plant        || "",
      delivery_location: shipment.raw_delivery_location     || "",
      state:             shipment.raw_state                 || "",
      dealer_name:       shipment.raw_dealer_name           || "",
      km:                shipment.raw_km                    || "",
      material_no:       shipment.raw_vehicle_material_no   || "",
      model:             shipment.raw_vehicle_model         || "",
      avg:               shipment.raw_vehicle_avg           || "",
    }));

    // Fetch all drivers for dropdown
    fetch(`${import.meta.env.VITE_API_URL}/api/drivers`)
      .then(r => r.json())
      .then(j => setDrivers(j.data || []))
      .catch(() => {});
  }, [shipment]);

  /* Debounced master check */
  useEffect(() => {
    if (!form.dispatch_plant && !form.material_no) return;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          dispatch_plant:    form.dispatch_plant,
          delivery_location: form.delivery_location,
          dealer_name:       form.dealer_name,
          material_no:       form.material_no,
          dl_number:         form.dl_number,
        });
        const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/check-masters?${params}`);
        const json = await res.json();
        const data = json.data || {};
        setMatch(data);

        // Auto-fill vehicle avg if vehicle matched
        if (data.vehicle?.avg) {
          setForm(f => ({ ...f, avg: data.vehicle.avg }));
        }

        // Auto-fill driver details if driver matched
        if (data.driver) {
          setForm(f => ({
            ...f,
            driver_id:   data.driver.driver_id,
            driver_name: data.driver.driver_name,
            dl_number:   data.driver.driver_dl,
          }));
        }

        // Auto-fill toll if route matched
        if (data.toll) {
          setForm(f => ({
            ...f,
            manual_toll_fix_toll: data.toll.manual_toll_fix_toll || "",
            toll_amount:          data.toll.toll_amount          || "",
          }));
        }

        // Auto-fill tax amounts if route matched
        if (data.taxes && data.taxes.length > 0) {
          const prefilled = data.taxes
            .filter(t => t.amount != null)
            .map(t => ({ col: t.col, label: t.label, amount: t.amount }));
          if (prefilled.length > 0) setForm(f => ({ ...f, taxes: prefilled }));
        }
      } catch { /* silent */ }
    }, 500);
    return () => clearTimeout(t);
  }, [form.dispatch_plant, form.delivery_location, form.dealer_name, form.material_no, form.dl_number]);

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }));
  const handleChange = e => set(e.target.name, e.target.value);

  /* Driver dropdown select */
  const handleDriverSelect = (e) => {
    const d = drivers.find(x => x.driver_id === Number(e.target.value));
    if (d) {
      setForm(f => ({
        ...f,
        driver_id:   d.driver_id,
        driver_name: d.driver_name,
        dl_number:   d.driver_dl,
      }));
    } else {
      setForm(f => ({ ...f, driver_id: "", driver_name: "", dl_number: "" }));
    }
  };

  /* Tax rows */
  const usedCols = form.taxes.map(t => t.col);
  const addTax = () => {
    const available = STATE_TAX_COLUMNS.find(s => !usedCols.includes(s.col));
    if (!available) return;
    setForm(f => ({ ...f, taxes: [...f.taxes, { col: available.col, label: available.label, amount: "" }] }));
  };
  const updateTax = (idx, field, value) => {
    setForm(f => {
      const taxes = [...f.taxes];
      if (field === "col") {
        const found = STATE_TAX_COLUMNS.find(s => s.col === value);
        taxes[idx] = { col: value, label: found?.label || value, amount: taxes[idx].amount };
      } else {
        taxes[idx] = { ...taxes[idx], [field]: value };
      }
      return { ...f, taxes };
    });
  };
  const removeTax = (idx) => setForm(f => ({ ...f, taxes: f.taxes.filter((_, i) => i !== idx) }));

  const validate = () => {
    if (!form.dispatch_plant)    return "Dispatch Plant is required";
    if (!form.delivery_location) return "Delivery Location is required";
    if (!form.dealer_name)       return "Dealer Name is required";
    if (!form.material_no)       return "Material No is required";
    if (!form.driver_id && !form.driver_name) return "Driver is required";
    return null;
  };

  const handleApprove = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError(null);

    // Build tax object: { col: amount, ... }
    const taxPayload = {};
    form.taxes.forEach(t => { if (t.col && t.amount) taxPayload[t.col] = t.amount; });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: shipment.shipment_id,
          route: {
            dispatch_plant: form.dispatch_plant, delivery_location: form.delivery_location,
            state: form.state, dealer_name: form.dealer_name, km: form.km || null,
          },
          vehicle: { material_no: form.material_no, model: form.model, avg: form.avg || null },
          driver:  { driver_id: form.driver_id || null, driver_name: form.driver_name, dl_number: form.dl_number },
          driver_route: {
            driver_payment: form.driver_payment || null,
            return_fare: form.return_fare || null,
            additional_payment: form.additional_payment || 0,
          },
          route_toll: (form.manual_toll_fix_toll || form.toll_amount)
            ? { manual_toll_fix_toll: form.manual_toll_fix_toll || null, toll_amount: form.toll_amount || null }
            : null,
          route_tax: Object.keys(taxPayload).length > 0 ? taxPayload : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Approval failed");

      setCelebrate(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (celebrate) {
    return (
      <Celebration onDone={() => {
        onApproved(shipment.shipment_id);
        onClose();
      }} />
    );
  }

  const routeMatched   = !!match.route;
  const vehicleMatched = !!match.vehicle;
  const driverMatched  = !!match.driver;
  const tollMatched    = !!match.toll;

  return (
    <div className="ps-approval-wrap">
      {/* Top bar */}
      <div className="ps-approval-topbar">
        <button className="ps-back-btn" onClick={onClose}>
          ← Back to Pending List
        </button>
        <div className="ps-approval-meta">
          <span className="ps-pending-badge">PENDING APPROVAL</span>
          <span className="ps-shipment-no">Shipment #{shipment.shipment_no}</span>
        </div>
      </div>

      {/* Raw CSV strip */}
      <div className="ps-raw-strip">
        <span className="ps-raw-label">FROM CSV</span>
        {shipment.raw_dispatch_plant      && <span className="ps-raw-chip">{shipment.raw_dispatch_plant}</span>}
        {shipment.raw_delivery_location   && <span className="ps-raw-chip">{shipment.raw_delivery_location}</span>}
        {shipment.raw_dealer_name         && <span className="ps-raw-chip">{shipment.raw_dealer_name}</span>}
        {shipment.raw_vehicle_material_no && <span className="ps-raw-chip">{shipment.raw_vehicle_material_no}</span>}
        {shipment.raw_vehicle_model       && <span className="ps-raw-chip">{shipment.raw_vehicle_model}</span>}
        {shipment.raw_driver_name         && <span className="ps-raw-chip">{shipment.raw_driver_name}</span>}
      </div>

      <div className="ps-approval-body">
        {/* ── Route ── */}
        <Section title="Route Master" matched={routeMatched}>
          <div className="ps-grid-2">
            <Field label="Dispatch Plant"    name="dispatch_plant"    value={form.dispatch_plant}    onChange={handleChange} required disabled={routeMatched} />
            <Field label="Delivery Location" name="delivery_location" value={form.delivery_location} onChange={handleChange} required disabled={routeMatched} />
            <Field label="Dealer Name"       name="dealer_name"       value={form.dealer_name}       onChange={handleChange} required disabled={routeMatched} />
            <Field label="State"             name="state"             value={form.state}             onChange={handleChange}         disabled={routeMatched} />
          </div>
          <div className="ps-grid-1" style={{ marginTop: 12 }}>
            <Field label="Distance (km)" name="km" value={form.km} onChange={handleChange} type="number" disabled={routeMatched} hint="Leave blank if unknown" />
          </div>
        </Section>

        {/* ── Vehicle ── */}
        <Section title="Vehicle Master" matched={vehicleMatched}>
          <div className="ps-grid-3">
            <Field label="Material No" name="material_no" value={form.material_no} onChange={handleChange} required disabled={vehicleMatched} />
            <Field label="Model"       name="model"       value={form.model}       onChange={handleChange}         disabled={vehicleMatched} />
            <Field label="Avg (km/l)"  name="avg"         value={form.avg}         onChange={handleChange} type="number" disabled={vehicleMatched} hint={vehicleMatched ? "Auto-filled" : ""} />
          </div>
        </Section>

        {/* ── Driver ── */}
        <Section title="Driver" matched={driverMatched}>
          <div className="ps-grid-2">
            <Field label="Select Driver" name="driver_id" required>
              <select
                className={`ps-input ${driverMatched ? "ps-input-locked" : ""}`}
                value={form.driver_id}
                onChange={driverMatched ? undefined : handleDriverSelect}
                disabled={driverMatched}
              >
                <option value="">— Select driver —</option>
                {drivers.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.driver_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="DL Number" name="dl_number" value={form.dl_number} disabled hint="Auto-filled from selection" />
          </div>

          {!driverMatched && (
            <p className="ps-driver-hint">
              Driver not in the list?{" "}
              <button className="ps-link-btn" onClick={() => set("driver_id", "NEW")}>
                Add new driver manually
              </button>
            </p>
          )}

          {form.driver_id === "NEW" && (
            <div className="ps-grid-2" style={{ marginTop: 12 }}>
              <Field label="Driver Name" name="driver_name" value={form.driver_name} onChange={handleChange} required />
              <Field label="DL Number"   name="dl_number"   value={form.dl_number}   onChange={handleChange} required />
            </div>
          )}
        </Section>

        {/* ── Driver Route Payment ── */}
        <Section title="Driver Route Payment">
          <div className="ps-grid-3">
            <Field label="Driver Payment (₹)"     name="driver_payment"     value={form.driver_payment}     onChange={handleChange} type="number" />
            <Field label="Return Fare (₹)"        name="return_fare"        value={form.return_fare}        onChange={handleChange} type="number" />
            <Field label="Additional Payment (₹)" name="additional_payment" value={form.additional_payment} onChange={handleChange} type="number" />
          </div>
        </Section>

        {/* ── Toll ── */}
        <Section title="Route Toll" matched={tollMatched}>
          <div className="ps-grid-2">
            <Field label="Manual Fix Toll (₹)" name="manual_toll_fix_toll" value={form.manual_toll_fix_toll} onChange={handleChange} type="number" disabled={tollMatched} hint={tollMatched ? "Auto-filled from route" : "Required"} />
            <Field label="Toll Amount (₹)"     name="toll_amount"          value={form.toll_amount}          onChange={handleChange} type="number" disabled={tollMatched} hint={tollMatched ? "Auto-filled from route" : "Required"} />
          </div>
        </Section>

        {/* ── Taxes ── */}
        <Section title="Route Tax (Per State)">
          {form.taxes.length === 0 && (
            <p className="ps-empty-tax">No state taxes added yet.</p>
          )}
          {form.taxes.map((tax, idx) => (
            <div key={idx} className="ps-tax-row">
              <div className="ps-field" style={{ flex: 2 }}>
                <label className="ps-label">State</label>
                <select
                  className="ps-input"
                  value={tax.col}
                  onChange={e => updateTax(idx, "col", e.target.value)}
                >
                  {STATE_TAX_COLUMNS
                    .filter(s => s.col === tax.col || !usedCols.includes(s.col))
                    .map(s => (
                      <option key={s.col} value={s.col}>{s.label}</option>
                    ))}
                </select>
              </div>
              <div className="ps-field" style={{ flex: 2 }}>
                <label className="ps-label">Tax Amount (₹)</label>
                <input
                  className="ps-input"
                  type="number"
                  value={tax.amount}
                  onChange={e => updateTax(idx, "amount", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <button className="ps-remove-tax" onClick={() => removeTax(idx)}>✕</button>
            </div>
          ))}
          {usedCols.length < STATE_TAX_COLUMNS.length && (
            <button className="ps-add-tax-btn" onClick={addTax}>+ Add State Tax</button>
          )}
        </Section>
      </div>

      {error && <div className="ps-error">⚠ {error}</div>}

      <div className="ps-approval-footer">
        <button className="ps-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="ps-btn-approve" onClick={handleApprove} disabled={loading}>
          {loading ? <span className="ps-spinner" /> : "✓ Approve & Create Masters"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PENDING SHIPMENTS LIST
═══════════════════════════════════════════════════════════════════ */
export default function PendingShipments() {
  const [rows, setRows]           = useState([]);
  const [approvingRow, setApprovingRow] = useState(null);
  const [rejectingRow, setRejectingRow] = useState(null);
  const [loadingReject, setLoadingReject] = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/pending`);
      const json = await res.json();
      setRows(json.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApproved = (shipment_id) => {
    setRows(r => r.filter(x => x.shipment_id !== shipment_id));
  };

  const confirmReject = async () => {
    if (!rejectingRow) return;
    setLoadingReject(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ shipment_id: rejectingRow.shipment_id }),
      });
      setRows(r => r.filter(x => x.shipment_id !== rejectingRow.shipment_id));
    } finally {
      setLoadingReject(false);
      setRejectingRow(null);
    }
  };

  /* ── Show inline approval form ── */
  if (approvingRow) {
    return (
      <ApprovalForm
        shipment={approvingRow}
        onClose={() => setApprovingRow(null)}
        onApproved={handleApproved}
      />
    );
  }

  /* ── Pending list ── */
  return (
    <div className="ps-wrapper">
      <div className="ps-header">
        <div>
          <h2 className="ps-title">Pending Shipments</h2>
          <p className="ps-subtitle">{rows.length} shipment{rows.length !== 1 ? "s" : ""} awaiting approval</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="ps-empty">
          <div className="ps-empty-icon">📭</div>
          <p>No pending shipments. You're all caught up!</p>
        </div>
      ) : (
        <div className="ps-table-card">
          <table className="ps-table">
            <thead>
              <tr>
                <th>Shipment No</th>
                <th>Dispatch Plant</th>
                <th>Delivery Location</th>
                <th>Dealer</th>
                <th>Vehicle</th>
                <th>Date</th>
                <th>Missing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.shipment_id}>
                  <td><span className="ps-shipno">#{s.shipment_no}</span></td>
                  <td>{s.raw_dispatch_plant    || <span className="ps-na">—</span>}</td>
                  <td>{s.raw_delivery_location || <span className="ps-na">—</span>}</td>
                  <td className="ps-dealer">{s.raw_dealer_name || <span className="ps-na">—</span>}</td>
                  <td>
                    <div className="ps-vehicle-cell">
                      <span>{s.raw_vehicle_model || <span className="ps-na">—</span>}</span>
                      {s.raw_vehicle_material_no && <span className="ps-material">{s.raw_vehicle_material_no}</span>}
                    </div>
                  </td>
                  <td className="ps-date">{s.shipment_date ? new Date(s.shipment_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <div className="ps-missing-chips">
                      {!s.route_id        && <span className="ps-chip ps-chip-route">Route</span>}
                      {!s.vehicle_id      && <span className="ps-chip ps-chip-vehicle">Vehicle</span>}
                      {!s.driver_route_id && <span className="ps-chip ps-chip-driver">Driver</span>}
                      {s.route_id && s.vehicle_id && s.driver_route_id && <span className="ps-chip ps-chip-ok">All matched</span>}
                    </div>
                  </td>
                  <td>
                    <div className="ps-action-btns">
                      <button className="ps-approve-btn" onClick={() => setApprovingRow(s)}>
                        Review & Approve
                      </button>
                      <button className="ps-reject-btn" onClick={() => setRejectingRow(s)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject confirm */}
      {rejectingRow && (
        <RejectConfirm
          shipment={rejectingRow}
          onConfirm={confirmReject}
          onCancel={() => setRejectingRow(null)}
        />
      )}
    </div>
  );
}