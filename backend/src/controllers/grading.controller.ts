import { Request, Response } from "express";
import prisma from "../config/database";
import { recordAudit } from "../services/audit";
import { exportWorkbook } from "../services/workbook-export.service";

const SUBJECTIVE_TYPES = new Set(["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING", "PROBLEM_IDENTIFICATION", "SHORT_ANSWER"]);
const FINISHED_STATUSES = ["SUBMITTED", "AUTO_SUBMITTED", "VIOLATION_SUBMITTED", "TERMINATED"];
const emitToStudent = (req: Request, studentTestId: string, event: string, payload: unknown) =>
  req.app.get("io")?.to(`student_${studentTestId}`).emit(event, payload);

async function getOwnedTest(testId: string, req: Request) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test || (req.user!.role !== "ADMIN" && test.facultyId !== req.user!.userId)) return null;
  return test;
}

function attemptPercentage(score: number, max: number) {
  return max > 0 ? Math.min(100, (score / max) * 100) : 0;
}

export class GradingController {
  async listSubmissions(req: Request, res: Response) {
    try {
      const test = await getOwnedTest(req.params.testId, req);
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      const attempts = await prisma.studentTest.findMany({
        where: { testId: test.id, status: { in: FINISHED_STATUSES } },
        include: { student: { select: { name: true, enrollmentNo: true, batch: true, division: true } } },
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      });
      return res.json({ success: true, data: attempts.map((attempt) => ({
        studentTestId: attempt.id, student: attempt.student, status: attempt.status,
        mcqScore: attempt.mcqScore, codeScore: attempt.codeScore, totalScore: attempt.totalScore,
        evaluationStatus: attempt.evaluationStatus, violationCount: attempt.violationCount,
        submittedAt: attempt.submittedAt,
      })) });
    } catch (error) {
      console.error("Could not load submissions", error);
      return res.status(500).json({ success: false, message: "Could not load submissions" });
    }
  }

