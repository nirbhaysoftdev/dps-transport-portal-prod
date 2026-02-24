import * as service from "./vehicle.service.js";

export const listVehicles = async (req, res) => {
  const data = await service.getVehicles();
  res.json({ success: true, data });
};
