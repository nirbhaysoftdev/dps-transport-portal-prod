const API_BASE = "/api";

/* ROUTES */
export const getDispatchLocations = async () => {
  const res = await fetch(`${API_BASE}/routes/dispatch-locations`);
  return res.json();
};

export const getDeliveryLocations = async (dispatch) => {
  const res = await fetch(
    `${API_BASE}/routes/delivery-locations?dispatch=${dispatch}`
  );
  return res.json();
};

export const getRouteDetails = async (dispatch, delivery, dealer) => {
  const res = await fetch(
    `/api/routes/details?dispatch=${dispatch}&delivery=${delivery}&dealer=${dealer}`
  );
  return res.json();
};

export const getDriverRoutesByRoute = async (routeId) => {
  const res = await fetch(
    `${API_BASE}/routes/driver-routes?route_id=${routeId}`
  );
  return res.json();
};


export const getDealersByRoute = async (dispatch, delivery) => {
  const res = await fetch(
    `/api/routes/dealers?dispatch=${dispatch}&delivery=${delivery}`
  );
  return res.json();
};


/* VEHICLES */
export const getVehicles = async () => {
  const res = await fetch(`${API_BASE}/vehicles`);
  return res.json();
};

/* STATUSES */
export const getStatuses = async () => {
  const res = await fetch(`${API_BASE}/statuses`);
  return res.json();
};

/* 🚀 ADD THIS (THIS IS MISSING RIGHT NOW) */
export const createShipment = async (payload) => {
  const res = await fetch(`${API_BASE}/shipments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};