  async getSubmission(req: Request, res: Response) {
    try {
      const attempt = await prisma.studentTest.findUnique({
        where: { id: req.params.studentTestId },
        include: { student: true, test: { include: { sections: { include: { questions: true }, orderBy: { sectionOrder: "asc" } } } }, answers: true },
      });
      if (!attempt || (req.user!.role !== "ADMIN" && attempt.test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }

      const assigned = attempt.assignedQuestions as Array<{ questionId: string; sectionId?: string | null; sectionTitle?: string; order?: number; marks?: number }>;
      const questionIds = assigned.map((question) => question.questionId);
      const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
      const questionById = new Map(questions.map((question) => [question.id, question]));
      const answerById = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
      const sheet = assigned.map((item) => {
        const question = questionById.get(item.questionId);
        const answer = answerById.get(item.questionId);
        if (!question) return null;
        const options = Array.isArray(question.options) ? question.options as Array<{ id?: string; text?: string; isCorrect?: boolean }> : [];
        const correctOptions = options.filter((option) => option.isCorrect).map((option, index) => ({ id: option.id || String(index), text: option.text }));
        return {
          questionId: question.id, order: item.order, sectionId: item.sectionId,
          sectionTitle: item.sectionTitle, questionType: question.questionType,
          questionText: question.questionText, language: question.codeLanguage || question.language,
          codeSnippet: question.codeSnippet, solutionCode: question.solutionCode,
          expectedOutput: question.expectedOutput, testCases: question.testCases,
          options: options.map((option, index) => ({ id: option.id || String(index), text: option.text })),
          correctOptions, maxMarks: item.marks ?? question.marks,
          selectedOptions: answer?.selectedOptions ?? null, codeAnswer: answer?.codeAnswer ?? null,
          textAnswer: answer?.textAnswer ?? null, isCorrect: answer?.isCorrect ?? null,
          marksObtained: answer?.marksObtained ?? answer?.marksAwarded ?? 0,
          isEvaluated: answer?.isEvaluated ?? false,
          feedback: answer?.evaluatorFeedback ?? answer?.facultyComment ?? null,
        };
      }).filter(Boolean);

      return res.json({ success: true, data: {
        studentTestId: attempt.id,
        student: { name: attempt.student.name, email: attempt.student.email, enrollmentNo: attempt.student.enrollmentNo, batch: attempt.student.batch, division: attempt.student.division },
        test: { id: attempt.test.id, title: attempt.test.title, totalMarks: attempt.test.totalMarks, resultsPublished: attempt.test.resultsPublished },
        status: attempt.status, evaluationStatus: attempt.evaluationStatus,
        mcqScore: attempt.mcqScore, codeScore: attempt.codeScore, totalScore: attempt.totalScore,
        percentage: attempt.percentage, facultyRemarks: attempt.facultyRemarks,
        questions: sheet,
      } });
    } catch (error) {
      console.error("Could not load answer sheet", error);
      return res.status(500).json({ success: false, message: "Could not load answer sheet" });
    }
  }

  async reopenAttempt(req: Request, res: Response) {
    try {
      const attempt = await prisma.studentTest.findUnique({ where: { id: req.params.studentTestId }, include: { test: true } });
      if (!attempt || (req.user!.role !== "ADMIN" && attempt.test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Exam attempt not found" });
      }
      if (!["VIOLATION_SUBMITTED", "TERMINATED", "AUTO_SUBMITTED"].includes(attempt.status) || attempt.submissionReason !== "VIOLATION_LIMIT") {
        return res.status(409).json({ success: false, message: "Only exams auto-submitted by the violation limit can be reopened" });
      }
      if (!attempt.startedAt) return res.status(409).json({ success: false, message: "This attempt has no start time" });
      const deadline = Math.min(attempt.startedAt.getTime() + attempt.test.durationMinutes * 60_000, attempt.test.endTime.getTime());
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      if (remaining <= 0) return res.status(409).json({ success: false, message: "The original exam window has ended" });
      const reopened = await prisma.studentTest.update({ where: { id: attempt.id }, data: {
        status: "IN_PROGRESS", submittedAt: null, submissionReason: null, timeRemainingSec: remaining,
        violationCount: 0, autoGradedScore: 0, manualGradedScore: null, mcqScore: 0, codeScore: 0,
        totalScore: 0, percentage: 0, evaluationStatus: "PENDING", evaluatedAt: null, isGraded: false, gradedAt: null,
      } });
      await recordAudit(req, "EXAM_REOPENED", { studentTestId: attempt.id, testId: attempt.testId, remainingSeconds: remaining });
      emitToStudent(req, attempt.id, "exam:reopened", { studentTestId: attempt.id, remainingSeconds: remaining, message: "Your exam has been reopened by your faculty." });
      return res.json({ success: true, data: { studentTestId: reopened.id, status: reopened.status, remainingSeconds: remaining } });
    } catch (error) {
      console.error("Could not reopen exam attempt", error);
      return res.status(500).json({ success: false, message: "Could not reopen exam attempt" });
    }
  }

  async gradeQuestion(req: Request, res: Response) {
    try {
      const { questionId, marksObtained, feedback } = req.body;
      if (typeof questionId !== "string" || typeof marksObtained !== "number" || !Number.isFinite(marksObtained) || marksObtained < 0) {
        return res.status(400).json({ success: false, message: "A questionId and nonnegative marksObtained are required" });
      }
      const attempt = await prisma.studentTest.findUnique({ where: { id: req.params.studentTestId }, include: { test: true } });
      if (!attempt || (req.user!.role !== "ADMIN" && attempt.test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }
      if (!FINISHED_STATUSES.includes(attempt.status)) return res.status(409).json({ success: false, message: "Only submitted exams can be evaluated" });
      const assigned = attempt.assignedQuestions as Array<{ questionId: string; sectionId?: string | null; marks?: number }>;
      const assignedQuestion = assigned.find((question) => question.questionId === questionId);
      if (!assignedQuestion) return res.status(404).json({ success: false, message: "Question is not part of this submission" });
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question || !SUBJECTIVE_TYPES.has(question.questionType)) return res.status(400).json({ success: false, message: "Only written and code questions can be manually graded" });
      const maxMarks = assignedQuestion.marks ?? question.marks;
      if (marksObtained > maxMarks) return res.status(400).json({ success: false, message: `Marks cannot exceed ${maxMarks}` });

      await prisma.studentAnswer.upsert({
        where: { studentTestId_questionId: { studentTestId: attempt.id, questionId } },
        create: {
          studentTestId: attempt.id, questionId, sectionId: assignedQuestion.sectionId || null,
          marksObtained, isEvaluated: true, evaluatorFeedback: typeof feedback === "string" ? feedback.slice(0, 5000) : null,
        },
        update: { marksObtained, isEvaluated: true, evaluatorFeedback: typeof feedback === "string" ? feedback.slice(0, 5000) : null },
      });
      await recordAudit(req, "MANUAL_GRADE_OVERRIDE", { studentTestId: attempt.id, questionId, marksObtained });

      const subjectiveQuestions = questionsByType(questionsForAttempt(assigned, await prisma.question.findMany({ where: { id: { in: assigned.map((item) => item.questionId) } }, select: { id: true, questionType: true } })));
      const evaluatedAnswers = await prisma.studentAnswer.findMany({ where: { studentTestId: attempt.id, questionId: { in: subjectiveQuestions.map((item) => item.id) } } });
      const evaluatedIds = new Set(evaluatedAnswers.filter((answer) => answer.isEvaluated).map((answer) => answer.questionId));
      const allEvaluated = subjectiveQuestions.every((item) => evaluatedIds.has(item.id));
      const anyEvaluated = evaluatedIds.size > 0;
      const codeScore = evaluatedAnswers.filter((answer) => answer.isEvaluated).reduce((total, answer) => total + answer.marksObtained, 0);
      const totalScore = attempt.mcqScore + codeScore;
      const percentage = attemptPercentage(totalScore, attempt.test.totalMarks);
      const updated = await prisma.studentTest.update({ where: { id: attempt.id }, data: {
        codeScore, totalScore, percentage,
        evaluationStatus: allEvaluated ? "COMPLETED" : anyEvaluated ? "IN_PROGRESS" : "PENDING",
        evaluatedAt: allEvaluated ? new Date() : null,
        isGraded: allEvaluated,
        gradedById: allEvaluated ? req.user!.userId : null,
        gradedAt: allEvaluated ? new Date() : null,
      } });

      emitToStudent(req, attempt.id, "grade:updated", { studentTestId: attempt.id, codeScore: updated.codeScore, totalScore: updated.totalScore, percentage: updated.percentage, evaluationStatus: updated.evaluationStatus });
      return res.json({ success: true, data: { codeScore, totalScore, percentage, evaluationStatus: updated.evaluationStatus } });
    } catch (error) {
      console.error("Could not grade question", error);
      return res.status(500).json({ success: false, message: "Could not save question grade" });
    }
  }

  async publishResults(req: Request, res: Response) {
    try {
      if (typeof req.body.publish !== "boolean") return res.status(400).json({ success: false, message: "publish must be a boolean" });
      const test = await getOwnedTest(req.params.testId, req);
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      if (req.body.publish) {
        const pending = await prisma.studentTest.count({ where: { testId: test.id, status: { in: FINISHED_STATUSES }, evaluationStatus: { not: "COMPLETED" } } });
        if (pending > 0) return res.status(409).json({ success: false, message: `${pending} submission(s) still need evaluation` });
      }
      const publishedAt = req.body.publish ? new Date() : null;
      const updated = await prisma.test.update({ where: { id: test.id }, data: {
        resultsPublished: req.body.publish, publishedAt, publishedBy: req.body.publish ? req.user!.userId : null,
      } });
      await recordAudit(req, req.body.publish ? "RESULTS_PUBLISHED" : "RESULTS_UNPUBLISHED", { testId: test.id });
      const attempts = await prisma.studentTest.findMany({ where: { testId: test.id }, select: { id: true, studentId: true } });
      const event = { testId: test.id, resultsPublished: updated.resultsPublished, publishedAt: updated.publishedAt };
      const io = req.app.get("io");
      const studentIds = new Set(attempts.map((attempt) => attempt.studentId));
      studentIds.forEach((studentId) => io?.to(`student_user_${studentId}`).emit("results:published", event));
      for (const attempt of attempts) emitToStudent(req, attempt.id, "results:published", event);
      return res.json({ success: true, data: { resultsPublished: updated.resultsPublished, publishedAt: updated.publishedAt } });
    } catch (error) {
      console.error("Could not update publication state", error);
      return res.status(500).json({ success: false, message: "Could not update publication state" });
    }
  }

  async analytics(req: Request, res: Response) {
    try {
      const test = await getOwnedTest(req.params.testId, req);
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      const batchFilter = test.targetBatches.length ? { in: test.targetBatches } : undefined;
      const divisionFilter = test.targetDivisions.length ? { in: test.targetDivisions } : undefined;
      const [attempts, students, violations] = await Promise.all([
        prisma.studentTest.findMany({ where: { testId: test.id }, include: { student: { select: { batch: true, division: true } } } }),
        prisma.student.findMany({ where: { ...(batchFilter ? { batch: batchFilter } : {}), ...(divisionFilter ? { division: divisionFilter } : {}) }, select: { id: true, batch: true, division: true } }),
        prisma.violation.findMany({ where: { testId: test.id }, select: { violationType: true } }),
      ]);
      const appeared = attempts.filter((item) => item.startedAt);
      const finished = attempts.filter((item) => FINISHED_STATUSES.includes(item.status));
      const terminated = attempts.filter((item) => ["TERMINATED", "VIOLATION_SUBMITTED"].includes(item.status));
      const scores = finished.map((item) => attemptPercentage(item.totalScore, test.totalMarks)).sort((a, b) => a - b);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const median = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) : 0;
      const passCount = finished.filter((attempt) => !["TERMINATED", "VIOLATION_SUBMITTED"].includes(attempt.status) && attemptPercentage(attempt.totalScore, test.totalMarks) >= 40).length;
      const buckets = [0, 0, 0, 0, 0];
      scores.forEach((score) => { buckets[Math.min(4, Math.max(0, Math.ceil(score / 20) - 1))] += 1; });
      const byGroup = new Map<string, { count: number; score: number }>();
      finished.forEach((attempt) => {
        const key = `${attempt.student.batch} · Div ${attempt.student.division}`;
        const item = byGroup.get(key) || { count: 0, score: 0 };
        item.count += 1;
        item.score += attemptPercentage(attempt.totalScore, test.totalMarks);
        byGroup.set(key, item);
      });
      const violationCounts = new Map<string, number>();
      violations.forEach(({ violationType }) => violationCounts.set(violationType, (violationCounts.get(violationType) || 0) + 1));
      return res.json({ success: true, data: {
        totalEnrolled: students.length, totalAppeared: appeared.length, totalSubmitted: finished.length, totalTerminated: terminated.length,
        highestScore: scores.length ? scores[scores.length - 1] : 0, lowestScore: scores.length ? scores[0] : 0,
        averageScore: avg, medianScore: median, passCount, failCount: scores.length - passCount,
        passRate: scores.length ? passCount / scores.length * 100 : 0,
        scoreDistribution: ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"].map((label, index) => ({ label, count: buckets[index] })),
        batchDivisionAverages: Array.from(byGroup, ([group, value]) => ({ group, attempts: value.count, average: value.score / value.count })).sort((a, b) => a.group.localeCompare(b.group)),
        totalViolations: violations.length,
        violationsByType: Array.from(violationCounts, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      } });
    } catch (error) {
      console.error("Could not calculate analytics", error);
      return res.status(500).json({ success: false, message: "Could not calculate analytics" });
    }
  }

  async exportExcel(req: Request, res: Response) {
    try {
      const test = await getOwnedTest(req.params.testId, req);
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      const attempts = await prisma.studentTest.findMany({ where: { testId: test.id, status: { in: FINISHED_STATUSES } }, include: { student: true }, orderBy: { totalScore: "desc" } });
      const data = attempts.map((attempt, index) => ({
        rank: index + 1, enrollmentNo: attempt.student.enrollmentNo, studentName: attempt.student.name,
        batch: attempt.student.batch, division: attempt.student.division, mcqScore: attempt.mcqScore,
        codeScore: attempt.codeScore, totalScore: attempt.totalScore, maxMarks: test.totalMarks,
        percentage: attemptPercentage(attempt.totalScore, test.totalMarks), violations: attempt.violationCount,
        examStatus: attempt.status, resultStatus: test.resultsPublished ? "PUBLISHED" : "UNPUBLISHED",
      }));
      const percentages = data.map((row) => row.percentage);
      const pass = data.filter((row) => !["TERMINATED", "VIOLATION_SUBMITTED"].includes(row.examStatus) && row.percentage >= 40).length;
      const metrics = { highest: percentages.length ? Math.max(...percentages) : 0, lowest: percentages.length ? Math.min(...percentages) : 0, average: percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : 0, pass, fail: percentages.length - pass };
      const buffer = exportWorkbook(test.title, test.subject, test.totalMarks, metrics, data);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(test.title)}-results.xlsx"`);
      return res.send(buffer);
    } catch (error) {
      console.error("Could not export workbook", error);
      return res.status(500).json({ success: false, message: "Could not export Excel report" });
    }
  }

  async exportCsv(req: Request, res: Response) {
    try {
      const test = await getOwnedTest(req.params.testId, req);
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      const attempts = await prisma.studentTest.findMany({ where: { testId: test.id, status: { in: FINISHED_STATUSES } }, include: { student: true }, orderBy: { totalScore: "desc" } });
      const rows = [
        ["Rank", "Enrollment No", "Student Name", "Batch", "Division", "MCQ Score", "Code Score", "Total Score", "Max Marks", "Percentage (%)", "Violations", "Exam Status", "Result Status"],
        ...attempts.map((attempt, index) => [index + 1, attempt.student.enrollmentNo, attempt.student.name, attempt.student.batch, attempt.student.division, attempt.mcqScore, attempt.codeScore, attempt.totalScore, test.totalMarks, attemptPercentage(attempt.totalScore, test.totalMarks).toFixed(2), attempt.violationCount, attempt.status, test.resultsPublished ? "PUBLISHED" : "UNPUBLISHED"]),
      ];
      const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(test.title)}-results.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Could not export CSV", error);
      return res.status(500).json({ success: false, message: "Could not export CSV report" });
    }
  }

