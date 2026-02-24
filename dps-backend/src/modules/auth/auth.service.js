import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/database.js";

export const loginUser = async ({ email, password }) => {
  // 1️⃣ Find user
  const [rows] = await db.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = rows[0];

  // 2️⃣ Compare password
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // 3️⃣ Generate JWT
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};
