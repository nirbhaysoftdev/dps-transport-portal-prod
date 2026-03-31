// src/modules/auth/auth.controller.js
import { loginUser, createUser, listUsers, listPlants, toggleUserActive } from "./auth.service.js";

/* ── Login ───────────────────────────────────────────────────────── */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const result = await loginUser(email, password);
    if (!result.ok)
      return res.status(401).json({ success: false, message: result.message });

    return res.json({ success: true, token: result.token, user: result.user });
  } catch (err) {
    console.error("❌ POST /auth/login:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── Me — returns logged in user info from JWT ───────────────────── */
export const me = (req, res) => {
  res.json({ success: true, user: req.user });
};

/* ── Register user (admin only) ──────────────────────────────────── */
export const register = async (req, res) => {
  try {
    const { name, email, password, role, plant_code } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "name, email and password required" });

    // branch role MUST have a plant_code
    if (role === "branch" && !plant_code)
      return res.status(400).json({ success: false, message: "plant_code required for branch role" });

    // finance and admin roles must NOT have a plant_code
    if (["admin", "finance"].includes(role) && plant_code)
      return res.status(400).json({ success: false, message: `plant_code should be empty for ${role} role` });

    const id = await createUser({ name, email, password, role, plant_code });
    res.json({ success: true, message: "User created successfully", user_id: id });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ success: false, message: "Email already exists" });
    console.error("❌ POST /auth/register:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── List all users (admin only) ─────────────────────────────────── */
export const getUsers = async (req, res) => {
  try {
    const data = await listUsers();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /auth/users:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── Toggle user active/inactive (admin only) ────────────────────── */
export const toggleUser = async (req, res) => {
  try {
    const { is_active } = req.body;
    await toggleUserActive(req.params.id, is_active);
    res.json({ success: true, message: `User ${is_active ? "activated" : "deactivated"}` });
  } catch (err) {
    console.error("❌ PATCH /auth/users/:id:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── List plants ─────────────────────────────────────────────────── */
export const getPlants = async (req, res) => {
  try {
    const data = await listPlants();
    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ GET /auth/plants:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};