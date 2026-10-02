import { Router } from "express";
import { gradingController } from "../controllers/grading.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/roleGuard";

const router = Router();
router.use(authenticate);

router.get("/student/results", authorize("STUDENT"), (req, res) => gradingController.studentResults(req, res));
router.get("/student/result/:studentTestId", authorize("STUDENT"), (req, res) => gradingController.studentResult(req, res));

router.get("/test/:testId/submissions", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.listSubmissions(req, res));
router.get("/submission/:studentTestId", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.getSubmission(req, res));
router.post("/submission/:studentTestId/reopen", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.reopenAttempt(req, res));
router.post("/submission/:studentTestId/grade-question", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.gradeQuestion(req, res));
router.post("/test/:testId/publish-results", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.publishResults(req, res));
router.get("/test/:testId/analytics", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.analytics(req, res));
router.get("/test/:testId/export/excel", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.exportExcel(req, res));
router.get("/test/:testId/export/csv", authorize("FACULTY", "ADMIN"), (req, res) => gradingController.exportCsv(req, res));

export default router;
