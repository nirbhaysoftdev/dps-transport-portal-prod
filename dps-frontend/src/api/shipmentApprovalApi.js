const BASE = "/api/shipments";

export const getPendingShipments = async () => {
  const res = await fetch(`${BASE}/pending`);
  return res.json();
};

export const approveShipment = async (shipment_id) => {
  const res = await fetch(`${BASE}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment_id }),
  });
  return res.json();
};

export const rejectShipment = async (shipment_id) => {
  const res = await fetch(`${BASE}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipment_id }),
  });
  return res.json();
};
