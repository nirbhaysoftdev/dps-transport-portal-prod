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
    shipment_date: new Date().toISOString().slice(0, 10),
    shipment_no: "",
    billing_doc_number: "",
    billing_date: "",
    chassis_no: "",
    engine_no: "",
    allocation_date: "",
    dispatch_date: "",

    dispatch_location: "",
    delivery_location: "",
    dealer_name: "",
    km: "",

    vehicle_id: "",
    avg: "",
    total_diesel_required: "",
    driver_route_id: "",

    pump1_qty: "",
    pump1_rate: "",
    pump2_qty: "",
    pump2_rate: "",
    pump3_qty: "",
    pump3_rate: "",
    pump4_qty: "",
    pump4_rate: "",
    fuel_card_qty: "",
    fuel_card_rate: "",
    hsd_qty: "",
    hsd_rate: "",

    estimated_delivery_date: "",
    delivery_date: "",
    current_status: "",
  });

  const [dispatchLocations, setDispatchLocations] = useState([]);
  const [deliveryLocations, setDeliveryLocations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [driverRoutes, setDriverRoutes] = useState([]);



  /* Load master data */
  useEffect(() => {
    getDispatchLocations().then(r => setDispatchLocations(r.data || []));
    getVehicles().then(r => setVehicles(r.data || []));
    getStatuses().then(r => setStatuses(r.data || []));
  }, []);

  /* Dispatch → Delivery */
  const onDispatchChange = async (dispatch) => {
    setForm(f => ({
      ...f,
      dispatch_location: dispatch,
      delivery_location: "",
      dealer_name: "",
      km: "",
    }));

    const res = await getDeliveryLocations(dispatch);
    setDeliveryLocations(res.data || []);
  };

  /* Route details */
useEffect(() => {
  if ( !form.dispatch_location || !form.delivery_location || !form.dealer_name ) {
    return;
  }
  getRouteDetails( form.dispatch_location, form.delivery_location, form.dealer_name
  ).then(res => {
    if (!res.data) return;
    setForm(f => ({
      ...f,
      route_id: res.data.route_id,
      km: res.data.km,
      driver_route_id: "",
    }));
  });
}, [
  form.dispatch_location,
  form.delivery_location,
  form.dealer_name,
]);

// driver routes
// driver routes (FIXED)
useEffect(() => {
  if (!form.route_id) {
    setDriverRoutes([]);
    setForm(f => ({ ...f, driver_route_id: "" }));
    return;
  }
  getDriverRoutesByRoute(form.route_id).then(res => {
    setDriverRoutes(res.data || []);
    setForm(f => ({ ...f, driver_route_id: "" })); // 🔥 reset driver
  });
}, [form.route_id]);


  // fetching dealers
  useEffect(() => {
  if (!form.dispatch_location || !form.delivery_location) {
    setDealers([]);
    return;
  }
  getDealersByRoute(form.dispatch_location, form.delivery_location)
    .then(res => setDealers(res.data || []));
}, [form.dispatch_location, form.delivery_location]);

  /* Vehicle → diesel */
  const onVehicleChange = (vehicleId) => {
    const v = vehicles.find(x => x.vehicle_id === Number(vehicleId));
    if (!v) return;

    setForm(f => ({
      ...f,
      vehicle_id: v.vehicle_id,
      avg: v.avg,
    }));
  };

  useEffect(() => {
    if (form.km && form.avg) {
      setForm(f => ({
        ...f,
        total_diesel_required: (form.km / form.avg).toFixed(2),
      }));
    }
  }, [form.km, form.avg]);

  /* ETA */
  useEffect(() => {
    if (!form.dispatch_date || !form.km) return;

    const days = Math.ceil(form.km / 300);
    const d = new Date(form.dispatch_date);
    d.setDate(d.getDate() + days);

    setForm(f => ({
      ...f,
      estimated_delivery_date: d.toISOString().slice(0, 10),
    }));
  }, [form.dispatch_date, form.km]);

  /* Delivered */
  useEffect(() => {
    if (form.current_status === "Delivered") {
      setForm(f => ({
        ...f,
        delivery_date: new Date().toISOString().slice(0, 10),
      }));
    }
  }, [form.current_status]);

  /* Validation */
  const validate = () => {
    if (!form.shipment_no) return "Shipment No required";
    if (!form.dispatch_location) return "Dispatch location required";
    if (!form.delivery_location) return "Delivery location required";
     if (!form.dealer_name) return "Dealer required";
    // if (!form.vehicle_id) return "Vehicle required";
    if (!form.dispatch_date) return "Dispatch date required";
    if (!form.current_status) return "Status required";
    //  if (!form.driver_route_id) return "Driver required"; 
    return null;
  };

  /* Submit */
  const submit = async () => {
  const err = validate();
  if (err) return { success: false, message: err };

  const payload = {
    ...form,
   shipment_no: form.shipment_no,
  shipment_date: form.shipment_date,
  billing_doc_number: form.billing_doc_number,
  billing_date: form.billing_date,
  chassis_no: form.chassis_no,
  engine_no: form.engine_no,
  allocation_date: form.allocation_date,
  dispatch_date: form.dispatch_date,
  current_status: form.current_status,
  delivery_date: form.delivery_date,
  estimated_delivery_date: form.estimated_delivery_date,

  route_id: Number(form.route_id),
  vehicle_id: Number(form.vehicle_id),
  driver_route_id: Number(form.driver_route_id),

  pump1_qty: Number(form.pump1_qty || 0),
  pump1_rate: Number(form.pump1_rate || 0),
  pump2_qty: Number(form.pump2_qty || 0),
  pump2_rate: Number(form.pump2_rate || 0),
  pump3_qty: Number(form.pump3_qty || 0),
  pump3_rate: Number(form.pump3_rate || 0),
  pump4_qty: Number(form.pump4_qty || 0),
  pump4_rate: Number(form.pump4_rate || 0),
  fuel_card_qty: Number(form.fuel_card_qty || 0),
  fuel_card_rate: Number(form.fuel_card_rate || 0),
  hsd_qty: Number(form.hsd_qty || 0),
  hsd_rate: Number(form.hsd_rate || 0),
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
