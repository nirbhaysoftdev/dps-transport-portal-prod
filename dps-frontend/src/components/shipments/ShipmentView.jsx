import { useEffect, useState } from "react";
import "../../assets/css/ShipmentView.css";

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

const STATUSES = ["Dispatched", "Running", "Delivered", "Accident"];

const InfoRow = ({ label, value }) => (
  <div className="sv-info-row">
    <span className="sv-info-label">{label}</span>
    <span className="sv-info-value">{value || <span className="sv-na">—</span>}</span>
  </div>
);

const EditField = ({ label, name, value, onChange, type = "text", children }) => (
  <div className="sv-edit-field">
    <label className="sv-edit-label">{label}</label>
    {children || (
      <input
        className="sv-edit-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
      />
    )}
  </div>
);

const PumpRow = ({ pump, form, onChange }) => (
  <div className="sv-pump-row">
    <span className="sv-pump-label">{pump}</span>
    <div className="sv-pump-inputs">
      <div className="sv-edit-field">
        <label className="sv-edit-label">Qty (L)</label>
        <input className="sv-edit-input" type="number" name={`${pump}_qty`}
          value={form[`${pump}_qty`] ?? ""} onChange={onChange} placeholder="0" />
      </div>
      <div className="sv-edit-field">
        <label className="sv-edit-label">Rate (₹/L)</label>
        <input className="sv-edit-input" type="number" name={`${pump}_rate`}
          value={form[`${pump}_rate`] ?? ""} onChange={onChange} placeholder="0.00" />
      </div>
      <div className="sv-pump-total">
        ₹{((Number(form[`${pump}_qty`] || 0)) * (Number(form[`${pump}_rate`] || 0))).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </div>
    </div>
  </div>
);

export default function ShipmentView({ shipmentId, onBack }) {
  const [data, setData]       = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/shipments/${shipmentId}`)
      .then(r => r.json())
      .then(j => {
        setData(j.data);
        initForm(j.data);
      })
      .catch(console.error);
  }, [shipmentId]);

  const initForm = (d) => {
    if (!d) return;
    // Build taxes as an array of { col, label, amount } — only pre-existing non-null values
    const taxes = STATE_TAX_COLUMNS
      .filter(({ col }) => d[col] != null && d[col] !== "" && Number(d[col]) > 0)
      .map(({ col, label }) => ({ col, label, amount: d[col] }));

    setForm({
      current_status:          d.current_status || "",
      delivery_date:           d.delivery_date?.slice(0, 10) || "",
      estimated_delivery_date: d.estimated_delivery_date?.slice(0, 10) || "",
      reason_for_delay:        d.reason_for_delay || "",
      communicate_to_alcop:    d.communicate_to_alcop || "",
      pump1_qty: d.pump1_qty ?? "", pump1_rate: d.pump1_rate ?? "",
      pump2_qty: d.pump2_qty ?? "", pump2_rate: d.pump2_rate ?? "",
      pump3_qty: d.pump3_qty ?? "", pump3_rate: d.pump3_rate ?? "",
      pump4_qty: d.pump4_qty ?? "", pump4_rate: d.pump4_rate ?? "",
      fuel_card_qty: d.fuel_card_qty ?? "", fuel_card_rate: d.fuel_card_rate ?? "",
      hsd_qty: d.hsd_qty ?? "", hsd_rate: d.hsd_rate ?? "",
      toll_manual: d.manual_toll_fix_toll ?? "",
      toll_amount: d.toll_amount ?? "",
      taxes,
    });
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const totalFuel = () => {
    const pumps = ["pump1","pump2","pump3","pump4","fuel_card","hsd"];
    return pumps.reduce((sum, p) => sum + (Number(form[`${p}_qty`] || 0) * Number(form[`${p}_rate`] || 0)), 0);
  };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const taxPayload = {};
      (form.taxes || []).forEach(t => { if (t.col && t.amount !== "" && t.amount != null) taxPayload[t.col] = t.amount; });

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/${shipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_status:          form.current_status,
          delivery_date:           form.delivery_date || null,
          estimated_delivery_date: form.estimated_delivery_date || null,
          reason_for_delay:        form.reason_for_delay || null,
          communicate_to_alcop:    form.communicate_to_alcop || null,
          pump1_rate: form.pump1_rate, pump1_qty: form.pump1_qty,
          pump2_rate: form.pump2_rate, pump2_qty: form.pump2_qty,
          pump3_rate: form.pump3_rate, pump3_qty: form.pump3_qty,
          pump4_rate: form.pump4_rate, pump4_qty: form.pump4_qty,
          fuel_card_qty: form.fuel_card_qty, fuel_card_rate: form.fuel_card_rate,
          hsd_qty: form.hsd_qty, hsd_rate: form.hsd_rate,
          route_id: data.route_id,
          toll: { manual_toll_fix_toll: form.toll_manual, toll_amount: form.toll_amount },
          tax: taxPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setEditMode(false);
      // Re-fetch to get fresh data
      const fresh = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/${shipmentId}`).then(r => r.json());
      setData(fresh.data);
      initForm(fresh.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div className="sv-wrapper">
        <div className="sv-loading">Loading shipment details…</div>
      </div>
    );
  }

  const statusClass = data.current_status?.toLowerCase().replace(/\s+/g, "-") || "";

  return (
    <div className="sv-wrapper">
      {/* Top bar */}
      <div className="sv-topbar">
        <button className="sv-back-btn" onClick={onBack}>← Back to Shipments</button>
        <div className="sv-topbar-right">
          {saved && <span className="sv-saved-toast">✓ Saved successfully</span>}
          {!editMode ? (
            <button className="sv-edit-btn" onClick={() => setEditMode(true)}>✏ Edit</button>
          ) : (
            <>
              <button className="sv-cancel-btn" onClick={() => { setEditMode(false); initForm(data); }}>Cancel</button>
              <button className="sv-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? <span className="sv-spinner" /> : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="sv-hero">
        <div className="sv-hero-left">
          <div className="sv-hero-no">#{data.shipment_no}</div>
          <span className={`sv-status-badge sv-status-${statusClass}`}>{data.current_status}</span>
        </div>
        <div className="sv-hero-route">
          <span className="sv-route-plant">{data.dispatch_plant || "—"}</span>
          <span className="sv-route-arrow">→</span>
          <span className="sv-route-dest">{data.delivery_location || "—"}</span>
          {data.km && <span className="sv-route-km">{data.km} km</span>}
        </div>
      </div>

      {error && <div className="sv-error">⚠ {error}</div>}

      <div className="sv-grid">

        {/* ── Shipment Info ── */}
        <div className="sv-card">
          <div className="sv-card-title">Shipment Details</div>
          <InfoRow label="Shipment Date"   value={data.shipment_date ? new Date(data.shipment_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Billing Doc No"  value={data.billing_doc_number} />
          <InfoRow label="Billing Date"    value={data.billing_date ? new Date(data.billing_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Chassis No"      value={data.chassis_no} />
          <InfoRow label="Engine No"       value={data.engine_no} />
          <InfoRow label="Allocation Date" value={data.allocation_date ? new Date(data.allocation_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Dispatch Date"   value={data.dispatch_date ? new Date(data.dispatch_date).toLocaleDateString("en-IN") : null} />
        </div>

        {/* ── Status & Dates (editable) ── */}
        <div className="sv-card">
          <div className="sv-card-title">
            Status & Delivery
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              <EditField label="Status" name="current_status">
                <select className="sv-edit-input" name="current_status"
                  value={form.current_status} onChange={handleChange}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </EditField>
              <EditField label="Delivery Date"           name="delivery_date"           value={form.delivery_date}           onChange={handleChange} type="date" />
              <EditField label="Estimated Delivery Date" name="estimated_delivery_date" value={form.estimated_delivery_date} onChange={handleChange} type="date" />
              <EditField label="Reason for Delay"        name="reason_for_delay"        value={form.reason_for_delay}        onChange={handleChange} />
              <EditField label="Communicate to ALCOP"    name="communicate_to_alcop"    value={form.communicate_to_alcop}    onChange={handleChange} />
            </>
          ) : (
            <>
              <InfoRow label="Status"                  value={data.current_status} />
              <InfoRow label="Delivery Date"           value={data.delivery_date ? new Date(data.delivery_date).toLocaleDateString("en-IN") : null} />
              <InfoRow label="Estimated Delivery"      value={data.estimated_delivery_date ? new Date(data.estimated_delivery_date).toLocaleDateString("en-IN") : null} />
              <InfoRow label="Reason for Delay"        value={data.reason_for_delay} />
              <InfoRow label="Communicate to ALCOP"    value={data.communicate_to_alcop} />
            </>
          )}
        </div>

        {/* ── Route ── */}
        <div className="sv-card">
          <div className="sv-card-title">Route & Dealer</div>
          <InfoRow label="Dealer"    value={data.dealer_name} />
          <InfoRow label="State"     value={data.state} />
          <InfoRow label="Distance"  value={data.km ? `${data.km} km` : null} />
        </div>

        {/* ── Vehicle ── */}
        <div className="sv-card">
          <div className="sv-card-title">Vehicle</div>
          <InfoRow label="Material No" value={data.material_no} />
          <InfoRow label="Model"       value={data.model} />
          <InfoRow label="Avg (km/L)"  value={data.avg} />
        </div>

        {/* ── Driver ── */}
        <div className="sv-card">
          <div className="sv-card-title">Driver</div>
          <InfoRow label="Name"      value={data.driver_name} />
          <InfoRow label="DL Number" value={data.driver_dl} />
          <InfoRow label="Payment"   value={data.driver_payment ? `₹${Number(data.driver_payment).toLocaleString("en-IN")}` : null} />
          <InfoRow label="Return Fare" value={data.return_fare ? `₹${Number(data.return_fare).toLocaleString("en-IN")}` : null} />
        </div>

        {/* ── Toll (editable) ── */}
        <div className="sv-card">
          <div className="sv-card-title">
            Toll
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              <EditField label="Manual Fix Toll (₹)" name="toll_manual" value={form.toll_manual} onChange={handleChange} type="number" />
              <EditField label="Toll Amount (₹)"     name="toll_amount" value={form.toll_amount} onChange={handleChange} type="number" />
            </>
          ) : (
            <>
              <InfoRow label="Manual Fix Toll" value={data.manual_toll_fix_toll ? `₹${Number(data.manual_toll_fix_toll).toLocaleString("en-IN")}` : null} />
              <InfoRow label="Toll Amount"     value={data.toll_amount ? `₹${Number(data.toll_amount).toLocaleString("en-IN")}` : null} />
            </>
          )}
        </div>

        {/* ── Fuel (editable, full width) ── */}
        <div className="sv-card sv-card-full">
          <div className="sv-card-title">
            Fuel Consumption
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              <PumpRow pump="pump1"     form={form} onChange={handleChange} />
              <PumpRow pump="pump2"     form={form} onChange={handleChange} />
              <PumpRow pump="pump3"     form={form} onChange={handleChange} />
              <PumpRow pump="pump4"     form={form} onChange={handleChange} />
              <PumpRow pump="fuel_card" form={form} onChange={handleChange} />
              <PumpRow pump="hsd"       form={form} onChange={handleChange} />
              <div className="sv-fuel-total">
                Total Fuel Cost: <strong>₹{totalFuel().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
              </div>
            </>
          ) : (
            <div className="sv-fuel-grid">
              {[
                { key: "pump1",     label: "Pump 1" },
                { key: "pump2",     label: "Pump 2" },
                { key: "pump3",     label: "Pump 3" },
                { key: "pump4",     label: "Pump 4" },
                { key: "fuel_card", label: "Fuel Card" },
                { key: "hsd",       label: "HSD" },
              ].map(({ key, label }) => (
                <div key={key} className="sv-fuel-cell">
                  <span className="sv-fuel-cell-label">{label}</span>
                  <span className="sv-fuel-cell-val">
                    {data[`${key}_qty`] > 0
                      ? `${data[`${key}_qty`]} L @ ₹${data[`${key}_rate`]}`
                      : <span className="sv-na">—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── State Taxes (editable, full width) ── */}
        <div className="sv-card sv-card-full">
          <div className="sv-card-title">
            State Taxes
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (() => {
            const usedCols = (form.taxes || []).map(t => t.col);
            const addTax = () => {
              const available = STATE_TAX_COLUMNS.find(s => !usedCols.includes(s.col));
              if (!available) return;
              setForm(f => ({ ...f, taxes: [...(f.taxes || []), { col: available.col, label: available.label, amount: "" }] }));
            };
            const updateTax = (idx, field, value) => {
              setForm(f => {
                const taxes = [...(f.taxes || [])];
                if (field === "col") {
                  const found = STATE_TAX_COLUMNS.find(s => s.col === value);
                  taxes[idx] = { col: value, label: found?.label || value, amount: taxes[idx].amount };
                } else {
                  taxes[idx] = { ...taxes[idx], [field]: value };
                }
                return { ...f, taxes };
              });
            };
            const removeTax = (idx) => setForm(f => ({ ...f, taxes: (f.taxes || []).filter((_, i) => i !== idx) }));

            return (
              <>
                {(form.taxes || []).length === 0 && (
                  <p className="sv-na" style={{ paddingBottom: 8 }}>No state taxes added yet.</p>
                )}
                {(form.taxes || []).map((tax, idx) => (
                  <div key={idx} className="sv-tax-row">
                    <div className="sv-edit-field" style={{ flex: 2 }}>
                      <label className="sv-edit-label">State</label>
                      <select className="sv-edit-input" value={tax.col}
                        onChange={e => updateTax(idx, "col", e.target.value)}>
                        {STATE_TAX_COLUMNS
                          .filter(s => s.col === tax.col || !usedCols.includes(s.col))
                          .map(s => <option key={s.col} value={s.col}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="sv-edit-field" style={{ flex: 2 }}>
                      <label className="sv-edit-label">Tax Amount (₹)</label>
                      <input className="sv-edit-input" type="number" value={tax.amount}
                        onChange={e => updateTax(idx, "amount", e.target.value)} placeholder="0.00" />
                    </div>
                    <button className="sv-remove-tax" onClick={() => removeTax(idx)}>✕</button>
                  </div>
                ))}
                {usedCols.length < STATE_TAX_COLUMNS.length && (
                  <button className="sv-add-tax-btn" onClick={addTax}>+ Add State Tax</button>
                )}
              </>
            );
          })() : (
            <div className="sv-tax-grid">
              {STATE_TAX_COLUMNS
                .filter(({ col }) => data[col] != null && Number(data[col]) > 0)
                .map(({ col, label }) => (
                  <div key={col} className="sv-tax-cell">
                    <span className="sv-tax-label">{label}</span>
                    <span className="sv-tax-val">₹{Number(data[col]).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              {STATE_TAX_COLUMNS.filter(({ col }) => data[col] != null && Number(data[col]) > 0).length === 0 && (
                <p className="sv-na" style={{ padding: "8px 0" }}>No state taxes recorded</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}