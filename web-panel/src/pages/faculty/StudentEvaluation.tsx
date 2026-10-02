import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { ArrowLeft, ArrowRight, Check, Code2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

type ReviewQuestion = { questionId: string; order?: number; sectionTitle?: string; questionType: string; questionText: string; language?: string | null; codeSnippet?: string | null; solutionCode?: string | null; expectedOutput?: string | null; testCases?: unknown; options?: Array<{ id: string; text: string }>; correctOptions?: Array<{ id: string; text?: string }>; selectedOptions?: string[] | null; codeAnswer?: string | null; textAnswer?: string | null; maxMarks: number; marksObtained: number; isEvaluated: boolean; feedback?: string | null };
type Submission = { studentTestId: string; student: { name: string; email: string; enrollmentNo: string; batch: string; division: string }; test: { id: string; title: string; totalMarks: number }; status: string; evaluationStatus: string; mcqScore: number; codeScore: number; totalScore: number; questions: ReviewQuestion[] };
const manual = (question: ReviewQuestion) => ["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING", "PROBLEM_IDENTIFICATION", "SHORT_ANSWER"].includes(question.questionType);
const monacoLanguage = (language?: string | null) => ({ CPP: "cpp", C: "c", JAVA: "java", PYTHON: "python" }[String(language || "java").toUpperCase()] || String(language || "java").toLowerCase());

export default function StudentEvaluation() {
  const { studentTestId = "" } = useParams();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const questions = useMemo(() => submission?.questions.filter(manual) || [], [submission]);
  const current = questions[index];

  useEffect(() => { api.get(`/grading/submission/${studentTestId}`).then((response) => setSubmission(response.data.data)).catch((error) => toast.error(error.response?.data?.message || "Could not load answer sheet")).finally(() => setLoading(false)); }, [studentTestId]);
  useEffect(() => { setMarks(current?.marksObtained || 0); setFeedback(current?.feedback || ""); }, [current?.questionId, current?.marksObtained, current?.feedback]);

  const save = async () => {
    if (!current || !submission) return;
    setSaving(true);
    try {
      const response = await api.post(`/grading/submission/${studentTestId}/grade-question`, { questionId: current.questionId, marksObtained: Number(marks), feedback });
      setSubmission({ ...submission, ...response.data.data, questions: submission.questions.map((question) => question.questionId === current.questionId ? { ...question, marksObtained: Number(marks), isEvaluated: true, feedback } : question) });
      toast.success("Grade saved");
      if (index < questions.length - 1) setIndex(index + 1);
    } catch (error: any) { toast.error(error.response?.data?.message || "Could not save grade"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-300">Loading answer sheet…</div>;
  if (!submission) return <div className="p-8 text-red-300">Submission could not be loaded.</div>;

  return <div className="min-h-full p-5 text-white lg:p-8">
    <Link to={`/faculty/grading/test/${submission.test.id}/submissions`} className="mb-5 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"><ArrowLeft size={16}/>Back to submissions</Link>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm uppercase tracking-widest text-blue-400">{submission.test.title}</p><h1 className="mt-1 text-2xl font-bold">{submission.student.name}</h1><p className="mt-1 text-sm text-slate-400">{submission.student.enrollmentNo} · {submission.student.batch} / {submission.student.division} · {submission.status}</p></div><div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3"><p className="text-xs text-slate-400">Current score</p><p className="text-xl font-bold">{submission.totalScore} / {submission.test.totalMarks}<span className="ml-2 text-sm font-normal text-slate-400">(MCQ {submission.mcqScore} + Code {submission.codeScore})</span></p></div></header>
    {questions.length === 0 ? <div className="rounded-xl bg-slate-800 p-6 text-slate-300">This submission has no manually graded questions.</div> : <>
      <nav className="mb-4 flex gap-2 overflow-x-auto pb-2">{questions.map((question, i) => <button key={question.questionId} onClick={() => setIndex(i)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === index ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}><span>Q{question.order ?? i + 1}</span>{question.isEvaluated && <Check size={14}/>}</button>)}</nav>
      {current && <div className="grid gap-4 xl:grid-cols-2"><section className="space-y-4"><article className="rounded-xl border border-slate-700 bg-slate-800 p-5"><p className="mb-2 text-xs uppercase text-blue-300">{current.sectionTitle || "General"} · {current.questionType.replaceAll("_", " ")}</p><h2 className="text-lg font-semibold">{current.questionText}</h2><p className="mt-3 text-sm text-slate-400">Maximum marks: {current.maxMarks}</p>{current.expectedOutput && <div className="mt-4"><h3 className="text-xs font-semibold uppercase text-slate-400">Expected output</h3><pre className="mt-2 whitespace-pre-wrap rounded bg-slate-950 p-3 text-sm text-slate-200">{current.expectedOutput}</pre></div>}{Boolean(current.testCases) && <div className="mt-4"><h3 className="text-xs font-semibold uppercase text-slate-400">Sample test cases</h3><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(current.testCases, null, 2)}</pre></div>}{current.solutionCode && <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold uppercase text-emerald-300">View expected solution</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs">{current.solutionCode}</pre></details>}</article>
        <article className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"><div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3 text-sm text-slate-300"><Code2 size={16}/>Student answer</div>{current.codeAnswer != null ? <Editor height="360px" theme="vs-dark" language={monacoLanguage(current.language)} value={current.codeAnswer} options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, fontSize: 14 }} /> : <pre className="min-h-48 whitespace-pre-wrap p-4 text-sm text-slate-200">{current.textAnswer || "No answer submitted."}</pre>}</article></section>
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Grading</h2><span className="text-sm text-slate-400">Question {index + 1} of {questions.length}</span></div><label className="mb-2 block text-sm text-slate-300">Marks awarded (maximum {current.maxMarks})</label><input type="number" min="0" max={current.maxMarks} step="0.25" value={marks} onChange={(event) => setMarks(Math.min(current.maxMarks, Math.max(0, Number(event.target.value))))} className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-lg font-semibold outline-none focus:border-blue-500"/><div className="mt-3 flex gap-2"><button onClick={() => setMarks(current.maxMarks)} className="rounded bg-emerald-700/80 px-3 py-1.5 text-xs hover:bg-emerald-600">Full marks</button><button onClick={() => setMarks(current.maxMarks / 2)} className="rounded bg-amber-700/80 px-3 py-1.5 text-xs hover:bg-amber-600">Half marks</button><button onClick={() => setMarks(0)} className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600">Zero</button></div><label className="mb-2 mt-6 block text-sm text-slate-300">Faculty feedback</label><textarea rows={6} maxLength={5000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Add notes for the student…" className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500"/><div className="mt-5 flex justify-between gap-2"><button disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm disabled:opacity-40">Previous</button><button disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">{saving ? "Saving…" : index === questions.length - 1 ? "Save grade" : "Save & next"}<ArrowRight size={15}/></button></div></section></div>}
    </>}
  </div>;
}
