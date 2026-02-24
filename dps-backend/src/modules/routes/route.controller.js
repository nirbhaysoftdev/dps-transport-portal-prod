import * as service from "./route.service.js";

export const dispatchLocations = async (req, res) => {
  const data = await service.getDispatchLocations();
  res.json({ success: true, data });
};

export const deliveryLocations = async (req, res) => {
  const { dispatch } = req.query;
  const data = await service.getDeliveryLocations(dispatch);
  res.json({ success: true, data });
};

export const routeDetails = async (req, res) => {
  const { dispatch, delivery, dealer } = req.query;
  if (!dispatch || !delivery || !dealer) {
    return res.json({ success: true, data: null });
  }
  const data = await service.getRouteDetails(dispatch, delivery, dealer);
  res.json({ success: true, data });
};


export const dealersByRoute = async (req, res) => {
  const { dispatch, delivery } = req.query;
  if (!dispatch || !delivery) {
    return res.json({ success: true, data: [] });
  }
  const data = await service.getDealersByRoute(dispatch, delivery);
  res.json({ success: true, data });
};

export const driverRoutesByRoute = async (req, res) => {
  const { route_id } = req.query;
  if (!route_id)
    return res.json({ success: true, data: [] });
  const data = await service.getDriverRoutesByRoute(route_id);
  res.json({ success: true, data });
};

