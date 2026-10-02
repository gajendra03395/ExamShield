import { Request, Response } from "express";
import { questionService } from "../services/question.service";
import prisma from "../config/database";

export class QuestionController {
  async create(req: Request, res: Response) {
    try {
      const question = await questionService.createQuestion(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: question });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyQuestions(req: Request, res: Response) {
    try {
      const questions = await questionService.getQuestionsByFaculty(req.user!.userId, req.user!.role === "ADMIN");
      res.json({ success: true, data: questions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const question = await prisma.question.findFirst({ where: { id: req.params.id, ...(req.user!.role === "ADMIN" ? {} : { facultyId: req.user!.userId }), isActive: true }, select: { id: true } });
      if (!question) return res.status(404).json({ success: false, message: "Question not found" });
      const usage = await prisma.sectionQuestion.count({ where: { questionId: question.id } });
      if (usage > 0) return res.status(409).json({ success: false, message: "Remove this question from draft tests before deleting it" });
      await prisma.question.delete({ where: { id: question.id } });
      return res.json({ success: true, message: "Question deleted" });
    } catch {
      return res.status(500).json({ success: false, message: "Could not delete question" });
    }
  }
}
export const questionController = new QuestionController();
