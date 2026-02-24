import { REQUIRED_COLUMNS } from "./bulk.schema.js";

export const validateCSVStructure = (rows) => {
  if (!rows.length) {
    return { valid: false, error: "CSV file is empty" };
  }

  const csvColumns = Object.keys(rows[0]);

  const missing = REQUIRED_COLUMNS.filter(c => !csvColumns.includes(c));
  const extra = csvColumns.filter(c => !REQUIRED_COLUMNS.includes(c));

  if (missing.length || extra.length) {
    return {
      valid: false,
      error: "CSV structure mismatch",
      missing_columns: missing,
      extra_columns: extra,
    };
  }

  return { valid: true };
};

export const validateRow = (row, index) => {
  const errors = [];
  const clean = v => typeof v === "string" ? v.trim() : v;
Object.keys(row).forEach(k => row[k] = clean(row[k]));


  if (!row.shipment_no) errors.push("shipment_no missing");
  if (!row.dispatch_plant) errors.push("dispatch_plant missing");
  if (!row.delivery_location) errors.push("delivery_location missing");
  if (!row.dealer_name) errors.push("dealer_name missing");
  if (!row.dispatch_date) errors.push("dispatch_date missing");

  const dateFields = [
    "shipment_date",
    "billing_date",
    "allocation_date",
    "dispatch_date",
  ];

  dateFields.forEach(f => {
    if (row[f] && isNaN(Date.parse(row[f]))) {
      errors.push(`Invalid date format in ${f}`);
    }
  });

  return {
    rowIndex: index + 2, // CSV row number (1 = header)
    errors,
  };
};
