import rateLimit from "express-rate-limit";
import { createHash } from "crypto";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { success: false, message: "Too many requests, please try again later" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => {
    const identifier = typeof req.body?.identifier === "string" ? req.body.identifier : typeof req.body?.email === "string" ? req.body.email : req.ip || "unknown";
    return `auth:${createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex")}`;
  },
  message: { success: false, message: "Too many login attempts, try again in 15 minutes" },
});
