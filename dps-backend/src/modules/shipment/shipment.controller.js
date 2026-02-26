import {
  getRouteByLocations, getVehicleById, insertShipment, getDriverRouteById,
  getShipments, getShipmentById, updateShipment, updatePodPath,
  getPendingShipments, approveShipment, rejectShipment,
  checkMasters, getAllDrivers,
} from "./shipment.service.js";
import path from "path";
import fs from "fs";

/* ── LIST ALL SHIPMENTS ─────────────────────────────────────────── */
export const listShipments = async (req, res) => {
  try {
    const data = await getShipments(req.query.status);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments:", err.sqlMessage || err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
  }
};

/* ── GET SINGLE SHIPMENT ────────────────────────────────────────── */
export const getShipmentHandler = async (req, res) => {
  try {
    const data = await getShipmentById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Shipment not found" });
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/:id:", err.sqlMessage || err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
  }
};

/* ── UPDATE SHIPMENT ────────────────────────────────────────────── */
export const updateShipmentHandler = async (req, res) => {
  try {
    await updateShipment(req.params.id, req.body);
    res.json({ success: true, message: "Shipment updated" });
  } catch (err) {
    console.error("❌ PUT /shipments/:id:", err.sqlMessage || err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
  }
};

/* ── BULK CONFIRM ───────────────────────────────────────────────── */
export const bulkConfirmShipments = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: "No rows provided" });
    if (rows.some(r => r.status === "ERROR"))
      return res.status(400).json({ success: false, message: "Fix errors before confirming upload" });

    const shipmentNos = rows.map(r => r.data.shipment_no);
    if (shipmentNos.length !== new Set(shipmentNos).size)
      return res.status(400).json({ success: false, message: "Duplicate shipment numbers in upload" });

    let inserted = 0, pending = 0;
    for (const row of rows) {
      await insertShipment({ ...row.data, approval_status: row.status === "PENDING" ? "PENDING" : "ACTIVE" });
      row.status === "PENDING" ? pending++ : inserted++;
    }
    return res.json({ success: true, message: "Bulk upload completed", summary: { total: rows.length, active: inserted, pending } });
  } catch (err) {
    console.error("❌ Bulk confirm:", err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
  }
};

