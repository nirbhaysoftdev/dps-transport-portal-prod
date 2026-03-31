// scripts/seed_admin.js
// Run once: node scripts/seed_admin.js

import bcrypt from "bcryptjs";
import { db } from "../src/config/database.js";

const USERS = [
  // ── Admin ──────────────────────────────────────────────────────
  {
    name:       "DPS Admin",
    email:      "admin@dps.com",
    password:   "Admin@123",
    role:       "admin",
    plant_code: null,          // admin has no plant restriction
  },

  // ── Finance ────────────────────────────────────────────────────
  {
    name:       "DPS Finance",
    email:      "finance@dps.com",
    password:   "Finance@123",
    role:       "finance",
    plant_code: null,          // finance has no plant restriction
  },
];

async function seed() {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    try {
      await db.query(
        `INSERT INTO users (name, email, password, role, plant_code)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role)`,
        [u.name, u.email, hash, u.role, u.plant_code]
      );
      console.log(`✅ [${u.role.toUpperCase()}] ${u.email} — password: ${u.password}`);
    } catch (err) {
      console.error(`❌ ${u.email}:`, err.message);
    }
  }
  console.log("\n⚠️  Change all passwords after first login!");
  process.exit(0);
}

seed();