import {
  getRouteByLocations,
  getVehicleById,
  insertShipment,
  getDriverRouteById,
  getShipments,
  getPendingShipments,
  approveShipment,
  rejectShipment,
} from "./shipment.service.js";

/* ------------------------ LIST ALL SHIPMENTS ------------------------ */
export const listShipments = async (req, res) => {
  try {
    const { status } = req.query;
    const data = await getShipments(status);
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments failed:", err.sqlMessage || err);
    res.status(500).json({
      success: false,
      message: "Server error",
      debug: err.sqlMessage || null,
    });
  }
};

export const bulkConfirmShipments = async (req, res) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No rows provided",
      });
    }

    // ❌ Block ERROR rows
    const hasErrors = rows.some(r => r.status === "ERROR");
    if (hasErrors) {
      return res.status(400).json({
        success: false,
        message: "Fix errors before confirming upload",
      });
    }

    // ❌ Duplicate shipment_no check
    const shipmentNos = rows.map(r => r.data.shipment_no);
    const uniqueNos = new Set(shipmentNos);
    if (shipmentNos.length !== uniqueNos.size) {
      return res.status(400).json({
        success: false,
        message: "Duplicate shipment numbers in upload",
      });
    }

    let inserted = 0;
    let pending = 0;

    for (const row of rows) {
      const payload = {
        ...row.data,
        approval_status: row.status === "PENDING" ? "PENDING" : "ACTIVE",
      };

      await insertShipment(payload);

      row.status === "PENDING" ? pending++ : inserted++;
    }

    return res.json({
      success: true,
      message: "Bulk upload completed",
      summary: {
        total: rows.length,
        active: inserted,
        pending,
      },
    });

  } catch (err) {
    console.error("❌ Bulk confirm failed:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      debug: err.sqlMessage || null,
    });
  }
};


/* ------------------------ CREATE SHIPMENT ------------------------ */
export const createShipment = async (req, res) => {
  try {
    const body = req.body;

    /* ---------- BASIC VALIDATION ---------- */
    if (!body.shipment_no)
      return res.status(400).json({ success: false, message: "Shipment no required" });

    if (!body.dispatch_location || !body.delivery_location || !body.dealer_name)
      return res.status(400).json({ success: false, message: "Route details required" });

    if (!body.dispatch_date)
      return res.status(400).json({ success: false, message: "Dispatch date required" });

    if (!body.current_status)
      return res.status(400).json({ success: false, message: "Status required" });

    /* ---------- MASTER LOOKUPS ---------- */
    const route = await getRouteByLocations(
      body.dispatch_location,
      body.delivery_location,
      body.dealer_name
    );

    const vehicle = body.vehicle_id ? await getVehicleById(body.vehicle_id) : null;

    const driverRoute =
      route && body.driver_route_id
        ? await getDriverRouteById(body.driver_route_id, route.route_id)
        : null;

    const hasMissingMaster = !route || !vehicle || !driverRoute;

    const approval_status = hasMissingMaster ? "PENDING" : "ACTIVE";

    /* ---------- ETA CALCULATION ---------- */
    let estimated_delivery_date = null;
    if (route?.km && body.dispatch_date) {
      const days = Math.ceil(route.km / 300);
      const d = new Date(body.dispatch_date);
      d.setDate(d.getDate() + days);
      estimated_delivery_date = d.toISOString().slice(0, 10);
    }

    /* ---------- DELIVERY DATE ---------- */
    let delivery_date = null;
    if (body.current_status === "Delivered") {
      delivery_date = new Date().toISOString().slice(0, 10);
    }
      const effective_status =
  approval_status === "PENDING"
    ? "Pending Approval"
    : body.current_status;


    /* ---------- FINAL DB PAYLOAD ---------- */
    const safePayload = {
      shipment_no: BigInt(body.shipment_no).toString(),
      shipment_date: body.shipment_date || null,
      billing_doc_number: body.billing_doc_number || null,
      billing_date: body.billing_date || null,
      chassis_no: body.chassis_no || null,
      engine_no: body.engine_no || null,
      allocation_date: body.allocation_date || null,
      dispatch_date: body.dispatch_date,
      estimated_delivery_date,
      delivery_date,
      current_status: effective_status,

      route_id: route?.route_id || null,
      vehicle_id: vehicle?.vehicle_id || null,
      driver_route_id: driverRoute?.driver_route_id || null,

      raw_dispatch_plant: body.dispatch_location,
      raw_delivery_location: body.delivery_location,
      raw_state: body.state || null,
      raw_dealer_name: body.dealer_name,
      raw_km: body.km || null,

      raw_vehicle_material_no: body.material_no || null,
      raw_vehicle_model: body.model || null,
      raw_vehicle_avg: body.avg || null,

      raw_driver_name: body.driver_name || null,
      raw_dl_number: body.dl_number || null,

      approval_status,

      pump1_qty: Number(body.pump1_qty || 0),
      pump1_rate: Number(body.pump1_rate || 0),
      pump2_qty: Number(body.pump2_qty || 0),
      pump2_rate: Number(body.pump2_rate || 0),
      pump3_qty: Number(body.pump3_qty || 0),
      pump3_rate: Number(body.pump3_rate || 0),
      pump4_qty: Number(body.pump4_qty || 0),
      pump4_rate: Number(body.pump4_rate || 0),
      fuel_card_qty: Number(body.fuel_card_qty || 0),
      fuel_card_rate: Number(body.fuel_card_rate || 0),
      hsd_qty: Number(body.hsd_qty || 0),
      hsd_rate: Number(body.hsd_rate || 0),
    };

    const shipmentId = await insertShipment(safePayload);



return res.json({
  success: true,
  message:
    approval_status === "PENDING"
      ? "Shipment saved for admin approval"
      : "Shipment created successfully",
  shipment_id: shipmentId,
  approval_status,
  effective_status, // 👈 frontend display only
});

  } catch (err) {
    console.error("❌ Create shipment error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      debug: err.sqlMessage || null,
    });
  }
};

/* ------------------------ LIST PENDING SHIPMENTS ------------------------ */
export const listPendingShipments = async (req, res) => {
  try {
    const data = await getPendingShipments();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /shipments/pending failed:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ------------------------ APPROVE / REJECT SHIPMENTS ------------------------ */
export const approvePendingShipment = async (req, res) => {
  try {
    const { shipment_id } = req.body;
    const updated = await approveShipment(shipment_id);
    if (!updated)
      return res.status(400).json({ success: false, message: "Invalid or already processed shipment" });

    return res.json({ success: true, message: "Shipment approved" });
  } catch (err) {
    console.error("❌ POST /shipments/approve failed:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const rejectPendingShipment = async (req, res) => {
  try {
    const { shipment_id } = req.body;
    const updated = await rejectShipment(shipment_id);
    if (!updated)
      return res.status(400).json({ success: false, message: "Invalid or already processed shipment" });

    return res.json({ success: true, message: "Shipment rejected" });
  } catch (err) {
    console.error("❌ POST /shipments/reject failed:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
