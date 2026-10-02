import prisma from "../config/database";

export class QuestionService {
  async createQuestion(facultyId: string, data: any) {
    const questionTypes = ["MCQ", "MULTI_SELECT", "TRUE_FALSE", "CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING", "PROBLEM_IDENTIFICATION", "SHORT_ANSWER"];
    const difficulties = ["EASY", "MEDIUM", "HARD"];
    const languages = ["JAVA", "CPP", "PYTHON", "C", "NONE"];
    const questionType = typeof data.questionType === "string" ? data.questionType : "";
    const questionText = typeof data.questionText === "string" ? data.questionText.trim() : "";
    const subject = typeof data.subject === "string" ? data.subject.trim() : "";
    const marks = Number(data.marks ?? 1);
    if (!questionTypes.includes(questionType) || !questionText || questionText.length > 20000 || !subject || subject.length > 120) throw new Error("Question type, question text (maximum 20,000 characters) and subject (maximum 120 characters) are required");
    if (!Number.isFinite(marks) || marks <= 0 || marks > 10000) throw new Error("Question marks must be greater than zero and at most 10000");
    const difficulty = data.difficulty ?? "MEDIUM";
    const language = data.language ?? "NONE";
    if (!difficulties.includes(difficulty)) throw new Error("Invalid difficulty");
    if (!languages.includes(language)) throw new Error("Invalid programming language");
    let options = data.options;
    if (["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(questionType)) {
      if (!Array.isArray(options) || options.length < 2 || options.length > 12 || options.some((option: any) => !option || typeof option.text !== "string" || !option.text.trim() || option.text.length > 1000 || typeof option.isCorrect !== "boolean")) throw new Error("Choice questions require 2-12 valid answer options");
      const correctCount = options.filter((option: any) => option.isCorrect).length;
      if (correctCount < 1 || (questionType !== "MULTI_SELECT" && correctCount !== 1)) throw new Error("Select the correct answer option(s)");
      if (questionType === "TRUE_FALSE" && options.length !== 2) throw new Error("True / False questions require exactly two options");
      const optionIds = options.map((option: any, index: number) => typeof option.id === "string" && option.id ? option.id : `option-${index + 1}`);
      if (new Set(optionIds).size !== optionIds.length) throw new Error("Answer options must have unique IDs");
      options = options.map((option: any, index: number) => ({ id: typeof option.id === "string" && option.id ? option.id.slice(0, 64) : `option-${index + 1}`, text: option.text.trim(), isCorrect: option.isCorrect }));
    } else options = undefined;
    return prisma.question.create({
      data: {
        facultyId,
        questionType: questionType as any,
        difficulty: difficulty as any,
        language: language as any,
        subject,
        topic: data.topic,
        questionText,
        codeSnippet: data.codeSnippet,
        codeLanguage: data.codeLanguage,
        options,
        expectedOutput: data.expectedOutput,
        testCases: data.testCases,
        solutionCode: data.solutionCode,
        marks,
        explanation: data.explanation
      }
    });
  }

  async getQuestionsByFaculty(facultyId: string, isAdmin = false) {
    return prisma.question.findMany({
      where: isAdmin ? { isActive: true } : { facultyId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}
export const questionService = new QuestionService();
