import { Router } from "express";
import { questionController } from "../controllers/question.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";

const router = Router();
router.use(authenticate);
router.post("/", authorize("FACULTY"), (req, res) => questionController.create(req, res));
router.get("/", authorize("FACULTY", "ADMIN"), (req, res) => questionController.getMyQuestions(req, res));
router.delete("/:id", authorize("FACULTY", "ADMIN"), (req, res) => questionController.remove(req, res));

export default router;
