import { useEffect, useState, useRef } from "react";
import "../../assets/css//ShipmentView.css";
import { apiFetch, getUser } from "../../utils/apiClient";
import { FuelEntryRow } from "../shared/ShipmentShared";

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

const STATUSES = ["Dispatched", "Running", "Delivered", "Accident"];

/* Fields required before Delivered status is allowed */
const DELIVERED_REQUIRED = [
  { key: "chassis_no", label: "Chassis No" },
  { key: "engine_no", label: "Engine No" },
  { key: "delivery_date", label: "Delivery Date" },
];

const MAX_POD_SIZE = 300 * 1024; // 300 KB
const POD_ALLOWED = ["image/jpeg", "image/jpg", "image/png"];

/* ── Small helpers ──────────────────────────────────────────────── */
const InfoRow = ({ label, value }) => (
  <div className="sv-info-row">
    <span className="sv-info-label">{label}</span>
    <span className="sv-info-value">{value ?? <span className="sv-na">—</span>}</span>
  </div>
);

const EditField = ({ label, name, value, onChange, type = "text", disabled, children }) => (
  <div className={`sv-edit-field ${disabled ? "sv-disabled-field" : ""}`}>
    <label className="sv-edit-label">{label}</label>
    {children || (
      <input
        className="sv-edit-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={disabled ? undefined : onChange}
        disabled={disabled}
      />
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function ShipmentView({ shipmentId, onBack }) {
  const [data, setData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [deliveredErrors, setDeliveredErrors] = useState([]);

  // POD state
  const [podFile, setPodFile] = useState(null);   // File object
  const [podPreview, setPodPreview] = useState(null);   // data URL for preview
  const [podError, setPodError] = useState(null);
  const podInputRef = useRef();

  // Fund request state
  const [fundRequesting, setFundRequesting] = useState(false);
  const [fundSuccess, setFundSuccess] = useState(false);
  const [fundError, setFundError] = useState(null);

  // Petrol pumps for fuel dropdown
  const [pumps, setPumps] = useState([]);

  useEffect(() => {
    apiFetch(`/api/shipments/petrol-pumps`)
      .then(r => { if (r && r.ok) return r.json(); return { success: false }; })
      .then(j => { if (j.success) setPumps(j.data || []); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    apiFetch(`/api/shipments/${shipmentId}`)
      .then(r => {
        if (!r) throw new Error("Session expired — please log in again");
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(j => {
        if (j.success && j.data) {
          setData(j.data);
          initForm(j.data);
        } else {
          setError(j.message || "Failed to load shipment");
        }
      })
      .catch(e => setError(e.message || "Failed to load"));
  }, [shipmentId]);

  const initForm = (d) => {
    if (!d) return;
    const taxes = STATE_TAX_COLUMNS
      .filter(({ col }) => d[col] != null)
      .map(({ col, label }) => ({ col, label, amount: d[col] }));

    // Initialize fuel entries from normalized data
    const fuelEntries = (d.fuel_entries || []).map(e => ({
      entry_type: e.entry_type || "TIED_PUMP",
      pump_id: e.pump_id || "",
      qty: e.qty ?? "",
      rate: e.rate ?? "",
    }));
    if (fuelEntries.length === 0) {
      fuelEntries.push({ entry_type: "TIED_PUMP", pump_id: "", qty: "", rate: "" });
    }

    setForm({
      current_status: d.current_status || "",
      delivery_date: d.delivery_date?.slice(0, 10) || "",
      estimated_delivery_date: d.estimated_delivery_date?.slice(0, 10) || "",
      reason_for_delay: d.reason_for_delay || "",
      communicate_to_alcop: d.communicate_to_alcop || "",
      toll_manual: d.manual_toll_fix_toll ?? "",
      toll_amount: d.toll_amount ?? "",
      taxes,
      fuel_entries: fuelEntries,
      driver_name: "",
      dl_number: "",
    });
    // Reset POD state when reinitialising
    setPodFile(null);
    setPodPreview(d.pod_path ? `${import.meta.env.VITE_API_URL}/${d.pod_path}` : null);
    setPodError(null);
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // Debounced DL lookup in edit mode — autofill driver name if found in driver_master
  useEffect(() => {
    if (!form.dl_number?.trim()) return;
    const t = setTimeout(async () => {
      try {
        const res  = await apiFetch(`/api/drivers/search?dl=${encodeURIComponent(form.dl_number.trim())}`);
        const json = await res.json();
        if (json.found && json.driver?.driver_name) {
          setForm(prev => ({ ...prev, driver_name: json.driver.driver_name }));
        }
      } catch {
        // non-blocking
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form.dl_number]);

  /* ── Fuel entry handlers ───────────────────────────────────────── */
  const handleFuelChange = (index, field, value) => {
    setForm(f => {
      const entries = [...f.fuel_entries];
      entries[index] = { ...entries[index], [field]: value };
      if (field === "entry_type" && value !== "TIED_PUMP") entries[index].pump_id = "";
      return { ...f, fuel_entries: entries };
    });
  };
  const handleFuelAdd = () => setForm(f => ({
    ...f, fuel_entries: [...f.fuel_entries, { entry_type: "TIED_PUMP", pump_id: "", qty: "", rate: "" }]
  }));
  const handleFuelRemove = index => setForm(f => ({
    ...f, fuel_entries: f.fuel_entries.filter((_, i) => i !== index)
  }));

  const totalFuel = () => {
    return (form.fuel_entries || []).reduce((sum, e) =>
      sum + (Number(e.qty || 0) * Number(e.rate || 0)), 0);
  };

  /* ── POD file handler ──────────────────────────────────────────── */
  const handlePodChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!POD_ALLOWED.includes(file.type)) {
      setPodError("Only JPG, JPEG and PNG files are allowed.");
      setPodFile(null);
      e.target.value = "";
      return;
    }
    if (file.size > MAX_POD_SIZE) {
      setPodError(`File too large. Max size is 300 KB (current: ${(file.size / 1024).toFixed(0)} KB).`);
      setPodFile(null);
      e.target.value = "";
      return;
    }

    setPodError(null);
    setPodFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPodPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  /* ── Delivered validation ──────────────────────────────────────── */
  const validateDelivered = () => {
    if (form.current_status !== "Delivered") return [];

    const missing = [];

    // Static fields on the shipment record itself
    DELIVERED_REQUIRED.forEach(({ key, label }) => {
      const val = key === "delivery_date" ? form[key] : data?.[key];
      if (!val || String(val).trim() === "") missing.push(label);
    });

    // Toll: at least one toll field must be filled
    const hasToll = Number(form.toll_manual) > 0 || Number(form.toll_amount) > 0;
    if (!hasToll) missing.push("Toll (Manual Fix Toll or Toll Amount)");

    // POD: either existing pod_path on record OR new file selected
    const hasPod = (data?.pod_path && !podFile) || podFile;
    if (!hasPod) missing.push("POD (Proof of Delivery image)");

    return missing;
  };

  /* ── Save ──────────────────────────────────────────────────────── */
  const handleSave = async () => {
    setDeliveredErrors([]);
    const missing = validateDelivered();
    if (missing.length > 0) {
      setDeliveredErrors(missing);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const taxPayload = {};
      (form.taxes || []).forEach(t => {
        if (t.col && t.amount !== "" && t.amount != null) taxPayload[t.col] = t.amount;
      });

      // If POD file selected, upload it first via FormData
      let podPath = data?.pod_path || null;
      if (podFile) {
        const fd = new FormData();
        fd.append("pod", podFile);
        fd.append("shipment_id", shipmentId);
        const podRes = await apiFetch(`/api/shipments/${shipmentId}/pod`, {
          method: "POST",
          body: fd,
        });
        const podJson = await podRes.json();
        if (!podRes.ok) throw new Error(podJson.message || "POD upload failed");
        podPath = podJson.pod_path;
      }

      const res = await apiFetch(`/api/shipments/${shipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_status: form.current_status,
          delivery_date: form.delivery_date || null,
          estimated_delivery_date: form.estimated_delivery_date || null,
          reason_for_delay: form.reason_for_delay || null,
          communicate_to_alcop: form.communicate_to_alcop || null,
          route_id: data.route_id,
          vehicle_id: data.vehicle_id,
          toll: { manual_toll_fix_toll: form.toll_manual, toll_amount: form.toll_amount },
          tax: taxPayload,
          fuel_entries: form.fuel_entries,
          driver: (form.driver_name && form.dl_number) ? { driver_name: form.driver_name, dl_number: form.dl_number } : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed");

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setEditMode(false);

      const fresh = await apiFetch(`/api/shipments/${shipmentId}`).then(r => r.json());
      setData(fresh.data);
      initForm(fresh.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) {
    return (
      <div className="sv-wrapper">
        <div className="sv-topbar"><button className="sv-back-btn" onClick={onBack}>← Back</button></div>
        <div className="sv-error" style={{ margin: 20 }}>⚠ {error}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="sv-wrapper"><div className="sv-loading">Loading shipment details…</div></div>;
  }

  const statusClass = data.current_status?.toLowerCase().replace(/\s+/g, "-") || "";

  // ── Role-based edit permissions ──────────────────────────────────
  const user = getUser();
  const userRole = user?.role || "branch";
  const isAdmin = userRole === "admin";
  const isHold = data.approval_status === "HOLD";
  const isApproval = data.approval_status === "APPROVAL";
  const isActive = data.approval_status === "ACTIVE";

  // Branch can edit HOLD shipments that have matched route & vehicle
  const branchCanEditHold = isHold && data.route_id && data.vehicle_id;

  // Admin: can always edit — no restrictions
  // Branch: can only edit HOLD shipments with matched route & vehicle
  const canEdit = isAdmin || (userRole === "branch" && branchCanEditHold);

  // Fuel quota calculation for entry validation
  const requiredFuel = Math.ceil((Number(data.km) || 0) / (Number(data.avg) || 1));

  /* ── Cost Summary Calculations ───────────────────────────────────── */
  const calcTaxTotal = () => {
    return STATE_TAX_COLUMNS.reduce(
      (sum, { col }) => sum + (Number(data[col]) || 0), 0
    );
  };
  const calcDriverTotal = () => {
    return (Number(data.driver_payment) || 0) + (Number(data.return_fare) || 0);
  };
  const calcTollTotal = () => {
    return (Number(data.manual_toll_fix_toll) || 0) + (Number(data.toll_amount) || 0);
  };
  const calcFuelTotal = () => {
    return Number(data.fuel_total) || 0;
  };
  const calcGrandTotal = () => {
    return calcTaxTotal() + calcDriverTotal() + calcTollTotal() + calcFuelTotal();
  };

  /* ── Fund Request Readiness Check ────────────────────────────────── */
  // Tax can be null/0 for a valid matched route — only fuel and toll are required
  const isFundReady = isHold
    && calcFuelTotal() > 0
    && calcTollTotal() > 0;

  /* ── Fund Request Handler ──────────────────────────────────────── */
  const handleFundRequest = async () => {
    setFundRequesting(true);
    setFundError(null);
    try {
      const res = await apiFetch(`/api/shipments/${shipmentId}/fund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Fund request failed");
      }
      setFundSuccess(true);
      // Refresh shipment data to reflect new ACTIVE status
      const fresh = await apiFetch(`/api/shipments/${shipmentId}`).then(r => r.json());
      if (fresh.success && fresh.data) {
        setData(fresh.data);
        initForm(fresh.data);
      }
    } catch (e) {
      setFundError(e.message);
    } finally {
      setFundRequesting(false);
    }
  };

  return (
    <div className="sv-wrapper">
      {/* Top bar */}
      <div className="sv-topbar">
        <button className="sv-back-btn" onClick={onBack}>← Back to Shipments</button>
        <div className="sv-topbar-right">
          {saved && <span className="sv-saved-toast">✓ Saved successfully</span>}
          {!editMode ? (
            <>
              {canEdit
                ? <button className="sv-edit-btn" onClick={() => { setEditMode(true); setDeliveredErrors([]); }}>✏ Edit</button>
                : (isApproval ? <span className="sv-view-only-badge">⏳ Awaiting Approval</span> : isActive ? <span className="sv-view-only-badge">✅ Approved</span> : isHold ? <span className="sv-view-only-badge">🔒 Read Only (Hold)</span> : <span className="sv-view-only-badge">👁 View Only</span>)
              }
              {/* Fund Generated badge — persistent once shipment is ACTIVE */}
              {isActive && (
                <span className="sv-fund-generated-badge">✅ Fund Generated</span>
              )}
              {/* Generate Fund Request — only visible for HOLD shipments when all cost data is filled */}
              {isHold && isFundReady && !fundSuccess && (
                <button
                  className="sv-fund-btn"
                  onClick={handleFundRequest}
                  disabled={fundRequesting}
                >
                  {fundRequesting ? <span className="sv-spinner-sm" /> : "💰 Generate Fund Request"}
                </button>
              )}
            </>
          ) : (
            <>
              <button className="sv-cancel-btn" onClick={() => { setEditMode(false); initForm(data); setDeliveredErrors([]); }}>Cancel</button>
              <button className="sv-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? <span className="sv-spinner" /> : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="sv-hero">
        <div className="sv-hero-left">
          <div className="sv-hero-no">#{data.shipment_no}</div>
          <span className={`sv-status-badge sv-status-${statusClass}`}>{data.current_status}</span>
          {isHold && <span className="sv-hold-badge">HOLD</span>}
          {data.approval_status === "APPROVAL" && <span className="sv-hold-badge" style={{ background: "#f59e0b", borderColor: "#f59e0b" }}>APPROVAL</span>}
        </div>
        <div className="sv-hero-route">
          <span className="sv-route-plant">{data.dispatch_plant || "—"}</span>
          <span className="sv-route-arrow">→</span>
          <span className="sv-route-dest">{data.delivery_location || "—"}</span>
          {data.km && <span className="sv-route-km">{data.km} km</span>}
        </div>
      </div>

      {/* ── Cost Summary Banner ──────────────────────────────────────── */}
      {(isHold || isActive) && (
        <div className="sv-expense-banner">
          <div className="sv-expense-item">
            <span className="sv-expense-label">Tax</span>
            <span className="sv-expense-val">₹{calcTaxTotal().toLocaleString("en-IN")}</span>
          </div>
          <div className="sv-expense-divider" />
          <div className="sv-expense-item">
            <span className="sv-expense-label">Driver</span>
            <span className="sv-expense-val">₹{calcDriverTotal().toLocaleString("en-IN")}</span>
          </div>
          <div className="sv-expense-divider" />
          <div className="sv-expense-item">
            <span className="sv-expense-label">Toll</span>
            <span className="sv-expense-val">₹{calcTollTotal().toLocaleString("en-IN")}</span>
          </div>
          <div className="sv-expense-divider" />
          <div className="sv-expense-item">
            <span className="sv-expense-label">Fuel</span>
            <span className="sv-expense-val">₹{calcFuelTotal().toLocaleString("en-IN")}</span>
          </div>
          <div className="sv-expense-divider sv-expense-divider-thick" />
          <div className="sv-expense-item sv-expense-total">
            <span className="sv-expense-label">Total</span>
            <span className="sv-expense-val sv-expense-grand">₹{calcGrandTotal().toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}

      {/* Fund request success */}
      {fundSuccess && (
        <div className="sv-fund-success">
          ✅ Fund request generated successfully — shipment is now <strong>Active</strong> and visible in Finance.
        </div>
      )}

      {/* Fund request error */}
      {fundError && <div className="sv-error">⚠ Fund Request: {fundError}</div>}

      {/* Delivered validation errors */}
      {deliveredErrors.length > 0 && (
        <div className="sv-delivered-block">
          <div className="sv-delivered-title">⚠ Cannot mark as Delivered — please fill the following fields first:</div>
          <ul className="sv-delivered-list">
            {deliveredErrors.map(e => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {error && <div className="sv-error">⚠ {error}</div>}

      <div className="sv-grid">

        {/* Shipment Info */}
        <div className="sv-card">
          <div className="sv-card-title">Shipment Details</div>
          <InfoRow label="Shipment Date" value={data.shipment_date ? new Date(data.shipment_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Billing Doc No" value={data.billing_doc_number} />
          <InfoRow label="Billing Date" value={data.billing_date ? new Date(data.billing_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Chassis No" value={data.chassis_no} />
          <InfoRow label="Engine No" value={data.engine_no} />
          <InfoRow label="Allocation Date" value={data.allocation_date ? new Date(data.allocation_date).toLocaleDateString("en-IN") : null} />
          <InfoRow label="Dispatch Date" value={data.dispatch_date ? new Date(data.dispatch_date).toLocaleDateString("en-IN") : null} />
        </div>

        {/* Status & Dates */}
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

              {form.current_status === "Delivered" && (
                <div className="sv-delivered-hint">
                  ℹ Chassis No, Engine No, Delivery Date, Toll and POD are required to save as Delivered.
                </div>
              )}

              <EditField label="Delivery Date" name="delivery_date" value={form.delivery_date} onChange={handleChange} type="date" />
              <EditField label="Estimated Delivery Date" name="estimated_delivery_date" value={form.estimated_delivery_date} onChange={handleChange} type="date" />
              <EditField label="Reason for Delay" name="reason_for_delay" value={form.reason_for_delay} onChange={handleChange} />
              <EditField label="Communicate to ALCOP" name="communicate_to_alcop" value={form.communicate_to_alcop} onChange={handleChange} />
            </>
          ) : (
            <>
              <InfoRow label="Status" value={data.current_status} />
              <InfoRow label="Delivery Date" value={data.delivery_date ? new Date(data.delivery_date).toLocaleDateString("en-IN") : null} />
              <InfoRow label="Estimated Delivery" value={data.estimated_delivery_date ? new Date(data.estimated_delivery_date).toLocaleDateString("en-IN") : null} />
              <InfoRow label="Reason for Delay" value={data.reason_for_delay} />
              <InfoRow label="Communicate to ALCOP" value={data.communicate_to_alcop} />
            </>
          )}
        </div>

        {/* Route */}
        <div className="sv-card">
          <div className="sv-card-title">Route & Dealer</div>
          <InfoRow label="Dealer" value={data.dealer_name} />
          <InfoRow label="State" value={data.state} />
          <InfoRow label="Distance" value={data.km ? `${data.km} km` : null} />
        </div>

        {/* Vehicle */}
        <div className="sv-card">
          <div className="sv-card-title">Vehicle</div>
          <InfoRow label="Material No" value={data.material_no} />
          <InfoRow label="Model" value={data.model} />
          <InfoRow label="Avg (km/L)" value={data.avg} />
        </div>

        {/* Driver */}
        <div className="sv-card">
          <div className="sv-card-title">
            Driver
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              <EditField label="Driver Name" name="driver_name" value={form.driver_name} onChange={handleChange} />
              <EditField label="DL Number"   name="dl_number"   value={form.dl_number}   onChange={handleChange} />
            </>
          ) : (
            <>
              <InfoRow label="Name" value={data.driver_name} />
              <InfoRow label="DL Number" value={data.driver_dl} />
            </>
          )}
          <InfoRow label="Payment" value={data.driver_payment ? `₹${Number(data.driver_payment).toLocaleString("en-IN")}` : null} />
          <InfoRow label="Return Fare" value={data.return_fare ? `₹${Number(data.return_fare).toLocaleString("en-IN")}` : null} />
        </div>

        {/* Toll */}
        <div className="sv-card">
          <div className="sv-card-title">
            Toll
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              <EditField label="Manual Fix Toll (₹)" name="toll_manual" value={form.toll_manual} onChange={handleChange} type="number" disabled={!isAdmin && (data.manual_toll_fix_toll != null && data.manual_toll_fix_toll !== "")} />
              <EditField label="Toll Amount (₹)" name="toll_amount" value={form.toll_amount} onChange={handleChange} type="number" disabled={!isAdmin && (data.toll_amount != null && data.toll_amount !== "")} />
            </>
          ) : (
            <>
              <InfoRow label="Manual Fix Toll" value={data.manual_toll_fix_toll ? `₹${Number(data.manual_toll_fix_toll).toLocaleString("en-IN")}` : null} />
              <InfoRow label="Toll Amount" value={data.toll_amount ? `₹${Number(data.toll_amount).toLocaleString("en-IN")}` : null} />
            </>
          )}
        </div>

        {/* POD — full width */}
        <div className="sv-card sv-card-full">
          <div className="sv-card-title">
            Proof of Delivery (POD)
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>

          {editMode ? (
            <div className="sv-pod-edit">
              <label className="sv-pod-upload-area" onClick={() => podInputRef.current?.click()}>
                {podPreview ? (
                  <img src={podPreview} alt="POD preview" className="sv-pod-preview-img" />
                ) : (
                  <div className="sv-pod-placeholder">
                    <span className="sv-pod-icon">📎</span>
                    <span className="sv-pod-upload-text">Click to upload POD</span>
                    <span className="sv-pod-upload-hint">JPG, JPEG, PNG · Max 300 KB</span>
                  </div>
                )}
                <input
                  ref={podInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  style={{ display: "none" }}
                  onChange={handlePodChange}
                />
              </label>

              {podFile && (
                <div className="sv-pod-file-info">
                  <span>📄 {podFile.name}</span>
                  <span className="sv-pod-size">{(podFile.size / 1024).toFixed(0)} KB</span>
                  <button className="sv-pod-remove" onClick={() => {
                    setPodFile(null);
                    setPodPreview(data?.pod_path ? `${import.meta.env.VITE_API_URL}/${data.pod_path}` : null);
                    if (podInputRef.current) podInputRef.current.value = "";
                  }}>✕ Remove</button>
                </div>
              )}

              {podError && <div className="sv-pod-error">⚠ {podError}</div>}
            </div>
          ) : (
            <div className="sv-pod-view">
              {data.pod_path ? (
                <a href={`${import.meta.env.VITE_API_URL}/${data.pod_path}`} target="_blank" rel="noreferrer">
                  <img
                    src={`${import.meta.env.VITE_API_URL}/${data.pod_path}`}
                    alt="Proof of Delivery"
                    className="sv-pod-view-img"
                  />
                  <span className="sv-pod-view-link">View full image ↗</span>
                </a>
              ) : (
                <p className="sv-na">No POD uploaded yet</p>
              )}
            </div>
          )}
        </div>

        {/* Fuel — full width */}
        <div className="sv-card sv-card-full">
          <div className="sv-card-title">
            Fuel Consumption
            {editMode && <span className="sv-editable-hint">Editing</span>}
          </div>
          {editMode ? (
            <>
              {(form.fuel_entries || []).map((entry, idx) => (
                <FuelEntryRow
                  key={idx}
                  entry={entry}
                  index={idx}
                  pumps={pumps}
                  onChange={handleFuelChange}
                  onRemove={handleFuelRemove}
                  requiredQty={requiredFuel}
                  filledQtyExcludingThis={(form.fuel_entries || []).reduce((sum, e, i) => i !== idx ? sum + (Number(e.qty) || 0) : sum, 0)}
                />
              ))}
              <button className="sv-add-tax-btn" onClick={handleFuelAdd} style={{ marginTop: 12 }}>+ Add Fuel Entry</button>
              <div className="sv-fuel-total">
                Total Fuel Cost: <strong>₹{totalFuel().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
              </div>
            </>
          ) : (
            <div className="sv-fuel-grid">
              {(data.fuel_entries || []).length > 0 ? (
                (data.fuel_entries || []).map((entry, idx) => {
                  const label = entry.entry_type === "TIED_PUMP"
                    ? (entry.pump_name ? `${entry.pump_name} (${entry.location || ""})` : "Tied Pump")
                    : entry.entry_type === "FUEL_CARD" ? "Fuel Card" : "HSD";
                  return (
                    <div key={idx} className="sv-fuel-cell">
                      <span className="sv-fuel-cell-label">{label}</span>
                      <span className="sv-fuel-cell-val">
                        {Number(entry.qty) > 0
                          ? `${entry.qty} L @ ₹${entry.rate} = ₹${Number(entry.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : <span className="sv-na">—</span>}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="sv-na" style={{ padding: "8px 0" }}>No fuel entries recorded</p>
              )}
              {(data.fuel_entries || []).length > 0 && (
                <div className="sv-fuel-total" style={{ marginTop: 8 }}>
                  Total: <strong>₹{Number(data.fuel_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* State Taxes — full width */}
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
                        disabled={!isAdmin && (data[tax.col] != null && data[tax.col] !== "")}
                        onChange={e => updateTax(idx, "col", e.target.value)}>
                        {STATE_TAX_COLUMNS
                          .filter(s => s.col === tax.col || !usedCols.includes(s.col))
                          .map(s => <option key={s.col} value={s.col}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="sv-edit-field" style={{ flex: 2 }}>
                      <label className="sv-edit-label">Tax Amount (₹)</label>
                      <input className="sv-edit-input" type="number" value={tax.amount}
                        disabled={!isAdmin && (data[tax.col] != null && data[tax.col] !== "" && tax.col !== "tamil_nadu_tax")}
                        onChange={e => updateTax(idx, "amount", e.target.value)} placeholder="0.00" />
                    </div>
                    {(isAdmin || data[tax.col] == null || data[tax.col] === "") && <button className="sv-remove-tax" onClick={() => removeTax(idx)}>✕</button>}
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