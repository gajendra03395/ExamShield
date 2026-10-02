import prisma from "../config/database";
import { questionShuffleService } from "./question-shuffle.service";

export class ExamService {
  async expireOverdueSessions() {
    const active = await prisma.studentTest.findMany({
      where: { status: "IN_PROGRESS", startedAt: { not: null } },
      include: { test: { select: { durationMinutes: true, endTime: true } } },
      orderBy: { startedAt: "asc" },
      take: 500,
    });
    const expired: Array<{ studentTestId: string; studentId: string }> = [];
    const now = Date.now();
    for (const attempt of active) {
      const deadline = Math.min(attempt.startedAt!.getTime() + attempt.test.durationMinutes * 60_000, attempt.test.endTime.getTime());
      if (now < deadline) continue;
      try {
        await this.submitExam(attempt.id, attempt.studentId, "TIME_UP");
        expired.push({ studentTestId: attempt.id, studentId: attempt.studentId });
      } catch { /* Another request may have submitted the attempt concurrently. */ }
    }
    return expired;
  }

  async getAvailableTests(studentId: string) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !student.isActive) throw new Error("Active student account not found");

    const now = new Date();

    const tests = await prisma.test.findMany({
      where: {
        status: { in: ["PUBLISHED", "LIVE"] },
        targetBatches: { has: student.batch },
        endTime: { gte: now },
        sections: { some: { questions: { some: {} } } },
      },
      include: {
        faculty: { select: { name: true } },
        studentTests: {
          where: { studentId },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            violationCount: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return tests
      .filter((t) => {
        if (!t.targetDivisions || t.targetDivisions.length === 0) return true;
        return t.targetDivisions.includes(student.division);
      })
      .map((t) => {
        const attempt = t.studentTests[0] || null;
        const canStart =
          now >= t.startTime &&
          now <= t.endTime &&
          (!attempt || attempt.status === "NOT_STARTED" || attempt.status === "IN_PROGRESS");

        return {
          id: t.id,
          title: t.title,
          subject: t.subject,
          description: t.description,
          startTime: t.startTime,
          endTime: t.endTime,
          durationMinutes: t.durationMinutes,
          totalMarks: t.totalMarks,
          maxViolations: t.maxViolations,
          enableLockdown: t.enableLockdown,
          facultyName: t.faculty.name,
          status: t.status,
          myAttempt: attempt,
          canStart,
        };
      });
  }

  async startExam(
    testId: string,
    studentId: string,
    meta?: { machineId?: string; ipAddress?: string; osVersion?: string }
  ) {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new Error("Test not found");
    if (!["PUBLISHED", "LIVE"].includes(test.status)) throw new Error("This test is not open for students");

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { batch: true, division: true, isActive: true } });
    if (!student?.isActive) throw new Error("Active student account not found");
    if (!test.targetBatches.includes(student.batch) || (test.targetDivisions.length > 0 && !test.targetDivisions.includes(student.division))) {
      throw new Error("You are not assigned to this test");
    }

    const now = new Date();
    if (now < test.startTime) throw new Error("Exam has not started yet");
    if (now > test.endTime) throw new Error("Exam window has ended");

    let studentTest = await questionShuffleService.assignQuestionsToStudent(testId, studentId);

    if (
      studentTest.status === "SUBMITTED" ||
      studentTest.status === "AUTO_SUBMITTED" ||
      studentTest.status === "VIOLATION_SUBMITTED" ||
      studentTest.status === "TERMINATED"
    ) {
      throw new Error("You have already submitted this exam");
    }

    if (studentTest.status === "IN_PROGRESS") {
      return this.getExamSession(studentTest.id, studentId);
    }

    studentTest = await prisma.studentTest.update({
      where: { id: studentTest.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: now,
        timeRemainingSec: test.durationMinutes * 60,
        machineId: meta?.machineId,
        ipAddress: meta?.ipAddress,
        osVersion: meta?.osVersion,
      },
    });

    if (test.status === "PUBLISHED") {
      await prisma.test.update({ where: { id: testId }, data: { status: "LIVE" } });
    }

    return this.getExamSession(studentTest.id, studentId);
  }

  async getExamSession(studentTestId: string, studentId: string) {
    const st = await prisma.studentTest.findFirst({
      where: { id: studentTestId, studentId },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            subject: true,
            durationMinutes: true,
            totalMarks: true,
            maxViolations: true,
            allowReview: true,
            showMarksPerQ: true,
            enableLockdown: true,
            endTime: true,
          },
        },
        answers: true,
      },
    });

    if (!st) throw new Error("Exam session not found");

    const assigned = st.assignedQuestions as any[];

    const questions = assigned.map((q) => {
      const saved = st.answers.find((a) => a.questionId === q.questionId);
      return {
        order: q.order,
        questionId: q.questionId,
        sectionId: q.sectionId,
        sectionTitle: q.sectionTitle,
        questionType: q.questionType,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        codeLanguage: q.codeLanguage || "java",
        options: q.options,
        marks: st.test.showMarksPerQ ? q.marks : undefined,
        language: q.language,
        selectedOptions: saved?.selectedOptions || null,
        codeAnswer: saved?.codeAnswer ?? (q.codeSnippet || null),
        textAnswer: saved?.textAnswer ?? null,
        isFlagged: saved?.isFlagged || false,
      };
    });

    let timeRemainingSec = st.timeRemainingSec;
    if (st.status === "IN_PROGRESS" && st.startedAt) {
      const durationDeadline = st.startedAt.getTime() + st.test.durationMinutes * 60_000;
      const deadline = Math.min(durationDeadline, st.test.endTime.getTime());
      const serverRemaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      timeRemainingSec = Math.min(timeRemainingSec ?? serverRemaining, serverRemaining);
    }

    return {
      studentTestId: st.id,
      status: st.status,
      timeRemainingSec,
      violationCount: st.violationCount,
      startedAt: st.startedAt,
      test: st.test,
      questions,
      totalQuestions: questions.length,
    };
  }

  async saveAnswer(
    studentTestId: string,
    studentId: string,
    data: {
      questionId: string;
      sectionId?: string | null;
      selectedOptions?: any;
      codeAnswer?: string;
      textAnswer?: string;
      isFlagged?: boolean;
      timeSpentSec?: number;
    }
  ) {
    const st = await prisma.studentTest.findFirst({
      where: { id: studentTestId, studentId },
    });
    if (!st) throw new Error("Exam session not found");
    if (st.status !== "IN_PROGRESS") throw new Error("Exam is not in progress");
    const test = await prisma.test.findUnique({ where: { id: st.testId }, select: { durationMinutes: true, endTime: true } });
    if (!st.startedAt || !test || Date.now() >= Math.min(st.startedAt.getTime() + test.durationMinutes * 60_000, test.endTime.getTime())) {
      await this.submitExam(studentTestId, studentId, "TIME_UP");
      throw new Error("Exam time has ended; the exam was submitted");
    }

    const assigned = st.assignedQuestions as any[];
    const qMeta = assigned.find((q: any) => q.questionId === data.questionId);
    if (!qMeta) throw new Error("Question not part of this exam");
    if (data.selectedOptions !== undefined && data.selectedOptions !== null && (!Array.isArray(data.selectedOptions) || data.selectedOptions.length > 100 || data.selectedOptions.some((value: unknown) => typeof value !== "string" || value.length > 256))) throw new Error("Invalid selected options");
    if (data.codeAnswer !== undefined && data.codeAnswer !== null && (typeof data.codeAnswer !== "string" || data.codeAnswer.length > 100_000)) throw new Error("Code answer is invalid or too long");
    if (data.textAnswer !== undefined && data.textAnswer !== null && (typeof data.textAnswer !== "string" || data.textAnswer.length > 20_000)) throw new Error("Text answer is invalid or too long");
    if (data.isFlagged !== undefined && typeof data.isFlagged !== "boolean") throw new Error("Invalid flag state");
    if (data.timeSpentSec !== undefined && (!Number.isFinite(data.timeSpentSec) || data.timeSpentSec < 0 || data.timeSpentSec > 86_400)) throw new Error("Invalid time spent");

    const updateData: any = { answeredAt: new Date() };
    if (data.isFlagged !== undefined) updateData.isFlagged = data.isFlagged === true;

    if (data.selectedOptions !== undefined) {
      updateData.selectedOptions = data.selectedOptions;
    }
    if (data.codeAnswer !== undefined && data.codeAnswer !== null) {
      updateData.codeAnswer = data.codeAnswer;
    }
    if (data.textAnswer !== undefined && data.textAnswer !== null) {
      updateData.textAnswer = data.textAnswer;
    }
    if (data.timeSpentSec !== undefined && data.timeSpentSec !== null) {
      updateData.timeSpentSec = data.timeSpentSec;
    }

    // Use the unique attempt/question key so simultaneous autosaves cannot create duplicate answers.
    const createData: any = {
      studentTest: { connect: { id: studentTestId } },
      question: { connect: { id: data.questionId } },
      isFlagged: data.isFlagged === true,
    };

    const sectionId = qMeta.sectionId;
    if (sectionId && typeof sectionId === "string") {
      createData.section = { connect: { id: sectionId } };
    }

    if (data.selectedOptions !== undefined) {
      createData.selectedOptions = data.selectedOptions;
    }
    if (data.codeAnswer !== undefined && data.codeAnswer !== null) {
      createData.codeAnswer = data.codeAnswer;
    }
    if (data.textAnswer !== undefined && data.textAnswer !== null) {
      createData.textAnswer = data.textAnswer;
    }
    if (data.timeSpentSec !== undefined && data.timeSpentSec !== null) {
      createData.timeSpentSec = data.timeSpentSec;
    }

    return prisma.studentAnswer.upsert({
      where: { studentTestId_questionId: { studentTestId, questionId: data.questionId } },
      create: createData,
      update: updateData,
    });
  }

  async updateTimeRemaining(studentTestId: string, studentId: string, timeRemainingSec: number) {
    if (!Number.isFinite(timeRemainingSec)) throw new Error("Invalid remaining time");
    const st = await prisma.studentTest.findFirst({ where: { id: studentTestId, studentId, status: "IN_PROGRESS" }, include: { test: true } });
    if (!st) throw new Error("Exam is not in progress");
    const deadline = st.startedAt ? Math.min(st.startedAt.getTime() + st.test.durationMinutes * 60_000, st.test.endTime.getTime()) : 0;
    const maxRemaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    if (maxRemaining === 0) {
      await this.submitExam(studentTestId, studentId, "TIME_UP");
      throw new Error("Exam time has ended; the exam was submitted");
    }
    const savedRemaining = st.timeRemainingSec ?? maxRemaining;
    const remaining = Math.max(0, Math.min(Math.floor(timeRemainingSec), savedRemaining, maxRemaining));
    await prisma.studentTest.update({ where: { id: st.id }, data: { timeRemainingSec: remaining } });
  }

  async submitExam(studentTestId: string, studentId: string, reason: string = "NORMAL") {
    const st = await prisma.studentTest.findFirst({
      where: { id: studentTestId, studentId },
      include: { answers: true, test: true },
    });

    if (!st) throw new Error("Exam session not found");
    if (st.status !== "IN_PROGRESS") {
      throw new Error("Exam already submitted");
    }

    let autoScore = 0;
    const assigned = st.assignedQuestions as any[];
    const manualQuestionIds = new Set<string>();

    for (const ans of st.answers) {
      const qMeta = assigned.find((q: any) => q.questionId === ans.questionId);
      if (!qMeta) continue;

      const original = await prisma.question.findUnique({ where: { id: ans.questionId } });
      if (!original) continue;

      if (["MCQ", "TRUE_FALSE", "MULTI_SELECT"].includes(original.questionType)) {
        const opts = (original.options as any[]) || [];
        const correctIds = opts
          .filter((o: any) => o.isCorrect)
          .map((o: any, i: number) => o.id || String(i));
        const correctTexts = opts.filter((o: any) => o.isCorrect).map((o: any) => o.text);

        const selected = (ans.selectedOptions as any[]) || [];

        let isCorrect = false;
        if (original.questionType === "MULTI_SELECT") {
          const correctSet = new Set([...correctIds, ...correctTexts].map(String));
          isCorrect =
            selected.length === correctIds.length &&
            selected.every((s) => correctSet.has(String(s)));
        } else {
          isCorrect =
            selected.length === 1 &&
            (correctIds.includes(String(selected[0])) ||
              correctTexts.includes(String(selected[0])));
        }

        const marks = isCorrect ? (qMeta.marks ?? original.marks) : 0;
        autoScore += marks;

        await prisma.studentAnswer.update({
          where: { id: ans.id },
          data: { isCorrect, marksAwarded: marks, marksObtained: marks, isEvaluated: true },
        });
      } else if (["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING", "PROBLEM_IDENTIFICATION", "SHORT_ANSWER"].includes(original.questionType)) {
        manualQuestionIds.add(original.id);
      }
    }

    for (const question of assigned) {
      if (manualQuestionIds.has(question.questionId)) continue;
      const details = await prisma.question.findUnique({ where: { id: question.questionId }, select: { id: true, questionType: true } });
      if (details && ["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING", "PROBLEM_IDENTIFICATION", "SHORT_ANSWER"].includes(details.questionType)) manualQuestionIds.add(details.id);
    }

    const hasManualQuestions = manualQuestionIds.size > 0;
    const percentage = st.test.totalMarks > 0 ? Math.min(100, (autoScore / st.test.totalMarks) * 100) : 0;

    const statusMap: Record<string, string> = {
      NORMAL: "SUBMITTED",
      TIME_UP: "AUTO_SUBMITTED",
      VIOLATION_LIMIT: "VIOLATION_SUBMITTED",
    };

    const updated = await prisma.studentTest.update({
      where: { id: studentTestId },
      data: {
        status: statusMap[reason] || "SUBMITTED",
        submittedAt: new Date(),
        autoGradedScore: autoScore,
        submissionReason: reason,
        timeRemainingSec: 0,
        mcqScore: autoScore,
        codeScore: 0,
        totalScore: autoScore,
        percentage,
        evaluationStatus: hasManualQuestions ? "PENDING" : "COMPLETED",
        evaluatedAt: hasManualQuestions ? null : new Date(),
        isGraded: !hasManualQuestions,
        gradedAt: hasManualQuestions ? null : new Date(),
      },
    });

    return {
      studentTestId: updated.id,
      status: updated.status,
      autoGradedScore: autoScore,
      message: "Exam submitted successfully. Results will be available after faculty review.",
    };
  }
}

export const examService = new ExamService();
