import prisma from "../config/database";
import { shuffleArray } from "../utils/shuffle";

export class QuestionShuffleService {
  async assignQuestionsToStudent(testId: string, studentId: string) {
    const existing = await prisma.studentTest.findUnique({
      where: { testId_studentId: { testId, studentId } },
    });
    if (existing) {
      const assigned = Array.isArray(existing.assignedQuestions) ? existing.assignedQuestions : [];
      if (assigned.length > 0 || existing.status !== "NOT_STARTED") return existing;
      // A legacy NOT_STARTED attempt may have been created before questions were assigned.
      // Fall through and rebuild its assignment from the current test sections.
    }

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          include: {
            questions: { orderBy: { questionOrder: "asc" }, include: { question: true } },
          },
          orderBy: { sectionOrder: "asc" },
        },
      },
    });

    if (!test) throw new Error("Test not found");

    const assigned: any[] = [];
    let orderCounter = 1;

    for (const section of test.sections) {
      let sectionQuestions = section.questions.map((sq) => ({
        sectionId: section.id,
        sectionTitle: section.title,
        questionId: sq.question.id,
        question: sq.question,
        marks: sq.marksOverride ?? sq.question.marks,
      }));

      if (section.pickRandom && section.randomCount) {
        sectionQuestions = shuffleArray(sectionQuestions).slice(0, section.randomCount);
      }

      if (test.shuffleQuestions) {
        sectionQuestions = shuffleArray(sectionQuestions);
      }

      for (const sq of sectionQuestions) {
        let options = sq.question.options as any[] | null;
        let optionOrder: number[] | null = null;

        if (options && Array.isArray(options) && test.shuffleOptions) {
          const indices = options.map((_: any, i: number) => i);
          optionOrder = shuffleArray(indices);
          options = optionOrder.map((i) => {
            const o = options![i];
            // Strip isCorrect before sending to student
            return { id: o.id || String(i), text: o.text };
          });
        } else if (options && Array.isArray(options)) {
          options = options.map((o: any, i: number) => ({
            id: o.id || String(i),
            text: o.text,
          }));
        }

        assigned.push({
          order: orderCounter++,
          sectionId: section.id,
          sectionTitle: section.title,
          questionId: sq.questionId,
          marks: sq.marks,
          optionOrder,
          questionType: sq.question.questionType,
          questionText: sq.question.questionText,
          codeSnippet: sq.question.codeSnippet,
          codeLanguage: sq.question.codeLanguage,
          options,
          language: sq.question.language,
        });
      }
    }

    if (assigned.length === 0) {
      throw new Error("No questions available. Faculty must add questions to Question Bank first.");
    }

    if (existing) {
      return prisma.studentTest.update({
        where: { id: existing.id },
        data: { assignedQuestions: assigned, timeRemainingSec: test.durationMinutes * 60 },
      });
    }

    return prisma.studentTest.create({
      data: {
        testId,
        studentId,
        assignedQuestions: assigned,
        status: "NOT_STARTED",
        timeRemainingSec: test.durationMinutes * 60,
      },
    });
  }
}

export const questionShuffleService = new QuestionShuffleService();
