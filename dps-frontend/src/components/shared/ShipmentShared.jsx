import { useState, useRef, useEffect } from "react";
import { apiFetch } from "../../utils/apiClient";

export const EditField = ({ label, name, value, onChange, type = "text", children, hint, optional, ...props }) => (
  <div className="sv-edit-field">
    <label className="sv-edit-label">
      {label}
      {optional && <span className="sv-optional-tag">optional</span>}
    </label>
    {children || (
      <input className="sv-edit-input" type={type} name={name}
        value={value ?? ""} onChange={onChange} {...props} />
    )}
    {hint && <span className="sv-field-hint">{hint}</span>}
  </div>
);

const ENTRY_TYPES = [
  { value: "TIED_PUMP",  label: "Tied Pump" },
  { value: "FUEL_CARD",  label: "Fuel Card" },
  { value: "HSD",        label: "HSD" },
];

export const FuelEntryRow = ({
  entry, index, onChange, onRemove, pumps,
  requiredQty, filledQtyExcludingThis,
}) => {
  const amount     = (Number(entry.qty) || 0) * (Number(entry.rate) || 0);
  const isTiedPump = entry.entry_type === "TIED_PUMP";

  const selectedPump = isTiedPump && entry.pump_id
    ? pumps.find(p => p.id === Number(entry.pump_id))
    : null;

  const maxForThis    = requiredQty > 0
    ? Math.max(0, requiredQty - filledQtyExcludingThis)
    : null;

  const thisQty       = Number(entry.qty) || 0;
  const isOver        = maxForThis !== null && thisQty > maxForThis;
  const isExact       = maxForThis !== null && thisQty === maxForThis && thisQty > 0;

  const handleQtyChange = (e) => {
    const val = e.target.value;
    if (maxForThis !== null && Number(val) > maxForThis) {
      onChange(index, "qty", String(maxForThis));
    } else {
      onChange(index, "qty", val);
    }
  };

  return (
    <div className={`sv-fuel-entry-row ${isOver ? "sv-fuel-entry-row--over" : ""}`}>
      <div className="sv-fuel-entry-field sv-fuel-entry-type">
        <label className="sv-edit-label">Type</label>
        <select
          className="sv-edit-input sv-edit-select"
          value={entry.entry_type}
          onChange={e => onChange(index, "entry_type", e.target.value)}
        >
          {ENTRY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {isTiedPump && (
        <div className="sv-fuel-entry-field sv-fuel-entry-pump">
          <label className="sv-edit-label">Pump</label>
          <select
            className="sv-edit-input sv-edit-select"
            value={entry.pump_id || ""}
            onChange={e => onChange(index, "pump_id", e.target.value)}
          >
            <option value="">— Select pump —</option>
            {pumps && pumps.map(p => (
              <option key={p.id} value={p.id}>
                {p.pump_name} ({p.location} · {p.omc})
              </option>
            ))}
          </select>
          {selectedPump && (
            <span className="sv-pump-badge">
              {selectedPump.omc} · {selectedPump.location} · {selectedPump.fuel_category}
            </span>
          )}
        </div>
      )}

      <div className="sv-fuel-entry-field">
        <label className="sv-edit-label">
          Qty (L)
          {maxForThis !== null && maxForThis > 0 && (
            <span className="sv-qty-max"> max {maxForThis} L</span>
          )}
          {maxForThis === 0 && (
            <span className="sv-qty-max sv-qty-max--full"> quota full</span>
          )}
        </label>
        <input
          className={`sv-edit-input ${isOver ? "sv-input--error" : ""} ${isExact ? "sv-input--exact" : ""}`}
          type="number"
          min="0"
          max={maxForThis ?? undefined}
          value={entry.qty}
          onChange={handleQtyChange}
          placeholder="0"
          disabled={maxForThis === 0}
        />
        {isOver && (
          <span className="sv-qty-error">
            ⚠ Exceeds allowed qty by {(thisQty - maxForThis).toFixed(1)} L
          </span>
        )}
      </div>

      <div className="sv-fuel-entry-field">
        <label className="sv-edit-label">Rate (₹/L)</label>
        <input
          className="sv-edit-input"
          type="number"
          min="0"
          value={entry.rate}
          onChange={e => onChange(index, "rate", e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="sv-fuel-entry-amount">
        ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </div>

      <button type="button" className="sv-fuel-entry-remove" onClick={() => onRemove(index)} title="Remove">✕</button>
    </div>
  );
};

export function DLSearchWidget({ driverName, dlNumber, onConfirm, onClear }) {
  const [dlInput, setDlInput]         = useState(dlNumber || "");
  const [searching, setSearching]     = useState(false);
  const [foundDriver, setFoundDriver] = useState(null);
  const [notFound, setNotFound]       = useState(false);
  const dlRef = useRef();

  const [confirmed, setConfirmed] = useState(!!(driverName && dlNumber));

  const searchDL = async () => {
    const dl = dlInput.trim();
    if (!dl) return;
    setSearching(true); setNotFound(false); setFoundDriver(null);
    try {
      const res  = await apiFetch(`/api/drivers/search?dl=${encodeURIComponent(dl)}`);
      const json = await res.json();
      if (json.found && json.driver) {
        setFoundDriver(json.driver);
        onConfirm(json.driver.driver_name, json.driver.driver_dl);
        setConfirmed(true);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleManualConfirm = () => {
    const name = driverName?.trim();
    const dl   = dlInput.trim();
    if (name && dl) {
      onConfirm(name, dl);
      setConfirmed(true);
    }
  };

  const handleClear = () => {
    setFoundDriver(null); setNotFound(false);
    setDlInput(""); setConfirmed(false);
    onClear();
    setTimeout(() => dlRef.current?.focus(), 50);
  };

  if (confirmed && driverName && dlNumber) {
    return (
      <div className="sv-driver-confirmed">
        <div className="sv-driver-confirmed-info">
          <strong>{driverName}</strong>
          <span className="sv-driver-dl-tag">{dlNumber}</span>
          {foundDriver && <span className="sv-driver-matched">Matched</span>}
        </div>
        <button type="button" className="sv-driver-clear-btn" onClick={handleClear}>✕ Change</button>
      </div>
    );
  }

  return (
    <div className="sv-dl-search">
      <div className="sv-dl-row">
        <input
          ref={dlRef}
          className="sv-edit-input"
          placeholder="Search by DL Number"
          value={dlInput}
          onChange={e => setDlInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchDL()}
        />
        <button type="button" className="sv-dl-search-btn"
          onClick={searchDL} disabled={searching || !dlInput.trim()}>
          {searching ? <span className="sv-spinner sv-spinner-sm" /> : "Search"}
        </button>
      </div>

      {foundDriver && (
        <div className="sv-driver-found">
          <span className="sv-driver-found-tag">✓ Found</span>
          <strong>{foundDriver.driver_name}</strong>
          <span className="sv-driver-dl-tag">{foundDriver.driver_dl}</span>
        </div>
      )}

      {notFound && (
        <div className="sv-driver-not-found">
          <p className="sv-driver-nf-msg">DL not found — enter name manually</p>
          <EditField label="Driver Name" name="_driver_name_manual" value={driverName || ""}
            onChange={e => onConfirm(e.target.value, dlInput.trim())} optional={false} />
          <button type="button" className="sv-dl-confirm-btn" onClick={handleManualConfirm}
            disabled={!driverName?.trim() || !dlInput.trim()}>
            ✓ Use Details
          </button>
        </div>
      )}
    </div>
  );
}
