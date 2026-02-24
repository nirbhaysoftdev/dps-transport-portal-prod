import express from "express";
import {
  dispatchLocations,
  deliveryLocations,
  routeDetails,
  dealersByRoute,
  driverRoutesByRoute
} from "./route.controller.js";


const router = express.Router();

router.get("/dispatch-locations", dispatchLocations);
router.get("/delivery-locations", deliveryLocations);
router.get("/details", routeDetails);
router.get("/dealers", dealersByRoute);
router.get("/driver-routes", driverRoutesByRoute);



export default router;