/* ── CREATE SHIPMENT ────────────────────────────────────────────── */
export const createShipment = async (req, res) => {
  try {
    const body = req.body;
    if (!body.shipment_no) return res.status(400).json({ success: false, message: "Shipment no required" });
    if (!body.dispatch_location || !body.delivery_location || !body.dealer_name)
      return res.status(400).json({ success: false, message: "Route details required" });
    if (!body.dispatch_date) return res.status(400).json({ success: false, message: "Dispatch date required" });
    if (!body.current_status) return res.status(400).json({ success: false, message: "Status required" });

    const route      = await getRouteByLocations(body.dispatch_location, body.delivery_location, body.dealer_name);
    const vehicle    = body.vehicle_id ? await getVehicleById(body.vehicle_id) : null;
    const driverRoute = route && body.driver_route_id ? await getDriverRouteById(body.driver_route_id, route.route_id) : null;

    const hasMissing   = !route || !vehicle || !driverRoute;
    const approval_status = hasMissing ? "PENDING" : "ACTIVE";

    let estimated_delivery_date = null;
    if (route?.km && body.dispatch_date) {
      const d = new Date(body.dispatch_date);
      d.setDate(d.getDate() + Math.ceil(route.km / 300));
      estimated_delivery_date = d.toISOString().slice(0, 10);
    }

    const effective_status = approval_status === "PENDING" ? "Pending Approval" : body.current_status;

    const shipmentId = await insertShipment({
      shipment_no: BigInt(body.shipment_no).toString(),
      shipment_date: body.shipment_date || null, billing_doc_number: body.billing_doc_number || null,
      billing_date: body.billing_date || null, chassis_no: body.chassis_no || null,
      engine_no: body.engine_no || null, allocation_date: body.allocation_date || null,
      dispatch_date: body.dispatch_date,
      estimated_delivery_date,
      delivery_date: body.current_status === "Delivered" ? new Date().toISOString().slice(0, 10) : null,
      current_status: effective_status,
      route_id: route?.route_id || null, vehicle_id: vehicle?.vehicle_id || null,
      driver_route_id: driverRoute?.driver_route_id || null,
      raw_dispatch_plant: body.dispatch_location, raw_delivery_location: body.delivery_location,
      raw_state: body.state || null, raw_dealer_name: body.dealer_name, raw_km: body.km || null,
      raw_vehicle_material_no: body.material_no || null, raw_vehicle_model: body.model || null,
      raw_vehicle_avg: body.avg || null, raw_driver_name: body.driver_name || null,
      raw_dl_number: body.dl_number || null, approval_status,
      pump1_qty: Number(body.pump1_qty || 0), pump1_rate: Number(body.pump1_rate || 0),
      pump2_qty: Number(body.pump2_qty || 0), pump2_rate: Number(body.pump2_rate || 0),
      pump3_qty: Number(body.pump3_qty || 0), pump3_rate: Number(body.pump3_rate || 0),
      pump4_qty: Number(body.pump4_qty || 0), pump4_rate: Number(body.pump4_rate || 0),
      fuel_card_qty: Number(body.fuel_card_qty || 0), fuel_card_rate: Number(body.fuel_card_rate || 0),
      hsd_qty: Number(body.hsd_qty || 0), hsd_rate: Number(body.hsd_rate || 0),
    });

    return res.json({ success: true, message: approval_status === "PENDING" ? "Saved for approval" : "Created", shipment_id: shipmentId, approval_status, effective_status });
  } catch (err) {
    console.error("❌ Create shipment:", err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
  }
};

/* ── LIST PENDING ───────────────────────────────────────────────── */
export const listPendingShipments = async (req, res) => {
  try {
    const data = await getPendingShipments();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/pending:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── CHECK MASTERS ──────────────────────────────────────────────── */
export const checkMastersHandler = async (req, res) => {
  try {
    const data = await checkMasters(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/check-masters:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── LIST DRIVERS ───────────────────────────────────────────────── */
export const listDrivers = async (req, res) => {
  try {
    const data = await getAllDrivers();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /drivers:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── APPROVE ────────────────────────────────────────────────────── */
export const approvePendingShipment = async (req, res) => {
  try {
    const { shipment_id, route, vehicle, driver, driver_route, route_tax, route_toll } = req.body;
    if (!shipment_id) return res.status(400).json({ success: false, message: "shipment_id required" });
    if (!route?.dispatch_plant || !route?.delivery_location || !route?.dealer_name)
      return res.status(400).json({ success: false, message: "Route fields required" });
    if (!vehicle?.material_no) return res.status(400).json({ success: false, message: "Vehicle material_no required" });
    if (!driver?.driver_id && (!driver?.driver_name || !driver?.dl_number))
      return res.status(400).json({ success: false, message: "Driver required" });

    const result = await approveShipment(shipment_id, { route, vehicle, driver, driver_route, route_tax, route_toll });
    if (!result) return res.status(400).json({ success: false, message: "Shipment not found or already processed" });

    return res.json({ success: true, message: "Shipment approved", data: result });
  } catch (err) {
    console.error("❌ POST /shipments/approve:", err);
    res.status(500).json({ success: false, message: err.message || "Server error", debug: err.sqlMessage || null });
  }
};

/* ── REJECT ─────────────────────────────────────────────────────── */
export const rejectPendingShipment = async (req, res) => {
  try {
    const ok = await rejectShipment(req.body.shipment_id);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid or already processed" });
    return res.json({ success: true, message: "Shipment rejected" });
  } catch (err) {
    console.error("❌ POST /shipments/reject:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── UPLOAD POD ─────────────────────────────────────────────────────
   POST /api/shipments/:id/pod
   multipart/form-data  field: "pod"
   Validates type (jpg/jpeg/png) + size (≤300 KB) on backend too.
*/
export const uploadPod = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const allowed   = ["image/jpeg", "image/jpg", "image/png"];
    const maxBytes  = 300 * 1024;

    if (!allowed.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: "Only JPG, JPEG and PNG are allowed" });
    }

    if (req.file.size > maxBytes) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: `File too large. Max 300 KB (received ${(req.file.size / 1024).toFixed(0)} KB)` });
    }

    const shipmentId = req.params.id;
    const ext        = path.extname(req.file.originalname).toLowerCase();
    const filename   = `pod_${shipmentId}_${Date.now()}${ext}`;
    const destDir    = path.resolve("src/uploads/pod");
    const destPath   = path.join(destDir, filename);

    // Ensure directory exists
    fs.mkdirSync(destDir, { recursive: true });
    fs.renameSync(req.file.path, destPath);

    const podPath = `uploads/pod/${filename}`;
    await updatePodPath(shipmentId, podPath);

    return res.json({ success: true, pod_path: podPath });
  } catch (err) {
    console.error("❌ POST /shipments/:id/pod:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};