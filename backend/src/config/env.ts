import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000"),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET || "",
  ADMIN_BOOTSTRAP_TOKEN: process.env.ADMIN_BOOTSTRAP_TOKEN || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  UPLOAD_DIR: process.env.UPLOAD_DIR || "./uploads",
  MAX_VIOLATIONS_DEFAULT: parseInt(process.env.MAX_VIOLATIONS_DEFAULT || "3"),
};

if (!ENV.DATABASE_URL) throw new Error("DATABASE_URL must be configured before starting ExamShield");
if (ENV.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
if (ENV.ADMIN_BOOTSTRAP_TOKEN && ENV.ADMIN_BOOTSTRAP_TOKEN.length < 32) throw new Error("ADMIN_BOOTSTRAP_TOKEN must contain at least 32 characters when enabled");
if (!Number.isInteger(ENV.PORT) || ENV.PORT < 1 || ENV.PORT > 65535) {
  throw new Error("PORT must be a valid port number");
}
if (ENV.NODE_ENV === "production" && ENV.JWT_SECRET.toLowerCase().includes("example")) {
  throw new Error("JWT_SECRET must be changed from its example value in production");
}
