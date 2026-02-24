import dotenv from "dotenv";

const ENV = process.env.NODE_ENV || "development";

// Load correct env file
dotenv.config({
  path: `.env.${ENV}`,
});

// Validate required variables (undefined only)
const required = [
  "PORT",
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
];

required.forEach((key) => {
  if (process.env[key] === undefined) {
    console.error(`❌ Missing environment variable: ${key}`);
    process.exit(1);
  }
});

const env = {
  NODE_ENV: ENV,
  PORT: process.env.PORT || 4000,

  DB: {
    HOST: process.env.DB_HOST,
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASS ?? "", // ✅ allow empty password
    NAME: process.env.DB_NAME,
  },

  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

export default env;
