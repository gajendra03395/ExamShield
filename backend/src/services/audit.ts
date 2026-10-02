import { Request } from "express";
import prisma from "../config/database";

export async function recordAudit(req: Request, action: string, details?: unknown) {
  try {
    await prisma.activityLog.create({ data: {
      userType: req.user?.role || "SYSTEM",
      userId: req.user?.userId || "SYSTEM",
      action,
      details: details as any,
      ipAddress: req.ip,
    } });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
