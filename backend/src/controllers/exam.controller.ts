import { Request, Response } from "express";
import { examService } from "../services/exam.service";
import prisma from "../config/database";
import { recordAudit } from "../services/audit";

const violationTypeMap: Record<string, string> = {
  ALT_TAB: "ALT_TAB", WINDOW_SWITCH: "WINDOW_SWITCH", FOCUS_LOST: "WINDOW_SWITCH",
  TASK_MANAGER: "TASK_MANAGER", PRINT_SCREEN: "PRINT_SCREEN", USB_DEVICE: "USB_DEVICE",
  USB_CONNECTED: "USB_DEVICE", PROCESS_LAUNCH: "PROCESS_LAUNCH", UNAUTHORIZED_PROCESS: "PROCESS_LAUNCH",
  MULTI_MONITOR: "MULTI_MONITOR", MULTIPLE_MONITORS: "MULTI_MONITOR", VM_DETECTED: "VM_DETECTED",
  CLIPBOARD_ACCESS: "CLIPBOARD_ACCESS", KEYBOARD_LOCK: "KEYBOARD_SHORTCUT",
  KEYBOARD_SHORTCUT: "KEYBOARD_SHORTCUT", SCREEN_MINIMIZE: "SCREEN_MINIMIZE",
};

const emit = (req: Request, room: string, event: string, payload: unknown) => {
  req.app.get("io")?.to(room).emit(event, payload);
};

