// src/modules/auth/auth.service.js
import { db } from "../../config/database.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET  = process.env.JWT_SECRET  || "dps_secret_change_in_prod";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

/* ── Login ───────────────────────────────────────────────────────── */
export const loginUser = async (email, password) => {
  const [[user]] = await db.query(
    `SELECT u.id, u.name, u.email, u.password, u.role, u.plant_code,
            p.site, p.type AS plant_type
     FROM users u
     LEFT JOIN plant_master p ON p.plant_code = u.plant_code
     WHERE u.email = ? AND u.is_active = 1`,
    [email]
  );

  if (!user) return { ok: false, message: "Invalid credentials" };

  const match = await bcrypt.compare(password, user.password);
  if (!match)  return { ok: false, message: "Invalid credentials" };

  // Roles:
  //   admin   — plant_code: null, sees all branches, full edit everywhere
  //   branch  — plant_code: "5110", sees only their shipments, can edit shipments
  //   finance — plant_code: null, sees only finance page, full edit on finance
  const payload = {
    user_id:    user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    plant_code: user.plant_code || null,
    site:       user.site       || null,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return {
    ok: true,
    token,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      plant_code: user.plant_code || null,
      site:       user.site       || null,
      plant_type: user.plant_type || null,
    },
  };
};

/* ── Create user (admin only) ────────────────────────────────────── */
export const createUser = async ({ name, email, password, role, plant_code }) => {
  // finance role never has a plant_code
  const resolvedPlantCode = role === "finance" ? null : (plant_code || null);
  const hash = await bcrypt.hash(password, 10);

  const [result] = await db.query(
    `INSERT INTO users (name, email, password, role, plant_code)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, hash, role || "branch", resolvedPlantCode]
  );
  return result.insertId;
};

/* ── List all users (admin only) ─────────────────────────────────── */
export const listUsers = async () => {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.plant_code,
            p.site, u.is_active, u.created_at
     FROM users u
     LEFT JOIN plant_master p ON p.plant_code = u.plant_code
     ORDER BY u.role, u.created_at DESC`
  );
  return rows;
};

/* ── Toggle user active status ───────────────────────────────────── */
export const toggleUserActive = async (userId, isActive) => {
  await db.query(
    `UPDATE users SET is_active = ? WHERE id = ?`,
    [isActive ? 1 : 0, userId]
  );
};

/* ── List plants ─────────────────────────────────────────────────── */
export const listPlants = async () => {
  const [rows] = await db.query(
    `SELECT plant_code, site, type
     FROM plant_master
     WHERE is_active = 1
     ORDER BY site, plant_code`
  );
  return rows;
};