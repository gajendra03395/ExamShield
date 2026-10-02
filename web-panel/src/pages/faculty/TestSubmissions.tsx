import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, Clock3 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

type Submission = { studentTestId: string; student: { name: string; enrollmentNo: string; batch: string; division: string }; status: string; mcqScore: number; codeScore: number; totalScore: number; evaluationStatus: string; violationCount: number };

export default function TestSubmissions() {
  const { testId = "" } = useParams();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/grading/test/${testId}/submissions`).then((response) => setSubmissions(response.data.data)).catch((error) => toast.error(error.response?.data?.message || "Could not load submissions")).finally(() => setLoading(false));
  }, [testId]);
  return <div className="p-6 lg:p-8 text-white"><Link to="/faculty/grading" className="mb-5 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"><ArrowLeft size={16}/>Grading dashboard</Link><h1 className="mb-2 text-3xl font-bold">Submissions</h1><p className="mb-6 text-slate-400">Select a submitted exam to review written and code answers.</p>
    {loading ? <p className="text-slate-400">Loading…</p> : submissions.length === 0 ? <div className="rounded-xl bg-slate-800 p-6 text-slate-400">No submitted exams to evaluate.</div> : <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-900/70 text-xs uppercase text-slate-400"><tr>{["Student", "Batch / Division", "Status", "MCQ", "Code", "Total", "Evaluation", ""].map((title) => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{submissions.map((item) => <tr key={item.studentTestId} className="hover:bg-slate-700/30"><td className="px-4 py-4"><div className="font-medium">{item.student.name}</div><div className="text-xs text-slate-400">{item.student.enrollmentNo}</div></td><td className="px-4 py-4">{item.student.batch} / {item.student.division}</td><td className="px-4 py-4">{item.status.replaceAll("_", " ")}</td><td className="px-4 py-4">{item.mcqScore}</td><td className="px-4 py-4">{item.codeScore}</td><td className="px-4 py-4 font-semibold">{item.totalScore}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-1 text-xs text-amber-200">{item.evaluationStatus === "COMPLETED" ? <CircleCheck size={14}/> : <Clock3 size={14}/>} {item.evaluationStatus}</span></td><td className="px-4 py-4"><Link to={`/faculty/grading/submission/${item.studentTestId}`} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500">Evaluate</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