  async studentResults(req: Request, res: Response) {
    try {
      const attempts = await prisma.studentTest.findMany({ where: { studentId: req.user!.userId, status: { in: FINISHED_STATUSES } }, include: { test: { select: { id: true, title: true, subject: true, totalMarks: true, resultsPublished: true, publishedAt: true } } }, orderBy: { submittedAt: "desc" } });
      return res.json({ success: true, data: attempts.map((attempt) => attempt.test.resultsPublished ? {
        studentTestId: attempt.id, test: attempt.test, status: attempt.status,
        evaluationStatus: attempt.evaluationStatus, mcqScore: attempt.mcqScore, codeScore: attempt.codeScore,
        totalScore: attempt.totalScore, percentage: attempt.percentage, submittedAt: attempt.submittedAt,
      } : {
        studentTestId: attempt.id, test: { id: attempt.test.id, title: attempt.test.title, subject: attempt.test.subject, totalMarks: attempt.test.totalMarks },
        status: "PENDING_PUBLICATION", submittedAt: attempt.submittedAt,
      }) });
    } catch (error) {
      console.error("Could not load student results", error);
      return res.status(500).json({ success: false, message: "Could not load results" });
    }
  }

  async studentResult(req: Request, res: Response) {
    try {
      const attempt = await prisma.studentTest.findFirst({ where: { id: req.params.studentTestId, studentId: req.user!.userId }, include: { test: true, student: true, answers: true } });
      if (!attempt) return res.status(404).json({ success: false, message: "Result not found" });
      if (!attempt.test.resultsPublished) return res.status(403).json({ success: false, code: "PENDING_PUBLICATION", message: "Results are not published yet" });
      const assigned = attempt.assignedQuestions as Array<{ questionId: string; sectionId?: string | null; sectionTitle?: string; order?: number; marks?: number }>;
      const ids = assigned.map((question) => question.questionId);
      const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
      const byId = new Map(questions.map((question) => [question.id, question]));
      const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
      const details = assigned.map((item) => {
        const question = byId.get(item.questionId);
        const answer = answers.get(item.questionId);
        if (!question) return null;
        const choices = Array.isArray(question.options) ? question.options as Array<{ id?: string; text?: string; isCorrect?: boolean }> : [];
        const correct = choices.filter((option) => option.isCorrect).map((option, index) => ({ id: option.id || String(index), text: option.text }));
        const selectedIds = (answer?.selectedOptions as string[] | null) || [];
        const selected = choices.map((option, index) => ({ id: option.id || String(index), text: option.text })).filter((option) => selectedIds.includes(option.id));
        return {
          questionId: question.id, order: item.order, sectionId: item.sectionId, sectionTitle: item.sectionTitle,
          questionType: question.questionType, questionText: question.questionText, maxMarks: item.marks ?? question.marks,
          marksObtained: answer?.marksObtained ?? answer?.marksAwarded ?? 0, isCorrect: answer?.isCorrect ?? null,
          chosenOptions: selected, correctOptions: correct, studentCode: answer?.codeAnswer ?? null,
          studentText: answer?.textAnswer ?? null, starterCode: question.codeSnippet,
          solutionCode: question.solutionCode, expectedOutput: question.expectedOutput, testCases: question.testCases,
          feedback: answer?.evaluatorFeedback ?? answer?.facultyComment ?? null,
        };
      }).filter(Boolean);
      const sectionTotals = new Map<string, { earned: number; max: number }>();
      details.forEach((item: any) => {
        const key = item.sectionTitle || "General";
        const totals = sectionTotals.get(key) || { earned: 0, max: 0 };
        totals.earned += item.marksObtained;
        totals.max += item.maxMarks;
        sectionTotals.set(key, totals);
      });
      return res.json({ success: true, data: {
        student: { name: attempt.student.name, enrollmentNo: attempt.student.enrollmentNo, batch: attempt.student.batch, division: attempt.student.division },
        test: { id: attempt.test.id, title: attempt.test.title, subject: attempt.test.subject, totalMarks: attempt.test.totalMarks },
        status: attempt.status,
        mcqScore: attempt.mcqScore, codeScore: attempt.codeScore, totalScore: attempt.totalScore,
        percentage: attempt.percentage, evaluationStatus: attempt.evaluationStatus,
        sectionTotals: Array.from(sectionTotals, ([section, totals]) => ({ section, ...totals })), questions: details,
      } });
    } catch (error) {
      console.error("Could not load published result", error);
      return res.status(500).json({ success: false, message: "Could not load detailed result" });
    }
  }
}

function questionsForAttempt<T extends { id: string; questionType: string }>(assigned: Array<{ questionId: string }>, questions: T[]) {
  const ids = new Set(assigned.map((item) => item.questionId));
  return questions.filter((question) => ids.has(question.id));
}

function questionsByType<T extends { id: string; questionType: string }>(questions: T[]) {
  return questions.filter((question) => SUBJECTIVE_TYPES.has(question.questionType));
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) || "exam";
}

export const gradingController = new GradingController();
