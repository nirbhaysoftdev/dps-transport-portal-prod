import express from "express";
import { listStatuses } from "./status.controller.js";

const router = express.Router();
router.get("/", listStatuses);

export default router;
