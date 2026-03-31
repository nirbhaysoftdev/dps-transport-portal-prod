import { useEffect, useState } from "react";
import {
  getDispatchLocations,
  getDeliveryLocations,
  getRouteDetails,
  getVehicles,
  getDealersByRoute,
  getStatuses,
  createShipment,
  getDriverRoutesByRoute,
} from "../api/metaApi";

export default function useShipmentForm(onSuccess) {
  const [form, setForm] = useState({
    shipment_date:      new Date().toISOString().slice(0, 10),
    shipment_no:        "",
    billing_doc_number: "",
    billing_date:       "",
    chassis_no:         "",
    engine_no:          "",
    allocation_date:    "",
    dispatch_date:      "",

    dispatch_location:  "",
    delivery_location:  "",
    dealer_name:        "",
    km:                 "",

    vehicle_id:              "",
    avg:                     "",
    total_diesel_required:   "",
    driver_route_id:         "",

    // ── Fuel entries — dynamic array (replaces fixed pump fields) ──
    fuel_entries: [],
    // Each entry shape:
    // { entry_type: 'TIED_PUMP'|'FUEL_CARD'|'HSD', pump_id: null|number, qty: '', rate: '' }

    estimated_delivery_date: "",
    delivery_date:           "",
    current_status:          "",
  });

  const [dispatchLocations, setDispatchLocations] = useState([]);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [vehicles,          setVehicles]          = useState([]);
  const [statuses,          setStatuses]          = useState([]);
  const [dealers,           setDealers]           = useState([]);
  const [driverRoutes,      setDriverRoutes]      = useState([]);

  /* ── Load master data ── */
  useEffect(() => {
    getDispatchLocations().then(r => setDispatchLocations(r.data || []));
    getVehicles().then(r => setVehicles(r.data || []));
    getStatuses().then(r => setStatuses(r.data || []));
  }, []);

  /* ── Dispatch → Delivery ── */
  const onDispatchChange = async (dispatch) => {
    setForm(f => ({
      ...f,
      dispatch_location: dispatch,
      delivery_location: "",
      dealer_name:       "",
      km:                "",
    }));
    const res = await getDeliveryLocations(dispatch);
    setDeliveryLocations(res.data || []);
  };

  /* ── Route details ── */
  useEffect(() => {
    if (!form.dispatch_location || !form.delivery_location || !form.dealer_name) return;
    getRouteDetails(form.dispatch_location, form.delivery_location, form.dealer_name)
      .then(res => {
        if (!res.data) return;
        setForm(f => ({ ...f, route_id: res.data.route_id, km: res.data.km, driver_route_id: "" }));
      });
  }, [form.dispatch_location, form.delivery_location, form.dealer_name]);

  /* ── Driver routes ── */
  useEffect(() => {
    if (!form.route_id) {
      setDriverRoutes([]);
      setForm(f => ({ ...f, driver_route_id: "" }));
      return;
    }
    getDriverRoutesByRoute(form.route_id).then(res => {
      setDriverRoutes(res.data || []);
      setForm(f => ({ ...f, driver_route_id: "" }));
    });
  }, [form.route_id]);

  /* ── Dealers ── */
  useEffect(() => {
    if (!form.dispatch_location || !form.delivery_location) { setDealers([]); return; }
    getDealersByRoute(form.dispatch_location, form.delivery_location)
      .then(res => setDealers(res.data || []));
  }, [form.dispatch_location, form.delivery_location]);

  /* ── Vehicle → avg → diesel required ── */
  const onVehicleChange = (vehicleId) => {
    const v = vehicles.find(x => x.vehicle_id === Number(vehicleId));
    if (!v) return;
    setForm(f => ({ ...f, vehicle_id: v.vehicle_id, avg: v.avg }));
  };

  useEffect(() => {
    if (form.km && form.avg) {
      setForm(f => ({
        ...f,
        total_diesel_required: (Number(form.km) / Number(form.avg)).toFixed(2),
      }));
    }
  }, [form.km, form.avg]);

  /* ── ETA ── */
  useEffect(() => {
    if (!form.dispatch_date || !form.km) return;
    const days = Math.ceil(Number(form.km) / 300);
    const d = new Date(form.dispatch_date);
    d.setDate(d.getDate() + days);
    setForm(f => ({ ...f, estimated_delivery_date: d.toISOString().slice(0, 10) }));
  }, [form.dispatch_date, form.km]);

  /* ── Delivered ── */
  useEffect(() => {
    if (form.current_status === "Delivered") {
      setForm(f => ({ ...f, delivery_date: new Date().toISOString().slice(0, 10) }));
    }
  }, [form.current_status]);

  /* ── Validation ── */
  const validate = () => {
    if (!form.shipment_no)        return "Shipment No required";
    if (!form.dispatch_location)  return "Dispatch location required";
    if (!form.delivery_location)  return "Delivery location required";
    if (!form.dealer_name)        return "Dealer required";
    if (!form.dispatch_date)      return "Dispatch date required";
    if (!form.current_status)     return "Status required";
    return null;
  };

  /* ── Submit ── */
  const submit = async () => {
    const err = validate();
    if (err) return { success: false, message: err };

    const payload = {
      shipment_no:        form.shipment_no,
      shipment_date:      form.shipment_date,
      billing_doc_number: form.billing_doc_number,
      billing_date:       form.billing_date,
      chassis_no:         form.chassis_no,
      engine_no:          form.engine_no,
      allocation_date:    form.allocation_date,
      dispatch_date:      form.dispatch_date,
      current_status:     form.current_status,
      delivery_date:      form.delivery_date,
      estimated_delivery_date: form.estimated_delivery_date,

      dispatch_location:  form.dispatch_location,
      delivery_location:  form.delivery_location,
      dealer_name:        form.dealer_name,
      km:                 form.km,
      avg:                form.avg,
      state:              form.state || null,
      material_no:        form.material_no || null,
      model:              form.model || null,
      driver_name:        form.driver_name || null,
      dl_number:          form.dl_number || null,

      route_id:        Number(form.route_id),
      vehicle_id:      Number(form.vehicle_id),
      driver_route_id: Number(form.driver_route_id),

      // ── Normalized fuel entries (replaces pump1/pump2/etc.) ──
      fuel_entries: (form.fuel_entries || [])
        .filter(e => Number(e.qty) > 0 && Number(e.rate) > 0)
        .map(e => ({
          entry_type: e.entry_type,
          pump_id:    e.entry_type === "TIED_PUMP" ? (Number(e.pump_id) || null) : null,
          qty:        Number(e.qty),
          rate:       Number(e.rate),
        })),
    };

    console.log("Submitting shipment payload:", payload);
    const res = await createShipment(payload);
    if (res.success && onSuccess) onSuccess();
    return res;
  };

  return {
    form,
    setForm,
    submit,
    dispatchLocations,
    deliveryLocations,
    vehicles,
    statuses,
    dealers,
    driverRoutes,
    onDispatchChange,
    onVehicleChange,
  };
}