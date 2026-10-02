import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };
