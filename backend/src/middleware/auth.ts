import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";
import prisma from "../config/database";

declare global {
  namespace Express {
    interface Request { user?: TokenPayload; }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }

  let decoded: TokenPayload;
  try {
    decoded = verifyToken(authHeader.slice(7));
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
    return;
  }
  if (!decoded.userId || !["ADMIN", "FACULTY", "STUDENT"].includes(decoded.role)) {
    res.status(401).json({ success: false, message: "Invalid token payload" });
    return;
  }

  try {
    const active = decoded.role === "STUDENT"
      ? await prisma.student.findFirst({ where: { id: decoded.userId, isActive: true }, select: { id: true } })
      : decoded.role === "FACULTY"
        ? await prisma.faculty.findFirst({ where: { id: decoded.userId, isActive: true }, select: { id: true } })
        : await prisma.admin.findUnique({ where: { id: decoded.userId }, select: { id: true } });
    if (!active) {
      res.status(401).json({ success: false, message: "Account is inactive or no longer exists" });
      return;
    }
  } catch {
    res.status(503).json({ success: false, message: "Authentication service is temporarily unavailable" });
    return;
  }

  req.user = decoded;
  next();
};
