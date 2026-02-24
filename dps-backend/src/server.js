import "./config/env.js";
import app from "./app.js";

import authRoutes from "./modules/auth/auth.routes.js";
import routeRoutes from "./modules/routes/route.routes.js";
import vehicleRoutes from "./modules/vehicles/vehicle.routes.js";
import statusRoutes from "./modules/statuses/status.routes.js";
import shipmentRoutes from "./modules/shipment/shipment.routes.js";
import bulkRoutes from "./modules/shipmentBulk/bulk.routes.js";

app.use("/api/shipments/bulk", bulkRoutes);



app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/statuses", statusRoutes);




const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on ${PORT}`)
);
