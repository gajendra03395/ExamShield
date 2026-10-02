import { Request, Response, NextFunction } from "express";
import { authenticate } from "./auth";
import { TokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request { user?: TokenPayload; }

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  authenticate(req, res, next);

export const requireRole = (roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403).json({ error: "Access forbidden: Insufficient permissions" });
    return;
  }
  next();
};
