import * as service from "./status.service.js";

export const listStatuses = async (req, res) => {
  const data = await service.getStatuses();
  res.json({ success: true, data });
};
