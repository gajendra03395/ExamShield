import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, FileText } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { connectSocket } from "../../services/socket";

type Result = { studentTestId: string; status: string; test: { title: string; subject: string; totalMarks: number }; percentage?: number; totalScore?: number; mcqScore?: number; codeScore?: number; evaluationStatus?: string };
const isPassing = (result: Result) => Number(result.percentage) >= 40 && !["TERMINATED", "VIOLATION_SUBMITTED"].includes(result.status);

export default function StudentResults() {
  const [results, setResults] = useState<Result[]>([]);
  useEffect(() => {
    const load = () => api.get("/grading/student/results").then((response) => setResults(response.data.data)).catch((error) => toast.error(error.response?.data?.message || "Could not load results"));
    void load();
    const token = localStorage.getItem("examshield_token");
    if (!token) return;
    const socket = connectSocket(token);
    socket.on("results:published", () => { toast.success("New exam results are available"); void load(); });
    return () => socket.close();
  }, []);
  return <div className="min-h-screen bg-slate-950 p-6 text-white lg:p-10"><div className="mx-auto max-w-5xl"><Link to="/student" className="text-sm text-blue-300 hover:text-blue-200">← Student dashboard</Link><div className="mb-7 mt-4 flex items-end justify-between"><div><p className="text-sm uppercase tracking-widest text-blue-400">Academic record</p><h1 className="mt-1 text-3xl font-bold">My results</h1></div><FileText className="text-blue-300" size={30}/></div>{results.length === 0 ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">Completed exam results will appear here.</div> : <div className="space-y-4">{results.map((result) => <article key={result.studentTestId} className="rounded-xl border border-slate-700 bg-slate-900 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{result.test.title}</h2><p className="mt-1 text-sm text-slate-400">{result.test.subject}</p></div>{result.status === "PENDING_PUBLICATION" ? <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200"><Clock3 size={14}/>Evaluation in Progress ⏳</span> : <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isPassing(result) ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{isPassing(result) ? "PASS" : "FAIL"}</span>}</div>{result.status === "PENDING_PUBLICATION" ? <p className="mt-4 text-sm text-slate-400">Results will be visible once reviewed and published by faculty.</p> : <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-6"><div><p className="text-xs text-slate-500">Final score</p><p className="mt-1 text-xl font-bold">{result.totalScore} / {result.test.totalMarks}</p></div><div><p className="text-xs text-slate-500">Percentage</p><p className="mt-1 text-xl font-bold">{Number(result.percentage).toFixed(1)}%</p></div><div><p className="text-xs text-slate-500">MCQ + Code</p><p className="mt-1 text-sm font-semibold">{result.mcqScore} + {result.codeScore}</p></div></div><Link to={`/student/results/${result.studentTestId}`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">View detailed marksheet<ArrowRight size={15}/></Link></div>}</article>)}</div>}</div></div>;
}
