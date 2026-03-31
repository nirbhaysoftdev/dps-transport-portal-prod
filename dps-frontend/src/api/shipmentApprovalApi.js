import { apiFetch } from "../utils/apiClient";

const BASE = "/api/shipments";

export const getPendingShipments = async () => {
  const res = await apiFetch(`${BASE}/pending`);
  if (!res || !res.ok) throw new Error("Failed to fetch pending shipments");
  return res.json();
};

export const approveShipment = async (shipment_id) => {
  const res = await apiFetch(`${BASE}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment_id }),
  });
  if (!res || !res.ok) throw new Error("Failed to approve shipment");
  return res.json();
};

export const rejectShipment = async (shipment_id) => {
  const res = await apiFetch(`${BASE}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment_id }),
  });
  if (!res || !res.ok) throw new Error("Failed to reject shipment");
  return res.json();
};
