import { useEffect, useState, useCallback } from "react";
import "../assets/css/PendingShipments.css";
import "../assets/css/shipments.css";
import { apiFetch, getUser } from "../utils/apiClient";
import { EditField, FuelEntryRow, DLSearchWidget } from "../components/shared/ShipmentShared";
import { useShipmentFilters } from "../components/shared/ShipmentFilters";

/* ── State columns → display label ─────────────────────────────── */
const STATE_TAX_COLUMNS = [
  { col: "ts_armed_forces_tax", label: "TS Armed Forces" },
  { col: "andhra_pradesh_tax", label: "Andhra Pradesh" },
  { col: "arunachal_pradesh_tax", label: "Arunachal Pradesh" },
  { col: "assam_tax", label: "Assam" },
  { col: "bihar_tax", label: "Bihar" },
  { col: "chhattisgarh_tax", label: "Chhattisgarh" },
  { col: "delhi_tax", label: "Delhi" },
  { col: "goa_tax", label: "Goa" },
  { col: "gujarat_tax", label: "Gujarat" },
  { col: "haryana_tax", label: "Haryana" },
  { col: "himachal_pradesh_tax", label: "Himachal Pradesh" },
  { col: "jharkhand_tax", label: "Jharkhand" },
  { col: "karnataka_tax", label: "Karnataka" },
  { col: "kerala_tax", label: "Kerala" },
  { col: "madhya_pradesh_tax", label: "Madhya Pradesh" },
  { col: "maharashtra_tax", label: "Maharashtra" },
  { col: "manipur_tax", label: "Manipur" },
  { col: "meghalaya_tax", label: "Meghalaya" },
  { col: "mizoram_tax", label: "Mizoram" },
  { col: "nagaland_tax", label: "Nagaland" },
  { col: "odisha_tax", label: "Odisha" },
  { col: "punjab_tax", label: "Punjab" },
  { col: "rajasthan_tax", label: "Rajasthan" },
  { col: "sikkim_tax", label: "Sikkim" },
  { col: "tamil_nadu_tax", label: "Tamil Nadu" },
  { col: "telangana_tax", label: "Telangana" },
  { col: "tripura_tax", label: "Tripura" },
  { col: "uttar_pradesh_tax", label: "Uttar Pradesh" },
  { col: "uttarakhand_tax", label: "Uttarakhand" },
  { col: "west_bengal_tax", label: "West Bengal" },
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
    color: ["#ff6d41", "#ffcd3c", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa"][i % 6],
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
        <h3 className="ps-celebrate-title">Shipment Submitted!</h3>
        <p className="ps-celebrate-sub">Shipment is now awaiting Admin Approval ⏳.</p>
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
    driver_payment: "", return_fare: "", additional_payment: "0",
    manual_toll_fix_toll: "", toll_amount: "",
    taxes: [], // [{ col, label, amount }]
    driver_name: "", dl_number: "",
    fuel_entries: [{ entry_type: "TIED_PUMP", pump_id: "", qty: "", rate: "" }]
  };

  const [form, setForm] = useState(emptyForm);
  const [match, setMatch] = useState({ route: null, vehicle: null, driver_route: null, toll: null });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  const [pumps, setPumps] = useState([]);

  useEffect(() => {
    apiFetch(`/api/shipments/petrol-pumps`)
      .then(r => r.json())
      .then(j => { if (j.success) setPumps(j.data); })
      .catch(console.error);
  }, []);

  /* Pre-fill from raw_ on mount */
  useEffect(() => {
    setForm(f => ({
      ...f,
      dispatch_plant: shipment.raw_dispatch_plant || "",
      delivery_location: shipment.raw_delivery_location || "",
      state: shipment.raw_state || "",
      dealer_name: shipment.raw_dealer_name || "",
      km: shipment.raw_km || "",
      material_no: shipment.raw_vehicle_material_no || "",
      model: shipment.raw_vehicle_model || "",
      avg: shipment.raw_vehicle_avg || "",
    }));
  }, [shipment]);

  /* Debounced master check */
  useEffect(() => {
    if (!form.dispatch_plant && !form.material_no) return;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          dispatch_plant: form.dispatch_plant,
          delivery_location: form.delivery_location,
          dealer_name: form.dealer_name,
          material_no: form.material_no,
        });
        const res = await apiFetch(`/api/shipments/check-masters?${params}`);
        const json = await res.json();
        const data = json.data || {};
        setMatch(data);

        // Auto-fill vehicle avg if vehicle matched
        if (data.vehicle?.avg) {
          setForm(f => ({ ...f, avg: data.vehicle.avg }));
        }

        // Auto-fill route km if route matched
        if (data.route?.km) {
          setForm(f => ({
            ...f,
            km: data.route.km
          }));
        }

        // Auto-fill driver route payment if route matched
        if (data.driver_route) {
          setForm(f => ({
            ...f,
            driver_payment: data.driver_route.driver_payment ?? "",
            return_fare: data.driver_route.return_fare ?? "",
            additional_payment: data.driver_route.additional_payment ?? "0",
          }));
        }

        // Auto-fill toll if route matched
        if (data.toll) {
          setForm(f => ({
            ...f,
            manual_toll_fix_toll: data.toll.manual_toll_fix_toll || "",
            toll_amount: data.toll.toll_amount || "",
          }));
        }

        // Auto-fill tax amounts if route matched
        if (data.taxes && data.taxes.length > 0) {
          const prefilled = data.taxes
            .filter(t => t.amount != null)
            .map(t => ({ col: t.col, label: t.label, amount: t.amount, isMatched: true }));
          if (prefilled.length > 0) setForm(f => ({ ...f, taxes: prefilled }));
        }
      } catch { /* silent */ }
    }, 500);
    return () => clearTimeout(t);
  }, [form.dispatch_plant, form.delivery_location, form.dealer_name, form.material_no]);

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }));
  const handleChange = e => set(e.target.name, e.target.value);

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

  /* Fuel logic */
  const handleFuelChange = (index, field, value) => {
    setForm(f => {
      const entries = [...f.fuel_entries];
      entries[index] = { ...entries[index], [field]: value };
      if (field === "entry_type" && value !== "TIED_PUMP") entries[index].pump_id = "";
      return { ...f, fuel_entries: entries };
    });
  };
  const handleFuelAdd = () => setForm(f => ({ ...f, fuel_entries: [...f.fuel_entries, { entry_type: "TIED_PUMP", pump_id: "", qty: "", rate: "" }] }));
  const handleFuelRemove = index => setForm(f => ({ ...f, fuel_entries: f.fuel_entries.filter((_, i) => i !== index) }));

  const validate = () => {
    if (!form.dispatch_plant) return "Dispatch Plant is required";
    if (!form.delivery_location) return "Delivery Location is required";
    if (!form.dealer_name) return "Dealer Name is required";
    if (!form.material_no) return "Material No is required";
    if (!form.driver_name || !form.dl_number) return "Driver Details are required";

    // Validate fuel entries logic
    const distance = Number(form.km) || 0;
    const avg = Number(form.avg) || 1;
    const requiredFuel = Math.ceil(distance / avg);
    const totalFilled = form.fuel_entries.reduce((sum, e) => sum + (Number(e.qty) || 0), 0);

    if (form.fuel_entries.some(e => !e.qty || !e.rate)) return "All fuel entries must have qty and rate";
    if (totalFilled < requiredFuel - 1) return `Fuel quota not met (Required ${requiredFuel}L, Filled ${totalFilled}L)`;

    return null;
  };

  const handleApprove = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true); setError(null);

    const taxPayload = {};
    form.taxes.forEach(t => { if (t.col && t.amount) taxPayload[t.col] = t.amount; });

    try {
      const res = await apiFetch(`/api/shipments/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: shipment.shipment_id,
          route: {
            dispatch_plant: form.dispatch_plant, delivery_location: form.delivery_location,
            state: form.state, dealer_name: form.dealer_name, km: form.km || null,
          },
          vehicle: { material_no: form.material_no, model: form.model, avg: form.avg || null },
          route_toll: (form.manual_toll_fix_toll || form.toll_amount)
            ? { manual_toll_fix_toll: form.manual_toll_fix_toll || null, toll_amount: form.toll_amount || null }
            : null,
          route_tax: Object.keys(taxPayload).length > 0 ? taxPayload : null,
          driver: { name: form.driver_name, dl_number: form.dl_number, },
          driver_route: {
            driver_payment: form.driver_payment,
            return_fare: form.return_fare,
            additional_payment: form.additional_payment,
          },
          fuel_entries: form.fuel_entries
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

  const routeMatched = !!match.route;
  const vehicleMatched = !!match.vehicle;
  const tollMatched = !!match.toll;

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
        {shipment.raw_dispatch_plant && <span className="ps-raw-chip">{shipment.raw_dispatch_plant}</span>}
        {shipment.raw_delivery_location && <span className="ps-raw-chip">{shipment.raw_delivery_location}</span>}
        {shipment.raw_dealer_name && <span className="ps-raw-chip">{shipment.raw_dealer_name}</span>}
        {shipment.raw_vehicle_material_no && <span className="ps-raw-chip">{shipment.raw_vehicle_material_no}</span>}
        {shipment.raw_vehicle_model && <span className="ps-raw-chip">{shipment.raw_vehicle_model}</span>}
      </div>

      <div className="ps-approval-body">
        {/* ── Route ── */}
        <Section title="Route Master" matched={routeMatched}>
          <div className="ps-grid-2">
            <Field label="Dispatch Plant" name="dispatch_plant" value={form.dispatch_plant} onChange={handleChange} required disabled={routeMatched} />
            <Field label="Delivery Location" name="delivery_location" value={form.delivery_location} onChange={handleChange} required disabled={routeMatched} />
            <Field label="Dealer Name" name="dealer_name" value={form.dealer_name} onChange={handleChange} required disabled={routeMatched} />
            <Field label="State" name="state" value={form.state} onChange={handleChange} disabled={routeMatched} />
          </div>
          <div className="ps-grid-1" style={{ marginTop: 12 }}>
            <Field label="Distance (km)" name="km" value={form.km} onChange={handleChange} type="number" disabled={routeMatched} />
          </div>
        </Section>

        {/* ── Vehicle ── */}
        <Section title="Vehicle Master" matched={vehicleMatched}>
          <div className="ps-grid-3">
            <Field label="Material No" name="material_no" value={form.material_no} onChange={handleChange} required disabled={vehicleMatched} />
            <Field label="Model" name="model" value={form.model} onChange={handleChange} disabled={vehicleMatched} />
            <Field label="Avg (km/l)" name="avg" value={form.avg} onChange={handleChange} type="number" disabled={vehicleMatched} hint={vehicleMatched ? "Auto-filled" : ""} />
          </div>
        </Section>

        {/* ── Driver Route Payment ── */}
        <Section title="Driver Route Payment" matched={!!match.driver_route}>
          <div className="ps-grid-3">
            <Field label="Driver Payment (₹)" name="driver_payment" value={form.driver_payment} onChange={handleChange} type="number" required disabled={!!match.driver_route} hint={match.driver_route ? "Auto-filled from route" : ""} />
            <Field label="Return Fare (₹)" name="return_fare" value={form.return_fare} onChange={handleChange} type="number" required disabled={!!match.driver_route} hint={match.driver_route ? "Auto-filled from route" : ""} />
            <Field label="Additional Payment (₹)" name="additional_payment" value={form.additional_payment} onChange={handleChange} type="number" disabled={!!match.driver_route} hint={match.driver_route ? "Auto-filled from route" : ""} />
          </div>
        </Section>

        {/* ── Toll ── */}
        <Section title="Route Toll" matched={tollMatched}>
          <div className="ps-grid-2">
            <Field label="Manual Fix Toll (₹)" name="manual_toll_fix_toll" value={form.manual_toll_fix_toll} onChange={handleChange} type="number" disabled={tollMatched} hint={tollMatched ? "Auto-filled from route" : "Required"} />
            <Field label="Toll Amount (₹)" name="toll_amount" value={form.toll_amount} onChange={handleChange} type="number" disabled={tollMatched} hint={tollMatched ? "Auto-filled from route" : "Required"} />
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
                  disabled={tax.isMatched}
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
                  disabled={tax.isMatched && tax.col !== "tamil_nadu_tax"}
                />
              </div>
              {!tax.isMatched && <button className="ps-remove-tax" onClick={() => removeTax(idx)}>✕</button>}
            </div>
          ))}
          {usedCols.length < STATE_TAX_COLUMNS.length && (
            <button className="ps-add-tax-btn" onClick={addTax}>+ Add State Tax</button>
          )}
        </Section>

        {/* ── Driver Details ── */}
        <Section title="Driver Details">
          <DLSearchWidget
            driverName={form.driver_name}
            dlNumber={form.dl_number}
            onConfirm={(name, dl) => setForm(f => ({ ...f, driver_name: name, dl_number: dl }))}
            onClear={() => setForm(f => ({ ...f, driver_name: "", dl_number: "" }))}
          />
        </Section>

        {/* ── Fuel Entries ── */}
        <Section title="Fuel Entries">
          {form.fuel_entries.map((entry, idx) => (
            <FuelEntryRow
              key={idx}
              entry={entry}
              index={idx}
              pumps={pumps}
              onChange={handleFuelChange}
              onRemove={handleFuelRemove}
              requiredQty={Math.ceil((Number(form.km) || 0) / (Number(form.avg) || 1))}
              filledQtyExcludingThis={form.fuel_entries.reduce((sum, e, i) => i !== idx ? sum + (Number(e.qty) || 0) : sum, 0)}
            />
          ))}
          <button className="ps-add-tax-btn" onClick={handleFuelAdd} style={{ marginTop: 12 }}>+ Add Fuel Entry</button>
        </Section>
      </div>

      {error && <div className="ps-error">⚠ {error}</div>}

      <div className="ps-approval-footer">
        <button className="ps-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="ps-btn-approve" onClick={handleApprove} disabled={loading}>
          {loading ? <span className="ps-spinner" /> : "✓ Save & Submit"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PENDING SHIPMENTS LIST
═══════════════════════════════════════════════════════════════════ */
export default function PendingShipments() {
  const canEdit = ["admin", "branch"].includes(getUser()?.role);
  const [rows, setRows] = useState([]);
  const [approvingRow, setApprovingRow] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/shipments/pending`);
      if (!res || !res.ok) { setRows([]); return; }
      const json = await res.json();
      setRows(json.data || []);
    } catch (err) {
      console.error(err);
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Use shared filters hook
  const { filterBar, sorted, SortTh } = useShipmentFilters(rows, {
    searchFields: ["shipment_no", "raw_dispatch_plant", "raw_delivery_location", "raw_dealer_name", "raw_vehicle_material_no"],
    showLocationFilters: false,
    defaultSort: { col: "shipment_date", dir: "desc" },
  });

  const handleApproved = (shipment_id) => {
    setRows(r => r.filter(x => x.shipment_id !== shipment_id));
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

      {/* Filter bar */}
      {filterBar}

      {sorted.length === 0 ? (
        <div className="ps-empty">
          <div className="ps-empty-icon">📭</div>
          <p>No pending shipments. You're all caught up!</p>
        </div>
      ) : (
        <div className="ps-table-card">
          <table className="ps-table">
            <thead>
              <tr>
                <SortTh col="shipment_no">Shipment No</SortTh>
                <SortTh col="raw_dispatch_plant">Dispatch Plant</SortTh>
                <SortTh col="raw_delivery_location">Delivery Location</SortTh>
                <SortTh col="raw_dealer_name">Dealer</SortTh>
                <th>Vehicle</th>
                <SortTh col="shipment_date">Date</SortTh>
                <th>Missing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.shipment_id}>
                  <td><span className="ps-shipno">#{s.shipment_no}</span></td>
                  <td>{s.raw_dispatch_plant || <span className="ps-na">—</span>}</td>
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
                      {!s.route_id && <span className="ps-chip ps-chip-route">Route</span>}
                      {!s.vehicle_id && <span className="ps-chip ps-chip-vehicle">Vehicle</span>}
                      {!s.driver_route_id && <span className="ps-chip ps-chip-driver">Driver</span>}
                      {s.route_id && s.vehicle_id && s.driver_route_id && <span className="ps-chip ps-chip-ok">All matched</span>}
                    </div>
                  </td>
                  <td>
                    <div className="ps-action-btns">
                      {canEdit ? (
                        <>
                          <button className="ps-approve-btn" onClick={() => setApprovingRow(s)}>
                            Fill & Submit
                          </button>
                        </>
                      ) : (
                        <span className="ps-view-only">👁 View Only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}