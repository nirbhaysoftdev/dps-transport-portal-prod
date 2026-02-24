import { useState } from "react";

export default function ShipmentForm({
  form,
  setForm,
  dispatchLocations,
  deliveryLocations,
  vehicles,
  dealers,
  statuses,
  driverRoutes,
  onDispatchChange,
  onVehicleChange,
}) {
  const [step, setStep] = useState(1);

  const handleChange = (field, value) =>
    setForm(f => ({ ...f, [field]: value }));

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="shipment-form">
      {/* ------------------ Step Indicators ------------------ */}
      <div className="step-indicator">Step {step} / 5</div>

      {/* ------------------ Step 1: Shipment Info ------------------ */}
      {step === 1 && (
        <div className="form-step">
          <label htmlFor="shipment_date">Shipment Date</label>
          <input
            id="shipment_date"
            type="date"
            value={form.shipment_date}
            disabled
          />

          <label htmlFor="shipment_no">Shipment No *</label>
          <input
            id="shipment_no"
            placeholder="Shipment No"
            value={form.shipment_no}
            onChange={e => handleChange("shipment_no", e.target.value)}
          />

          <label htmlFor="current_status">Status *</label>
          <select
            id="current_status"
            value={form.current_status}
            onChange={e => handleChange("current_status", e.target.value)}
          >
            <option value="">Select Status</option>
            {statuses.map((s, i) => (
              <option key={i} value={s.status_name}>
                {s.status_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ------------------ Step 2: Billing & Allocation ------------------ */}
      {step === 2 && (
        <div className="form-step">
          <label htmlFor="billing_doc_number">Billing Doc No</label>
          <input
            id="billing_doc_number"
            placeholder="Billing Doc No"
            value={form.billing_doc_number}
            onChange={e => handleChange("billing_doc_number", e.target.value)}
          />

          <label htmlFor="billing_date">Billing Date</label>
          <input
            id="billing_date"
            type="date"
            value={form.billing_date}
            onChange={e => handleChange("billing_date", e.target.value)}
          />

          <label htmlFor="chassis_no">Chassis No</label>
          <input
            id="chassis_no"
            placeholder="Chassis No"
            value={form.chassis_no}
            onChange={e => handleChange("chassis_no", e.target.value)}
          />

          <label htmlFor="engine_no">Engine No</label>
          <input
            id="engine_no"
            placeholder="Engine No"
            value={form.engine_no}
            onChange={e => handleChange("engine_no", e.target.value)}
          />

          <label htmlFor="allocation_date">Allocation Date</label>
          <input
            id="allocation_date"
            type="date"
            value={form.allocation_date}
            onChange={e => handleChange("allocation_date", e.target.value)}
          />
        </div>
      )}

      {/* ------------------ Step 3: Route Info ------------------ */}
      {step === 3 && (
        <div className="form-step">
          <label htmlFor="dispatch_date">Dispatch Date</label>
          <input
            id="dispatch_date"
            type="date"
            value={form.dispatch_date}
            onChange={e => handleChange("dispatch_date", e.target.value)}
          />

          <label htmlFor="dispatch_location">Dispatch Location *</label>
          <select
            id="dispatch_location"
            value={form.dispatch_location}
            onChange={e => onDispatchChange(e.target.value)}
          >
            <option value="">Select Dispatch Location</option>
            {dispatchLocations.map((d, i) => (
              <option key={i} value={d.dispatch_plant}>
                {d.dispatch_plant}
              </option>
            ))}
          </select>

          <label htmlFor="delivery_location">Delivery Location *</label>
          <select
            id="delivery_location"
            value={form.delivery_location}
            onChange={e => handleChange("delivery_location", e.target.value)}
          >
            <option value="">Select Delivery Location</option>
            {deliveryLocations.map((d, i) => (
              <option key={i} value={d.delivery_location}>
                {d.delivery_location}
              </option>
            ))}
          </select>

          <label htmlFor="dealer_name">Dealer *</label>
          <select
            id="dealer_name"
            value={form.dealer_name}
            onChange={e => handleChange("dealer_name", e.target.value)}
          >
            <option value="">Select Dealer</option>
            {dealers.map((d, i) => (
              <option key={i} value={d.dealer_name}>
                {d.dealer_name}
              </option>
            ))}
          </select>

          <label htmlFor="state">State *</label>
          <input
            id="state"
            placeholder="State"
            value={form.state || ""}
            onChange={e => handleChange("state", e.target.value)}
          />
        </div>
      )}

      {/* ------------------ Step 4: Vehicle & Driver ------------------ */}
      {step === 4 && (
        <div className="form-step">
          <label htmlFor="vehicle_id">Vehicle</label>
          <select
            id="vehicle_id"
            value={form.vehicle_id}
            onChange={e => onVehicleChange(e.target.value)}
          >
            <option value="">Select Vehicle</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.model}
              </option>
            ))}
          </select>

          <label htmlFor="driver_route_id">Driver</label>
          <select
            id="driver_route_id"
            value={form.driver_route_id}
            onChange={e => handleChange("driver_route_id", e.target.value)}
          >
            <option value="">Select Driver</option>
            {driverRoutes.map(d => (
              <option key={d.driver_route_id} value={d.driver_route_id}>
                {d.driver_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ------------------ Step 5: Delivery Details (Read-only) ------------------ */}
      {step === 5 && (
        <div className="form-step">
          <label htmlFor="km">KM</label>
          <input id="km" value={form.km || ""} disabled placeholder="KM" />

          <label htmlFor="eta">ETA</label>
          <input
            id="eta"
            value={form.estimated_delivery_date || ""}
            disabled
            placeholder="ETA"
          />

          <label htmlFor="delivery_date">Delivery Date</label>
          <input
            id="delivery_date"
            value={form.delivery_date || ""}
            disabled
            placeholder="Delivery Date"
          />
        </div>
      )}

      {/* ------------------ Navigation Buttons ------------------ */}
      <div className="form-navigation">
        {step > 1 && (
          <button type="button" onClick={prevStep}>
            Previous
          </button>
        )}
        {step < 5 && (
          <button type="button" onClick={nextStep}>
            Next
          </button>
        )}
      </div>

      <style jsx>{`
        .shipment-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 500px;
          margin: auto;
          padding: 0 1rem;
        }
        .form-step {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        label {
          font-weight: 500;
          margin-bottom: 0.25rem;
        }
        input,
        select {
          padding: 0.5rem;
          font-size: 1rem;
          width: 100%;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
        .form-navigation {
          display: flex;
          justify-content: space-between;
          margin-top: 1rem;
        }
        .step-indicator {
          font-weight: 600;
          margin-bottom: 0.5rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
