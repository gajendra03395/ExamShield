import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, BarChart3, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

type Test = { id: string; title: string; subject: string; resultsPublished?: boolean; status: string };
type Summary = { test: Test; attempts: number; completed: number; evaluationPercent: number };

async function download(testId: string, format: "excel" | "csv", name: string) {
  try {
    const response = await api.get(`/grading/test/${testId}/export/${format}`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name.replace(/[^a-z0-9_-]/gi, "-")}-results.${format === "excel" ? "xlsx" : "csv"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error(`Could not export ${format.toUpperCase()}`);
  }
}

export default function GradingDashboard() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const response = await api.get("/tests/faculty");
      const tests: Test[] = response.data.data;
      const data = await Promise.all(tests.map(async (test) => {
        try {
          const submissions = await api.get(`/grading/test/${test.id}/submissions`);
          const attempts = submissions.data.data as Array<{ evaluationStatus: string }>;
          return { test, attempts: attempts.length, completed: attempts.filter((item) => item.evaluationStatus === "COMPLETED").length,
            evaluationPercent: attempts.length ? attempts.filter((item) => item.evaluationStatus === "COMPLETED").length / attempts.length * 100 : 0 };
        } catch { return { test, attempts: 0, completed: 0, evaluationPercent: 0 }; }
      }));
      setSummaries(data);
    } catch {
      toast.error("Could not load tests for grading");
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const togglePublish = async (summary: Summary) => {
    const publish = !summary.test.resultsPublished;
    if (publish && !window.confirm(`Publish results for “${summary.test.title}” to students?`)) return;
    try {
      await api.post(`/grading/test/${summary.test.id}/publish-results`, { publish });
      toast.success(publish ? "Results published to students" : "Results unpublished");
      await refresh();
    } catch (error: any) { toast.error(error.response?.data?.message || "Could not change result publication"); }
  };

  return <div className="p-6 lg:p-8 text-white">
    <div className="mb-7"><p className="text-sm uppercase tracking-widest text-blue-400">Evaluation workspace</p><h1 className="mt-1 text-3xl font-bold">Grading & Results</h1><p className="mt-2 text-slate-400">Review submissions, publish marks and export administrative reports.</p></div>
    {loading ? <p className="text-slate-400">Loading tests…</p> : summaries.length === 0 ? <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-slate-400">No tests are available yet.</div> : <div className="grid gap-4">{summaries.map((item) => <article key={item.test.id} className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{item.test.title}</h2><p className="mt-1 text-sm text-slate-400">{item.test.subject} · {item.attempts} submissions · {item.completed} fully evaluated</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.test.resultsPublished ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>{item.test.resultsPublished ? "Published" : "Unpublished"}</span></div>
      <div className="mt-5"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>Evaluation progress</span><span>{Math.round(item.evaluationPercent)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${item.evaluationPercent}%` }} /></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><Link to={`/faculty/grading/test/${item.test.id}/submissions`} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500"><Users size={16}/>Evaluate submissions</Link><Link to={`/faculty/grading/test/${item.test.id}/analytics`} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"><BarChart3 size={16}/>Analytics & charts</Link><button onClick={() => void download(item.test.id, "excel", item.test.title)} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"><FileSpreadsheet size={16}/>Excel</button><button onClick={() => void download(item.test.id, "csv", item.test.title)} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"><FileText size={16}/>CSV</button><button onClick={() => void togglePublish(item)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${item.test.resultsPublished ? "bg-amber-700 hover:bg-amber-600" : "bg-emerald-700 hover:bg-emerald-600"}`}><Download size={16}/>{item.test.resultsPublished ? "Unpublish results" : "Publish results"}</button></div>
    </article>)}</div>}
  </div>;
}
