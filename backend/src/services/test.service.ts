import prisma from "../config/database";

export class TestService {
  async createTest(facultyId: string, data: any) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const durationMinutes = Number(data.durationMinutes);
    const totalMarks = Number(data.totalMarks);
    const targetBatches = normalizedStringList(data.targetBatches);
    if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 200) throw new Error("A test title of at most 200 characters is required");
    if (typeof data.subject !== "string" || !data.subject.trim() || data.subject.length > 120) throw new Error("A subject of at most 120 characters is required");
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || startTime >= endTime) throw new Error("A valid end time after the start time is required");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) throw new Error("Duration must be between 1 and 1440 minutes");
    if (!Number.isFinite(totalMarks) || totalMarks <= 0 || totalMarks > 100000) throw new Error("Total marks must be greater than zero");
    if (!targetBatches.length) throw new Error("Select at least one target batch");
    const maxViolations = Number(data.maxViolations ?? 3);
    if (!Number.isInteger(maxViolations) || maxViolations < 1 || maxViolations > 100) throw new Error("Maximum violations must be between 1 and 100");
    const targetDivisions = normalizedStringList(data.targetDivisions);
    const [knownBatches, knownDivisions] = await Promise.all([
      prisma.batch.findMany({ where: { name: { in: targetBatches } }, select: { name: true } }),
      targetDivisions.length ? prisma.division.findMany({ where: { name: { in: targetDivisions } }, select: { name: true } }) : Promise.resolve([]),
    ]);
    if (knownBatches.length !== targetBatches.length || knownDivisions.length !== targetDivisions.length) throw new Error("Choose only batches and divisions configured by your administrator");
    const passingMarks = data.passingMarks == null ? null : Number(data.passingMarks);
    if (passingMarks !== null && (!Number.isFinite(passingMarks) || passingMarks < 0 || passingMarks > totalMarks)) throw new Error("Passing marks must be between zero and total marks");
    if (data.description !== undefined && (typeof data.description !== "string" || data.description.length > 4000)) throw new Error("Description must be at most 4000 characters");
    return prisma.test.create({
      data: {
        facultyId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        subject: data.subject,
        startTime,
        endTime,
        durationMinutes,
        totalMarks,
        passingMarks,
        targetBatches,
        targetDivisions,
        enableLockdown: data.enableLockdown ?? true,
        maxViolations,
        shuffleQuestions: data.shuffleQuestions ?? true,
        shuffleOptions: data.shuffleOptions ?? true,
        status: "DRAFT",
      },
    });
  }

  async getMyTests(facultyId: string, isAdmin = false) {
    return prisma.test.findMany({
      where: isAdmin ? {} : { facultyId },
      include: {
        _count: { select: { studentTests: true } },
        sections: { orderBy: { sectionOrder: "asc" }, include: { questions: { orderBy: { questionOrder: "asc" }, include: { question: { select: { id: true, questionText: true, questionType: true, marks: true, subject: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async publishTest(testId: string, facultyId: string, isAdmin = false) {
    const test = await prisma.test.findFirst({ where: { id: testId, ...(isAdmin ? {} : { facultyId }) }, include: { sections: { include: { questions: { include: { question: true } } } } } });
    if (!test) throw new Error("Test not found");
    if (test.status !== "DRAFT") throw new Error("Only draft tests can be published");
    if (test.startTime >= test.endTime || test.durationMinutes < 1 || test.totalMarks <= 0) throw new Error("Test schedule or marks are invalid");
    const questions = test.sections.flatMap((section) => section.questions);
    if (!questions.length) throw new Error("Add questions to this test before publishing");
    if (questions.some((item) => !item.question.isActive || (!isAdmin && item.question.facultyId !== facultyId))) throw new Error("The test contains an inactive or unowned question");
    const assignedMarks = questions.reduce((sum, item) => sum + (item.marksOverride ?? item.question.marks), 0);
    if (Math.abs(assignedMarks - test.totalMarks) > 0.01) throw new Error(`Test total marks (${test.totalMarks}) must match the assigned question marks (${assignedMarks})`);

    return prisma.test.update({
      where: { id: testId },
      data: { status: "PUBLISHED" },
    });
  }

  async updateTest(testId: string, facultyId: string, data: any, isAdmin = false) {
    const test = await prisma.test.findFirst({ where: { id: testId, ...(isAdmin ? {} : { facultyId }) } });
    if (!test) throw new Error("Test not found");
    if (test.status !== "DRAFT") throw new Error("Only draft tests can be edited");
    if (await prisma.studentTest.count({ where: { testId } })) throw new Error("A test with student attempts cannot be edited");

    return prisma.test.update({
      where: { id: testId },
      data: {
        title: data.title ?? test.title,
        description: data.description,
        subject: data.subject ?? test.subject,
        startTime: data.startTime ? new Date(data.startTime) : test.startTime,
        endTime: data.endTime ? new Date(data.endTime) : test.endTime,
        durationMinutes: data.durationMinutes ?? test.durationMinutes,
        totalMarks: data.totalMarks ?? test.totalMarks,
        targetBatches: data.targetBatches ?? test.targetBatches,
        targetDivisions: data.targetDivisions ?? test.targetDivisions,
        maxViolations: data.maxViolations ?? test.maxViolations,
        enableLockdown: data.enableLockdown ?? test.enableLockdown,
      },
    });
  }
}

export const testService = new TestService();

function normalizedStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}
