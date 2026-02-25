import { useState, useEffect } from "react";
import "../../assets/css/ApproveShipmentModal.css";

const Section = ({ title, children }) => (
  <div className="asm-section">
    <div className="asm-section-title">{title}</div>
    <div className="asm-section-body">{children}</div>
  </div>
);

const Field = ({ label, name, value, onChange, type = "text", required, hint }) => (
  <div className={`asm-field ${required ? "required" : ""}`}>
    <label className="asm-label">
      {label}
      {required && <span className="asm-required-star">*</span>}
    </label>
    <input
      className="asm-input"
      type={type}
      name={name}
      value={value ?? ""}
      onChange={onChange}
      placeholder={`Enter ${label.toLowerCase()}`}
    />
    {hint && <span className="asm-hint">{hint}</span>}
  </div>
);

export default function ApproveShipmentModal({ shipment, onClose, onApproved }) {
  const [form, setForm] = useState({
    // Route
    dispatch_plant:    "",
    delivery_location: "",
    state:             "",
    dealer_name:       "",
    km:                "",
    // Vehicle
    material_no: "",
    model:       "",
    avg:         "",
    // Driver
    driver_name: "",
    dl_number:   "",
    // Driver-Route payment
    driver_payment:     "",
    return_fare:        "",
    additional_payment: "0",
    // Toll
    toll_name:   "",
    toll_amount: "",
    // Tax
    tax_type:   "",
    tax_amount: "",
  });

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [matchInfo, setMatchInfo] = useState({ route: null, vehicle: null, driver: null });

  // Pre-fill from raw_ fields
  useEffect(() => {
    if (!shipment) return;
    setForm(prev => ({
      ...prev,
      dispatch_plant:    shipment.raw_dispatch_plant        || "",
      delivery_location: shipment.raw_delivery_location     || "",
      state:             shipment.raw_state                 || "",
      dealer_name:       shipment.raw_dealer_name           || "",
      km:                shipment.raw_km                    || "",
      material_no:       shipment.raw_vehicle_material_no   || "",
      model:             shipment.raw_vehicle_model         || "",
      avg:               shipment.raw_vehicle_avg           || "",
      driver_name:       shipment.raw_driver_name           || "",
      dl_number:         shipment.raw_dl_number             || "",
    }));
  }, [shipment]);

  // Debounced match check against existing masters
  useEffect(() => {
    const check = async () => {
      if (!form.dispatch_plant && !form.material_no && !form.dl_number) return;
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
        setMatchInfo(json.data || { route: null, vehicle: null, driver: null });
      } catch {
        // non-blocking
      }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [form.dispatch_plant, form.delivery_location, form.dealer_name, form.material_no, form.dl_number]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const checks = [
      [form.dispatch_plant,    "Dispatch Plant"],
      [form.delivery_location, "Delivery Location"],
      [form.dealer_name,       "Dealer Name"],
      [form.material_no,       "Material No"],
      [form.driver_name,       "Driver Name"],
      [form.dl_number,         "DL Number"],
    ];
    for (const [val, label] of checks) {
      if (!val?.toString().trim()) return `${label} is required`;
    }
    return null;
  };

  const handleApprove = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/shipments/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_id: shipment.shipment_id,
          route: {
            dispatch_plant:    form.dispatch_plant,
            delivery_location: form.delivery_location,
            state:             form.state,
            dealer_name:       form.dealer_name,
            km:                form.km || null,
          },
          vehicle: {
            material_no: form.material_no,
            model:       form.model,
            avg:         form.avg || null,
          },
          driver: {
            driver_name: form.driver_name,
            dl_number:   form.dl_number,
          },
          driver_route: {
            driver_payment:     form.driver_payment     || null,
            return_fare:        form.return_fare        || null,
            additional_payment: form.additional_payment || 0,
          },
          route_tax:  form.tax_amount  ? { tax_type:  form.tax_type,  tax_amount:  form.tax_amount  } : null,
          route_toll: form.toll_amount ? { toll_name: form.toll_name, toll_amount: form.toll_amount } : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Approval failed");

      onApproved(shipment.shipment_id);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!shipment) return null;

  return (
    <div className="asm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="asm-modal">

        {/* Header */}
        <div className="asm-header">
          <div className="asm-header-left">
            <div className="asm-badge">PENDING APPROVAL</div>
            <h2 className="asm-title">Shipment #{shipment.shipment_no}</h2>
          </div>
          <button className="asm-close" onClick={onClose}>✕</button>
        </div>

        {/* Raw CSV data reference strip */}
        <div className="asm-raw-strip">
          <span className="asm-raw-label">FROM CSV →</span>
          {shipment.raw_dispatch_plant      && <span className="asm-raw-chip">{shipment.raw_dispatch_plant}</span>}
          {shipment.raw_delivery_location   && <span className="asm-raw-chip">{shipment.raw_delivery_location}</span>}
          {shipment.raw_dealer_name         && <span className="asm-raw-chip">{shipment.raw_dealer_name}</span>}
          {shipment.raw_vehicle_material_no && <span className="asm-raw-chip">{shipment.raw_vehicle_material_no}</span>}
          {shipment.raw_vehicle_model       && <span className="asm-raw-chip">{shipment.raw_vehicle_model}</span>}
          {shipment.raw_driver_name         && <span className="asm-raw-chip">{shipment.raw_driver_name}</span>}
        </div>

        {/* Scrollable body */}
        <div className="asm-body">

          <Section title="Route Master">
            {matchInfo.route && (
              <div className="asm-match-banner">
                ✓ Existing route found (ID #{matchInfo.route.route_id}) — will link, not duplicate
              </div>
            )}
            <div className="asm-grid-2">
              <Field label="Dispatch Plant"    name="dispatch_plant"    value={form.dispatch_plant}    onChange={handleChange} required />
              <Field label="Delivery Location" name="delivery_location" value={form.delivery_location} onChange={handleChange} required />
              <Field label="Dealer Name"       name="dealer_name"       value={form.dealer_name}       onChange={handleChange} required />
              <Field label="State"             name="state"             value={form.state}             onChange={handleChange} />
            </div>
            <div className="asm-grid-1" style={{ marginTop: 12 }}>
              <Field label="Distance (km)" name="km" value={form.km} onChange={handleChange} type="number" hint="Leave blank if unknown" />
            </div>
          </Section>

          <Section title="Vehicle Master">
            {matchInfo.vehicle && (
              <div className="asm-match-banner">
                ✓ Existing vehicle found (ID #{matchInfo.vehicle.vehicle_id}) — will link, not duplicate
              </div>
            )}
            <div className="asm-grid-3">
              <Field label="Material No" name="material_no" value={form.material_no} onChange={handleChange} required />
              <Field label="Model"       name="model"       value={form.model}       onChange={handleChange} />
              <Field label="Avg (km/l)"  name="avg"         value={form.avg}         onChange={handleChange} type="number" />
            </div>
          </Section>

          <Section title="Driver Master">
            {matchInfo.driver && (
              <div className="asm-match-banner">
                ✓ Existing driver found (ID #{matchInfo.driver.driver_id}) — will link, not duplicate
              </div>
            )}
            <div className="asm-grid-2">
              <Field label="Driver Name" name="driver_name" value={form.driver_name} onChange={handleChange} required />
              <Field label="DL Number"   name="dl_number"   value={form.dl_number}   onChange={handleChange} required />
            </div>
          </Section>

          <Section title="Driver Route Payment">
            <div className="asm-grid-3">
              <Field label="Driver Payment (₹)"     name="driver_payment"     value={form.driver_payment}     onChange={handleChange} type="number" />
              <Field label="Return Fare (₹)"        name="return_fare"        value={form.return_fare}        onChange={handleChange} type="number" />
              <Field label="Additional Payment (₹)" name="additional_payment" value={form.additional_payment} onChange={handleChange} type="number" />
            </div>
          </Section>

          <Section title="Route Toll (Optional)">
            <div className="asm-grid-2">
              <Field label="Toll Name"       name="toll_name"   value={form.toll_name}   onChange={handleChange} hint="Leave blank to skip" />
              <Field label="Toll Amount (₹)" name="toll_amount" value={form.toll_amount} onChange={handleChange} type="number" />
            </div>
          </Section>

          <Section title="Route Tax (Optional)">
            <div className="asm-grid-2">
              <Field label="Tax Type"       name="tax_type"   value={form.tax_type}   onChange={handleChange} hint="e.g. GST, Entry Tax" />
              <Field label="Tax Amount (₹)" name="tax_amount" value={form.tax_amount} onChange={handleChange} type="number" />
            </div>
          </Section>

        </div>

        {error && <div className="asm-error">⚠ {error}</div>}

        <div className="asm-footer">
          <button className="asm-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="asm-btn-approve" onClick={handleApprove} disabled={loading}>
            {loading ? <span className="asm-spinner" /> : "✓ Approve & Create Masters"}
          </button>
        </div>

      </div>
    </div>
  );
}