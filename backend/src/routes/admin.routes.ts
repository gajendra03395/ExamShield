import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();
router.use(authenticate, authorize("ADMIN"));
router.get("/overview", asyncHandler((req, res) => adminController.overview(req, res)));
router.get("/batches", asyncHandler((req, res) => adminController.batches(req, res)));
router.post("/batches", (req, res) => adminController.createBatch(req, res));
router.get("/divisions", asyncHandler((req, res) => adminController.divisions(req, res)));
router.post("/divisions", (req, res) => adminController.createDivision(req, res));
router.get("/users", asyncHandler((req, res) => adminController.users(req, res)));
router.patch("/users/:role/:id/active", (req, res) => adminController.setUserActive(req, res));
router.get("/audit-logs", asyncHandler((req, res) => adminController.logs(req, res)));
export default router;
