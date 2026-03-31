import {
  getRouteByLocations, getVehicleById, insertShipment, getDriverRouteById,
  getShipments, getShipmentById, updateShipment, updatePodPath,
  getPendingShipments, getApprovalShipments, approveShipment, adminApproveShipment, rejectShipment,
  checkMasters, getAllDrivers, searchDriverByDL, generateFundRequest,
  getRejectedShipments, moveToOperations, getPetrolPumps, getActiveShipments,
  getTrackingShipments, updateTrackingStatus,
} from "./shipment.service.js";
import path from "path";
import fs from "fs";

/* ── LIST ALL SHIPMENTS ─────────────────────────────────────────── */
export const listShipments = async (req, res) => {
  try {
    const plantCode = req.scope?.plantCode || null;
    const data = await getShipments({ status: req.query.status, approval: req.query.approval, plantCode });
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
    const shipmentId = req.params.id;
    const { getShipmentById } = await import("./shipment.service.js");
    const existing = await getShipmentById(shipmentId);
    if (!existing) return res.status(404).json({ success: false, message: "Shipment not found" });

    const userRole = req.user?.role || "admin"; // In case auth misses it
    if (userRole === "branch") {
      // Branch can only edit HOLD shipments that have matched route & vehicle
      const branchCanEdit = existing.approval_status === "HOLD" && existing.route_id && existing.vehicle_id;
      if (!branchCanEdit) {
        return res.status(403).json({ success: false, message: "Branch users cannot edit this shipment" });
      }
    }
    
    await updateShipment(shipmentId, req.body);
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
      await insertShipment({ ...row.data, approval_status: row.status === "PENDING" ? "PENDING" : "HOLD" });
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
      plant_code: req.scope?.plantCode || body.plant_code || null,
      fuel_entries: Array.isArray(body.fuel_entries) ? body.fuel_entries : [],
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
    const plantCode = req.scope?.plantCode || null;
    const data = await getPendingShipments({ plantCode });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/pending:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── LIST APPROVAL ──────────────────────────────────────────────── */
export const listApprovalShipments = async (req, res) => {
  try {
    const plantCode = req.scope?.plantCode || null;
    const data = await getApprovalShipments({ plantCode });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/approval:", err);
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

/* ── SUBMIT PENDING ───────────────────────────────────────────────── */
export const approvePendingShipment = async (req, res) => {
  try {
    const { shipment_id, route, vehicle, route_tax, route_toll, fuel_entries, driver, driver_route  } = req.body;
    if (!shipment_id) return res.status(400).json({ success: false, message: "shipment_id required" });
    if (!route?.dispatch_plant || !route?.delivery_location || !route?.dealer_name)
      return res.status(400).json({ success: false, message: "Route fields required" });
    if (!vehicle?.material_no) return res.status(400).json({ success: false, message: "Vehicle material_no required" });
    if (!driver?.name || !driver?.dl_number) {
      return res.status(400).json({ success: false, message: "Driver details required" });
     }
    if (!driver_route?.driver_payment || !driver_route?.return_fare) {
       return res.status(400).json({ success: false, message: "Driver expense required" });
      }
    if (!fuel_entries || fuel_entries.length === 0) return res.status(400).json({ success: false, message: "Fuel entries required" });

    // Validate fuel quota matching logic on backend too
    const distance = Number(route.km) || 0;
    const avg = Number(vehicle.avg) || 1;
    const requiredFuel = Math.ceil(distance / avg);
    const totalFilled = fuel_entries.reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
    // Tolerance buffer for precision, but exactly matching logic
    if (totalFilled < requiredFuel - 1) {
       return res.status(400).json({ success: false, message: `Fuel quota not met (Required ${requiredFuel}L, Filled ${totalFilled}L)` });
    }
    const result = await approveShipment(shipment_id, {
      route, vehicle, route_tax, route_toll, fuel_entries, driver, driver_route 
    });
    if (!result) return res.status(400).json({ success: false, message: "Shipment not found or already processed" });

    return res.json({ success: true, message: "Shipment submitted for approval", data: result });
  } catch (err) {
    console.error("❌ POST /shipments/approve:", err);
    res.status(500).json({ success: false, message: err.message || "Server error", debug: err.sqlMessage || null });
  }
};

/* ── ADMIN APPROVE ──────────────────────────────────────────────── */
export const adminApproveShipmentHandler = async (req, res) => {
  try {
    const { shipment_id } = req.body;
    if (!shipment_id) return res.status(400).json({ success: false, message: "shipment_id required" });

    const ok = await adminApproveShipment(shipment_id);
    if (!ok) return res.status(400).json({ success: false, message: "Shipment not found or already processed / not in APPROVAL state" });

    return res.json({ success: true, message: "Shipment approved by Admin and moved to HOLD" });
  } catch (err) {
    console.error("❌ POST /shipments/admin-approve:", err);
    res.status(500).json({ success: false, message: "Server error", debug: err.sqlMessage || null });
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

/* ── SEARCH DRIVER BY DL ─────────────────────────────────────────────
   GET /api/drivers/search?dl=MH01XX1234
*/
export const searchDriverByDLHandler = async (req, res) => {
  try {
    const { dl } = req.query;
    if (!dl) return res.status(400).json({ success: false, message: "dl query param required" });
    const driver = await searchDriverByDL(dl);
    return res.json({ success: true, found: !!driver, driver: driver || null });
  } catch (err) {
    console.error("❌ GET /drivers/search:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── GENERATE FUND REQUEST ───────────────────────────────────────────
   POST /api/shipments/:id/fund-request
   Body: { driver_name, dl_number }
*/
export const generateFundRequestHandler = async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const result = await generateFundRequest(shipmentId);

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.error || "Cannot generate fund request — required fields missing",
        missing: result.missing || [],
      });
    }

    return res.json({ success: true, message: "Fund request approved. Shipment is now Active." });
  } catch (err) {
    console.error("❌ POST /shipments/:id/fund-request:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── REJECTED SHIPMENTS ─────────────────────────────────────────── */
export const getRejectedShipmentsHandler = async (req, res) => {
  try {
    const plantCode = req.scope?.plantCode || null;
    const rows = await getRejectedShipments({ plantCode });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ GET /shipments/rejected:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const moveToOperationsHandler = async (req, res) => {
  try {
    const ok = await moveToOperations(req.body.shipment_id);
    if (!ok) return res.status(404).json({ success: false, message: "Shipment not found or not rejected" });
    res.json({ success: true, message: "Shipment moved to Pending" });
  } catch (err) {
    console.error("❌ POST /shipments/move-to-operations:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const listPetrolPumps = async (req, res) => {
  try {
    const data = await getPetrolPumps();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /petrol-pumps:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── LIST ACTIVE SHIPMENTS (with fund tracking) ────────────────── */
export const listActiveShipments = async (req, res) => {
  try {
    const plantCode = req.scope?.plantCode || null;
    const { from, to } = req.query;
    const data = await getActiveShipments({ plantCode, from, to });

    // Compute summary totals
    let totalGenerated = 0, totalPaid = 0, totalPending = 0;
    data.forEach(r => {
      const amt = Number(r.grand_total || 0);
      totalGenerated += amt;
      if (r.finance_payment_status === "paid") totalPaid += amt;
      else totalPending += amt;
    });

    return res.json({
      success: true,
      data,
      summary: { totalGenerated, totalPaid, totalPending },
    });
  } catch (err) {
    console.error("❌ GET /shipments/active:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


/* ── LIST TRACKING SHIPMENTS ────────────────────────────────────── */
export const listTrackingShipments = async (req, res) => {
  try {
    const plantCode = req.scope?.plantCode || null;
    const data = await getTrackingShipments({ plantCode });
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/tracking:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── UPDATE TRACKING STATUS ─────────────────────────────────────────
   POST /api/shipments/:id/tracking-status
   Body: { status }
   If status = "Delivered": POD must be uploaded first via /:id/pod
   Access:
     - Any role can update to Running/Accident/Other
     - Delivered: any role can set, but requires POD
     - After Delivered: branch cannot update further (admin only)
*/
export const updateTrackingStatusHandler = async (req, res) => {
  try {
    const shipmentId = req.params.id;
    const { status } = req.body;
    const userRole = req.user?.role;

    const VALID_STATUSES = ["Running", "Accident", "Other", "Delivered"];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Check current shipment state for access control
    const { db } = await import("../../config/database.js");
    const [[shipment]] = await db.query(
        `SELECT current_status, pod_path, approval_status FROM shipment WHERE shipment_id = ?`,
        [shipmentId]
      );

    if (!shipment) {
      return res.status(404).json({ success: false, message: "Shipment not found" });
    }

    // Branch cannot edit after Delivered — admin only
    if (shipment.current_status === "Delivered" && userRole === "branch") {
      return res.status(403).json({
        success: false,
        message: "Shipment is Delivered. Only admin can make further changes.",
      });
    }

    // Delivered requires POD
    if (status === "Delivered" && !shipment.pod_path) {
      return res.status(400).json({
        success: false,
        message: "POD (Proof of Delivery) must be uploaded before marking as Delivered.",
        requiresPOD: true,
      });
    }

    const result = await updateTrackingStatus(shipmentId, {
      status,
      deliveryDate: new Date().toISOString().slice(0, 10),
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.error });
    }

    return res.json({
      success: true,
      message: status === "Delivered"
        ? "Shipment marked as Delivered"
        : `Status updated to ${status}`,
    });
  } catch (err) {
    console.error("❌ POST /shipments/:id/tracking-status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};