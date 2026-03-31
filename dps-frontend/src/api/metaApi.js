// src/api/metaApi.js
// All API calls — uses apiFetch so JWT is injected automatically
import { apiFetch } from "../utils/apiClient";

const json = async (res) => {
  if (!res) return { success: false, data: null };
  return res.json();
};

export const getDispatchLocations  = ()       => apiFetch("/api/shipments/check-masters?type=dispatch").then(json);
export const getDeliveryLocations  = (from)   => apiFetch(`/api/shipments/check-masters?type=delivery&dispatch=${encodeURIComponent(from)}`).then(json);
export const getRouteDetails       = (d, dl, dealer) => apiFetch(`/api/shipments/check-masters?type=route&dispatch=${encodeURIComponent(d)}&delivery=${encodeURIComponent(dl)}&dealer=${encodeURIComponent(dealer)}`).then(json);
export const getVehicles           = ()       => apiFetch("/api/shipments/check-masters?type=vehicles").then(json);
export const getDealersByRoute     = (d, dl)  => apiFetch(`/api/shipments/check-masters?type=dealers&dispatch=${encodeURIComponent(d)}&delivery=${encodeURIComponent(dl)}`).then(json);
export const getStatuses           = ()       => Promise.resolve({ data: ["Dispatched","In Transit","Delivered","Delayed","Pending Approval"] });
export const getDriverRoutesByRoute= (routeId)=> apiFetch(`/api/shipments/check-masters?type=driver_routes&route_id=${routeId}`).then(json);

export const createShipment = async (payload) => {
  const res = await apiFetch("/api/shipments", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return json(res);
};