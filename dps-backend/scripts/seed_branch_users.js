// scripts/seed_branch_users.js
// Run once: node scripts/seed_branch_users.js
// Creates one branch user per site

import bcrypt from "bcryptjs";
import { db } from "../src/config/database.js";

const BRANCH_USERS = [
  { name: "Alwar Branch (5103)",     email: "alwar1@dps.com",     plant_code: "5103" },
  { name: "Alwar Branch (5401)",     email: "alwar2@dps.com",     plant_code: "5401" },
  { name: "Bhandara Branch (5403)",  email: "bhandara1@dps.com",  plant_code: "5403" },
  { name: "Bhandara Branch (5425)",  email: "bhandara2@dps.com",  plant_code: "5425" },
  { name: "Durgapur Branch (5408)",  email: "durgapur1@dps.com",  plant_code: "5408" },
  { name: "Durgapur Branch (5438)",  email: "durgapur2@dps.com",  plant_code: "5438" },
  { name: "Ennore Branch (5100)",    email: "ennore1@dps.com",    plant_code: "5100" },
  { name: "Ennore Branch (5200)",    email: "ennore2@dps.com",    plant_code: "5200" },
  { name: "Ennore Branch (5307)",    email: "ennore3@dps.com",    plant_code: "5307" },
  { name: "Ennore Branch (5431)",    email: "ennore4@dps.com",    plant_code: "5431" },
  { name: "Hosur Branch (5102)",     email: "hosur1@dps.com",     plant_code: "5102" },
  { name: "Hosur Branch (5202)",     email: "hosur2@dps.com",     plant_code: "5202" },
  { name: "Hosur Branch (5402)",     email: "hosur3@dps.com",     plant_code: "5402" },
  { name: "Hosur Branch (5411)",     email: "hosur4@dps.com",     plant_code: "5411" },
  { name: "Pantnagar Branch (5104)", email: "pantnagar1@dps.com", plant_code: "5104" },
  { name: "Pantnagar Branch (5410)", email: "pantnagar2@dps.com", plant_code: "5410" },
  { name: "Pune Branch (5308)",      email: "pune1@dps.com",      plant_code: "5308" },
  { name: "Pune Branch (5420)",      email: "pune2@dps.com",      plant_code: "5420" },
  { name: "Pune Branch (5439)",      email: "pune3@dps.com",      plant_code: "5439" },
  { name: "Vijaywada Branch (5110)", email: "vijaywada1@dps.com", plant_code: "5110" },
  { name: "Vijaywada Branch (5423)", email: "vijaywada2@dps.com", plant_code: "5423" },
  { name: "Vijaywada Branch (5106)", email: "vijaywada3@dps.com", plant_code: "5106" },
];

const DEFAULT_PASSWORD = "Branch@123";

async function seed() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  console.log("Seeding branch users...\n");

  for (const u of BRANCH_USERS) {
    try {
      await db.query(
        `INSERT INTO users (name, email, password, role, plant_code)
         VALUES (?, ?, ?, 'branch', ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [u.name, u.email, hash, u.plant_code]
      );
      console.log(`✅ [${u.plant_code}] ${u.email}`);
    } catch (err) {
      console.error(`❌ ${u.email}:`, err.message);
    }
  }

  console.log(`\n📋 All branch users password: ${DEFAULT_PASSWORD}`);
  console.log("⚠️  Change passwords after first login!");
  process.exit(0);
}

seed();