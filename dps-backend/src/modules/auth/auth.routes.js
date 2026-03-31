// src/modules/auth/auth.routes.js
import express from "express";
import { login, register, me, getPlants, getUsers, toggleUser } from "./auth.controller.js";
import { authenticate, requireAdmin } from "../../middleware/authMiddleware.js";

const router = express.Router();

/* ── Public — no auth needed ── */
router.post("/login",  login);

/* ── Authenticated ── */
router.get("/me",      authenticate, me);
router.get("/plants",  authenticate, getPlants);

/* ── Admin only ── */
router.post("/register",          authenticate, requireAdmin, register);
router.get("/users",              authenticate, requireAdmin, getUsers);
router.patch("/users/:id",        authenticate, requireAdmin, toggleUser);

export default router;