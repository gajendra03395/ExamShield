import { Router } from "express";
import { testController } from "../controllers/test.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";

const router = Router();
router.use(authenticate);

router.post("/", authorize("FACULTY"), (req, res) => testController.create(req, res));
router.get("/faculty", authorize("FACULTY", "ADMIN"), (req, res) => testController.getMyTests(req, res));
router.put("/:id/questions", authorize("FACULTY", "ADMIN"), (req, res) => testController.setQuestions(req, res));
router.delete("/:id", authorize("FACULTY", "ADMIN"), (req, res) => testController.remove(req, res));
router.get("/:id/live-monitor", authorize("FACULTY", "ADMIN"), (req, res) => testController.liveMonitor(req, res));
router.post("/:id/publish", authorize("FACULTY", "ADMIN"), (req, res) => testController.publish(req, res));
router.put("/:id", authorize("FACULTY", "ADMIN"), (req, res) => testController.update(req, res));

export default router;
