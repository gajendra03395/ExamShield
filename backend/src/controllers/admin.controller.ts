import { Request, Response } from "express";
import prisma from "../config/database";
import { recordAudit } from "../services/audit";
import { examService } from "../services/exam.service";

export const adminController = {
  async overview(_req: Request, res: Response) {
    const [students, faculty, tests, activeExams, logs] = await Promise.all([
      prisma.student.count(), prisma.faculty.count(), prisma.test.count(),
      prisma.studentTest.count({ where: { status: "IN_PROGRESS" } }),
      prisma.activityLog.count(),
    ]);
    res.json({ success: true, data: { students, faculty, tests, activeExams, logs } });
  },
  async batches(_req: Request, res: Response) {
    await prisma.batch.createMany({ data: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"].map((name) => ({ name })), skipDuplicates: true });
    res.json({ success: true, data: await prisma.batch.findMany({ orderBy: { name: "asc" } }) });
  },
  async createBatch(req: Request, res: Response) {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Batch name is required" });
    try {
      const data = await prisma.batch.create({ data: { name } });
      await recordAudit(req, "BATCH_CREATED", { name });
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error?.code === "P2002") return res.status(409).json({ success: false, message: "Batch already exists" });
      console.error("Could not create batch", error);
      return res.status(500).json({ success: false, message: "Could not create batch" });
    }
  },
  async divisions(_req: Request, res: Response) {
    await prisma.division.createMany({ data: ["A", "B", "C"].map((name) => ({ name })), skipDuplicates: true });
    res.json({ success: true, data: await prisma.division.findMany({ orderBy: { name: "asc" } }) });
  },
  async createDivision(req: Request, res: Response) {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Division name is required" });
    try {
      const data = await prisma.division.create({ data: { name } });
      await recordAudit(req, "DIVISION_CREATED", { name });
      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error?.code === "P2002") return res.status(409).json({ success: false, message: "Division already exists" });
      console.error("Could not create division", error);
      return res.status(500).json({ success: false, message: "Could not create division" });
    }
  },
  async users(_req: Request, res: Response) {
    const [students, faculty] = await Promise.all([
      prisma.student.findMany({ select: { id: true, name: true, email: true, enrollmentNo: true, batch: true, division: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      prisma.faculty.findMany({ select: { id: true, name: true, email: true, department: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    res.json({ success: true, data: [...students.map((u) => ({ ...u, role: "STUDENT" })), ...faculty.map((u) => ({ ...u, role: "FACULTY" }))] });
  },
  async setUserActive(req: Request, res: Response) {
    const { role, id } = req.params;
    const isActive = req.body.isActive;
    if (typeof isActive !== "boolean" || !["student", "faculty"].includes(role)) return res.status(400).json({ success: false, message: "Role and isActive are required" });
    let user;
    try {
      user = role === "student"
        ? await prisma.student.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } })
        : await prisma.faculty.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } });
    } catch (error: any) {
      if (error?.code === "P2025") return res.status(404).json({ success: false, message: "User not found" });
      console.error("Could not update user status", error);
      return res.status(500).json({ success: false, message: "Could not update user status" });
    }
    await recordAudit(req, isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", { role, id });
    if (!isActive) {
      const io = req.app.get("io");
      try {
        if (role === "student") {
          const activeAttempts = await prisma.studentTest.findMany({ where: { studentId: id, status: "IN_PROGRESS" }, select: { id: true, testId: true } });
          for (const attempt of activeAttempts) {
            try {
              await examService.submitExam(attempt.id, id, "FORCE_SUBMITTED");
              await prisma.studentTest.update({ where: { id: attempt.id }, data: { status: "TERMINATED", submissionReason: "ACCOUNT_DEACTIVATED" } });
              io?.to(`student_${attempt.id}`).emit("exam:terminated", { studentTestId: attempt.id, reason: "ACCOUNT_DEACTIVATED", message: "Your account was deactivated by an administrator; this exam has been submitted." });
              await recordAudit(req, "SECURITY_TERMINATION", { studentTestId: attempt.id, testId: attempt.testId, reason: "ACCOUNT_DEACTIVATED" });
            } catch (error) { console.error("Could not terminate deactivated student's exam", error); }
          }
        }
      } catch (error) { console.error("Could not inspect deactivated user's active exams", error); }
      setTimeout(() => io?.in(`user_${id}`).disconnectSockets(true), 500).unref();
    }
    return res.json({ success: true, data: user });
  },
  async logs(req: Request, res: Response) {
    const take = Math.min(500, Math.max(1, Number(req.query.take) || 200));
    const data = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take });
    res.json({ success: true, data });
  },
};
