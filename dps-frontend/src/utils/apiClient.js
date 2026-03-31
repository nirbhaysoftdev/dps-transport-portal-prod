// src/utils/apiClient.js
const API = import.meta.env.VITE_API_URL;

export const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
    return null;
  }

  return res;
};

export const getUser       = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

export const isAdmin       = () => getUser()?.role === "admin";
export const isBranch      = () => getUser()?.role === "branch";
export const isFinance     = () => getUser()?.role === "finance";
export const getPlantCode  = () => getUser()?.plant_code || null;

// Can edit shipments: admin always, branch for their own
export const canEditShipments = () => {
  const u = getUser();
  return u?.role === "admin" || u?.role === "branch";
};

// Can access finance: admin + finance role only
export const canAccessFinance = () => {
  const u = getUser();
  return u?.role === "admin" || u?.role === "finance";
};

// Can make payments: admin + finance role
export const canMakePayment = () => {
  const u = getUser();
  return u?.role === "admin" || u?.role === "finance";
};