import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { bulkPreview,bulkCommit } from "./bulk.controller.js";

const router = express.Router();
const upload = multer({ dest: path.resolve(__dirname, "../../uploads/csv") });

router.post("/preview", upload.single("file"), bulkPreview);
router.post("/commit", bulkCommit);

router.get("/template", (req, res) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=shipment_bulk_template.csv");

  res.send(
`shipment_no,shipment_date,billing_doc_number,billing_date,chassis_no,material_no,dispatch_location,
delivery_location,state,allocation_date,dispatch_date,model,dealer_name`
  );
});


export default router;
