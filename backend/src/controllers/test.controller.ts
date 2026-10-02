import { Request, Response } from "express";
import { testService } from "../services/test.service";
import prisma from "../config/database";
import { recordAudit } from "../services/audit";

export class TestController {
  async create(req: Request, res: Response) {
    try {
      const test = await testService.createTest(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: test });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyTests(req: Request, res: Response) {
    try {
      const tests = await testService.getMyTests(req.user!.userId, req.user!.role === "ADMIN");
      res.json({ success: true, data: tests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async setQuestions(req: Request, res: Response) {
    try {
      const testId = req.params.id;
      const isAdmin = req.user!.role === "ADMIN";
      const test = await prisma.test.findFirst({ where: { id: testId, ...(isAdmin ? {} : { facultyId: req.user!.userId }) } });
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      if (test.status !== "DRAFT") return res.status(409).json({ success: false, message: "Questions can only be changed on draft tests" });
      if (await prisma.studentTest.count({ where: { testId } })) return res.status(409).json({ success: false, message: "This test already has student attempts" });
      const questionIds = req.body.questionIds;
      if (!Array.isArray(questionIds) || questionIds.length < 1 || questionIds.length > 200 || questionIds.some((id: unknown) => typeof id !== "string") || new Set(questionIds).size !== questionIds.length) {
        return res.status(400).json({ success: false, message: "Choose between 1 and 200 unique questions" });
      }
      const questions = await prisma.question.findMany({ where: { id: { in: questionIds }, ...(isAdmin ? {} : { facultyId: req.user!.userId }), isActive: true }, select: { id: true, marks: true } });
      if (questions.length !== questionIds.length) return res.status(400).json({ success: false, message: "One or more questions are unavailable or belong to another faculty member" });
      const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.testSection.deleteMany({ where: { testId } });
        const section = await tx.testSection.create({ data: { testId, title: "General", sectionOrder: 1, totalMarks } });
        await tx.sectionQuestion.createMany({ data: questions.map((question, questionOrder) => ({ sectionId: section.id, questionId: question.id, questionOrder: questionOrder + 1 })) });
        return tx.test.update({
          where: { id: testId },
          data: { totalMarks },
          include: {
            sections: {
              include: {
                questions: {
                  include: { question: { select: { id: true, questionText: true, questionType: true, marks: true } } },
                },
              },
            },
          },
        });
      });
      await recordAudit(req, "TEST_QUESTIONS_UPDATED", { testId, questionCount: questions.length, totalMarks });
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Could not update test questions", error);
      return res.status(500).json({ success: false, message: "Could not update test questions" });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const test = await prisma.test.findFirst({ where: { id: req.params.id, ...(req.user!.role === "ADMIN" ? {} : { facultyId: req.user!.userId }), }, select: { id: true, status: true } });
      if (!test) return res.status(404).json({ success: false, message: "Test not found" });
      if (test.status !== "DRAFT") return res.status(409).json({ success: false, message: "Only draft tests can be deleted" });
      if (await prisma.studentTest.count({ where: { testId: test.id } })) return res.status(409).json({ success: false, message: "Tests with student attempts cannot be deleted" });
      await prisma.test.delete({ where: { id: test.id } });
      return res.json({ success: true, message: "Test deleted" });
    } catch {
      return res.status(500).json({ success: false, message: "Could not delete test" });
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const test = await testService.publishTest(req.params.id, req.user!.userId, req.user!.role === "ADMIN");
      await recordAudit(req, "TEST_PUBLISHED", { testId: test.id, title: test.title });
      res.json({ success: true, data: test, message: "Test published! Students can now see it." });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const test = await testService.updateTest(req.params.id, req.user!.userId, req.body, req.user!.role === "ADMIN");
      res.json({ success: true, data: test });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async liveMonitor(req: Request, res: Response) {
    try {
      const test = await prisma.test.findUnique({ where: { id: req.params.id }, select: { id: true, facultyId: true, maxViolations: true } });
      if (!test || (req.user!.role !== "ADMIN" && test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }
      const attempts = await prisma.studentTest.findMany({
        where: { testId: test.id, status: { in: ["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED", "VIOLATION_SUBMITTED", "TERMINATED"] } },
        include: {
          student: { select: { name: true, enrollmentNo: true, batch: true, division: true } },
          violations: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { startedAt: "desc" },
      });
      return res.json({ success: true, data: attempts.map((attempt) => ({
        studentTestId: attempt.id, studentName: attempt.student.name, enrollmentNo: attempt.student.enrollmentNo,
        batch: attempt.student.batch, division: attempt.student.division, status: attempt.status,
        score: attempt.totalScore, violationCount: attempt.violationCount, maxViolations: test.maxViolations,
        submissionReason: attempt.submissionReason,
        startTime: attempt.startedAt, violations: attempt.violations,
      })) });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message || "Could not load live monitor" });
    }
  }
}

export const testController = new TestController();
