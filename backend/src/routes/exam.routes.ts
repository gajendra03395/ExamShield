import { Router } from "express";
import { examController } from "../controllers/exam.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";

const router = Router();
router.use(authenticate);

router.post("/violation", authorize("STUDENT"), (req, res) => examController.reportViolation(req, res));
router.post("/force-submit", authorize("FACULTY", "ADMIN"), (req, res) => examController.forceSubmit(req, res));
router.post("/send-warning", authorize("FACULTY", "ADMIN"), (req, res) => examController.sendWarning(req, res));

router.use(authorize("STUDENT"));

router.get("/available", (req, res) => examController.getAvailable(req, res));
router.post("/start/:testId", (req, res) => examController.start(req, res));
router.get("/session/:studentTestId", (req, res) => examController.getSession(req, res));
router.post("/session/:studentTestId/answer", (req, res) => examController.saveAnswer(req, res));
router.post("/session/:studentTestId/heartbeat", (req, res) => examController.heartbeat(req, res));
router.post("/session/:studentTestId/submit", (req, res) => examController.submit(req, res));

export default router;
