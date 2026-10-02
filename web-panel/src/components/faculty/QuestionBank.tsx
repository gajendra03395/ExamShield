import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

export default function QuestionBank() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    subject: "Java OOP", questionType: "MCQ", questionText: "", marks: 1, codeSnippet: "", codeLanguage: "java",
    options: [{ id: "option-1", text: "", isCorrect: false }, { id: "option-2", text: "", isCorrect: false }],
  });

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await api.get("/questions");
      setQuestions(res.data.data);
    } catch {
      toast.error("Failed to fetch questions");
    }
  }, []);

  useEffect(() => { void fetchQuestions(); }, [fetchQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const choiceQuestion = ["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(form.questionType);
      await api.post("/questions", { ...form, options: choiceQuestion ? form.options : undefined });
      toast.success("Question added!");
      setShowModal(false);
      setForm({ ...form, questionText: "", codeSnippet: "" });
      fetchQuestions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to add question");
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    try { await api.delete(`/questions/${id}`); setQuestions((current: any[]) => current.filter((question) => question.id !== id)); toast.success("Question deleted"); }
    catch (err: any) { toast.error(err.response?.data?.message || "Question could not be deleted"); }
  };

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Content studio</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Question bank</h1>
          <p className="muted mt-2">Write, review, and curate the questions your assessments use.</p>
        </div>
        <div className="flex gap-2"><button onClick={() => void fetchQuestions()} className="btn-secondary"><RefreshCw size={16}/>Refresh</button><button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={17}/>Add question</button></div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="glass-panel rounded-2xl p-4"><p className="muted text-xs uppercase tracking-wider">Total questions</p><p className="mt-2 text-2xl font-semibold">{questions.length}</p></div><div className="glass-panel rounded-2xl p-4"><p className="muted text-xs uppercase tracking-wider">Choice based</p><p className="mt-2 text-2xl font-semibold">{questions.filter((q: any) => ["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(q.questionType)).length}</p></div><div className="glass-panel rounded-2xl p-4"><p className="muted text-xs uppercase tracking-wider">Total marks</p><p className="mt-2 text-2xl font-semibold">{questions.reduce((sum: number, q: any) => sum + Number(q.marks || 0), 0)}</p></div></div>
      <div className="grid gap-4">
        {questions.map((q: any) => (
          <div key={q.id} className="glass-panel rounded-2xl p-5 transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-cyan-300/12 px-2.5 py-1 text-xs font-bold text-cyan-200">{q.questionType}</span><span className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-slate-400">{q.subject}</span></div>
              <div className="flex items-center gap-3"><span className="text-sm text-slate-400">{q.marks} marks</span><button onClick={() => void deleteQuestion(q.id)} className="btn-danger" title="Delete question"><Trash2 size={15}/><span className="hidden sm:inline">Delete</span></button></div>
            </div>
            <p className="mt-4 max-w-4xl font-medium leading-7 text-slate-100">{q.questionText}</p>
          </div>
        ))}
        {questions.length === 0 && <p className="text-gray-500">No questions found. Add one!</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl w-full max-w-3xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Create New Question</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex gap-4">
                <select className="flex-1 bg-slate-800 p-2 rounded border border-slate-700" value={form.questionType} onChange={(e) => setForm({...form, questionType: e.target.value, ...(e.target.value === "TRUE_FALSE" ? { options: [{ id: "option-1", text: "True", isCorrect: false }, { id: "option-2", text: "False", isCorrect: false }] } : {})})}>
                  <option value="MCQ">Multiple Choice</option>
                  <option value="MULTI_SELECT">Select Multiple</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="CODE_WRITING">Write Code</option>
                  <option value="CODE_COMPLETION">Complete Code</option>
                  <option value="ERROR_FINDING">Find Errors</option>
                  <option value="PROBLEM_IDENTIFICATION">Identify Problem</option>
                  <option value="SHORT_ANSWER">Short Answer</option>
                </select>
                <input type="number" placeholder="Marks" value={form.marks} onChange={(e) => setForm({...form, marks: Number(e.target.value)})} className="w-24 bg-slate-800 p-2 rounded border border-slate-700" required />
              </div>

              <textarea placeholder="Question Text" value={form.questionText} onChange={(e) => setForm({...form, questionText: e.target.value})} className="w-full bg-slate-800 p-2 rounded border border-slate-700 h-24" required />

              {["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(form.questionType) && <fieldset className="space-y-2 rounded-lg border border-slate-700 p-4"><legend className="px-2 text-sm font-semibold">Answer choices · select the correct option(s)</legend>{form.options.map((option, index) => <div key={option.id} className="flex items-center gap-3"><input aria-label={`Option ${index + 1} is correct`} type={form.questionType === "MULTI_SELECT" ? "checkbox" : "radio"} name="correct-option" checked={option.isCorrect} onChange={(event) => setForm((previous) => ({ ...previous, options: previous.options.map((item, itemIndex) => ({ ...item, isCorrect: form.questionType === "MULTI_SELECT" ? itemIndex === index ? event.target.checked : item.isCorrect : itemIndex === index })) }))}/><input value={option.text} onChange={(event) => setForm((previous) => ({ ...previous, options: previous.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) }))} placeholder={`Option ${index + 1}`} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800 p-2" required/><button type="button" disabled={form.options.length <= 2 || form.questionType === "TRUE_FALSE"} onClick={() => setForm((previous) => ({ ...previous, options: previous.options.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded bg-slate-800 px-3 py-2 disabled:opacity-40">Remove</button></div>)}{form.options.length < 12 && form.questionType !== "TRUE_FALSE" && <button type="button" onClick={() => setForm((previous) => ({ ...previous, options: [...previous.options, { id: `option-${Date.now()}`, text: "", isCorrect: false }] }))} className="rounded bg-slate-700 px-3 py-2 text-sm">Add option</button>}</fieldset>}

              {(["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING"].includes(form.questionType)) && (
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 px-4 py-2 flex justify-between items-center text-sm text-gray-400">
                    <span>Initial Code Snippet (Optional)</span>
                    <select className="bg-slate-700 rounded px-2" value={form.codeLanguage} onChange={(e) => setForm({...form, codeLanguage: e.target.value})}>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <Editor height="200px" theme="vs-dark" language={form.codeLanguage} value={form.codeSnippet} onChange={(val) => setForm({...form, codeSnippet: val || ""})} />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="bg-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-700">Save Question</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