export class ExamController {
  async getAvailable(req: Request, res: Response) {
    try {
      const tests = await examService.getAvailableTests(req.user!.userId);
      res.json({ success: true, data: tests });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async start(req: Request, res: Response) {
    try {
      const { testId } = req.params;
      const meta = {
        machineId: req.body.machineId,
        ipAddress: req.ip,
        osVersion: req.body.osVersion,
      };
      const session = await examService.startExam(testId, req.user!.userId, meta);
      res.json({ success: true, data: session });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getSession(req: Request, res: Response) {
    try {
      const session = await examService.getExamSession(req.params.studentTestId, req.user!.userId);
      res.json({ success: true, data: session });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async saveAnswer(req: Request, res: Response) {
    try {
      const answer = await examService.saveAnswer(
        req.params.studentTestId,
        req.user!.userId,
        req.body
      );
      res.json({ success: true, data: answer });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async heartbeat(req: Request, res: Response) {
    try {
      const { timeRemainingSec } = req.body;
      await examService.updateTimeRemaining(
        req.params.studentTestId,
        req.user!.userId,
        timeRemainingSec
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async submit(req: Request, res: Response) {
    try {
      const reason = req.body.reason || "NORMAL";
      const result = await examService.submitExam(
        req.params.studentTestId,
        req.user!.userId,
        reason
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async reportViolation(req: Request, res: Response) {
    try {
      const { studentTestId, type, details, screenshotBase64, clientEventId } = req.body;
      if (!studentTestId || !type || typeof details !== "string") {
        return res.status(400).json({ success: false, message: "studentTestId, type, and details are required" });
      }
      if (screenshotBase64 !== undefined && screenshotBase64 !== null && (typeof screenshotBase64 !== "string" || screenshotBase64.length > 7_500_000)) {
        return res.status(413).json({ success: false, message: "Screenshot exceeds the allowed size" });
      }
      if (clientEventId !== undefined && (typeof clientEventId !== "string" || clientEventId.length > 100)) return res.status(400).json({ success: false, message: "Invalid clientEventId" });
      if (clientEventId) {
        const prior = await prisma.violation.findUnique({ where: { clientEventId }, select: { studentId: true, studentTestId: true, violationNumber: true } });
        if (prior) {
          if (prior.studentId !== req.user!.userId || prior.studentTestId !== studentTestId) return res.status(403).json({ success: false, message: "Violation event does not belong to this user" });
          return res.json({ success: true, duplicate: true, data: { count: prior.violationNumber } });
        }
      }
      const session = await prisma.studentTest.findFirst({
        where: { id: studentTestId, studentId: req.user!.userId, status: "IN_PROGRESS" },
        include: { student: { select: { name: true, enrollmentNo: true } }, test: { select: { id: true, maxViolations: true } } },
      });
      if (!session) return res.status(404).json({ success: false, message: "Active exam session not found" });
      const maxViolations = Math.max(1, session.test.maxViolations);

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.studentTest.update({ where: { id: studentTestId }, data: { violationCount: { increment: 1 } } });
        const violation = await tx.violation.create({ data: {
          studentTestId, studentId: req.user!.userId, testId: session.test.id,
          clientEventId: clientEventId || null,
          violationType: violationTypeMap[String(type).toUpperCase()] || "UNKNOWN" as any,
          description: details.slice(0, 2000),
          screenshotUrl: screenshotBase64 ? (screenshotBase64.startsWith("data:") ? screenshotBase64 : `data:image/jpeg;base64,${screenshotBase64}`) : null,
          violationNumber: updated.violationCount,
          actionTaken: updated.violationCount >= maxViolations ? "TERMINATION_PENDING" : "WARNING",
        } });
        return { count: updated.violationCount, violation };
      });

      const timestamp = result.violation.createdAt;
      emit(req, `test_${session.test.id}`, "violation:new", {
        studentTestId, studentName: session.student.name, enrollmentNo: session.student.enrollmentNo,
        violationType: result.violation.violationType, details: result.violation.description,
        count: result.count, maxViolations, screenshotUrl: result.violation.screenshotUrl,
        screenshotBase64: result.violation.screenshotUrl, timestamp,
      });

      if (result.count >= maxViolations) {
        await examService.submitExam(studentTestId, req.user!.userId, "VIOLATION_LIMIT");
        await prisma.studentTest.update({ where: { id: studentTestId }, data: { status: "TERMINATED", submissionReason: "VIOLATION_LIMIT" } });
        await prisma.violation.update({ where: { id: result.violation.id }, data: { actionTaken: "TERMINATED" } });
        await recordAudit(req, "SECURITY_TERMINATION", { studentTestId, testId: session.test.id, violationCount: result.count });
        emit(req, `student_${studentTestId}`, "exam:terminated", {
          studentTestId, reason: "VIOLATION_LIMIT", message: "Your exam was terminated after reaching the violation limit.",
          count: result.count, maxViolations,
        });
      }

      return res.status(201).json({ success: true, data: { count: result.count, maxViolations, terminated: result.count >= maxViolations } });
    } catch (error: any) {
      console.error("Violation processing failed:", error);
      return res.status(500).json({ success: false, message: "Could not process violation" });
    }
  }

  async forceSubmit(req: Request, res: Response) {
    try {
      const { studentTestId } = req.body;
      const attempt = await prisma.studentTest.findUnique({ where: { id: studentTestId }, include: { test: true } });
      if (!attempt || (req.user!.role !== "ADMIN" && attempt.test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Exam attempt not found" });
      }
      const result = await examService.submitExam(studentTestId, attempt.studentId, "FORCE_SUBMITTED");
      await recordAudit(req, "SECURITY_TERMINATION", { studentTestId, testId: attempt.testId, reason: "FORCE_SUBMITTED" });
      emit(req, `student_${studentTestId}`, "exam:force_submitted", {
        studentTestId, reason: "FORCE_SUBMITTED", message: "Your exam was submitted by the faculty.", result,
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message || "Could not force submit exam" });
    }
  }

  async sendWarning(req: Request, res: Response) {
    try {
      const { studentTestId, message } = req.body;
      if (typeof message !== "string" || !message.trim()) return res.status(400).json({ success: false, message: "Warning message is required" });
      const attempt = await prisma.studentTest.findUnique({ where: { id: studentTestId }, include: { test: true } });
      if (!attempt || attempt.status !== "IN_PROGRESS" || (req.user!.role !== "ADMIN" && attempt.test.facultyId !== req.user!.userId)) {
        return res.status(404).json({ success: false, message: "Active exam attempt not found" });
      }
      emit(req, `student_${studentTestId}`, "warning:received", { message: message.trim().slice(0, 500), timestamp: new Date() });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Could not send warning" });
    }
  }
}

export const examController = new ExamController();
