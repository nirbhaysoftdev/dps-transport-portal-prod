import csv from "csvtojson";

/**
 * Parse CSV buffer → array of rows
 */
export const parseCSV = async (buffer) => {
  return csv({
    trim: true,
    ignoreEmpty: true,
  }).fromString(buffer.toString());
};

/**
 * Normalize headers
 * Shipment No → shipment_no
 */
export const normalizeRow = (row) => {
  const normalized = {};
  for (const key in row) {
    normalized[key.trim().toLowerCase().replace(/ /g, "_")] =
      typeof row[key] === "string" ? row[key].trim() : row[key];
  }
  return normalized;
};
