import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Camera, Send, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { connectSocket } from "../../services/socket";

type Violation = {
  id?: string;
  violationType: string;
  description?: string | null;
  screenshotUrl?: string | null;
  createdAt: string;
  violationNumber?: number;
};
type Attempt = {
  studentTestId: string;
  studentName: string;
  enrollmentNo: string;
  batch: string;
  division: string;
  status: string;
  submissionReason?: string | null;
  score: number | null;
  violationCount: number;
  maxViolations: number;
  startTime: string | null;
  violations: Violation[];
};
type FeedItem = Violation & { studentTestId: string; studentName: string; enrollmentNo: string; count?: number; maxViolations?: number; timestamp?: string };

export default function LiveMonitor() {
  const { testId = "" } = useParams();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [evidence, setEvidence] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get(`/tests/${testId}/live-monitor`);
      const rows: Attempt[] = response.data.data;
      setAttempts(rows);
      setFeed(rows.flatMap((row) => row.violations.map((violation) => ({
        ...violation, studentTestId: row.studentTestId, studentName: row.studentName,
        enrollmentNo: row.enrollmentNo, maxViolations: row.maxViolations,
      }))).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to load live monitor");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    const token = localStorage.getItem("examshield_token");
    if (!token) return () => window.clearInterval(timer);
    const socket = connectSocket(token);
    socket.on("connect", () => socket.emit("join-test", testId));
    socket.on("violation:new", (item: FeedItem) => {
      const normalized = { ...item, createdAt: item.timestamp || new Date().toISOString() } as FeedItem;
      setFeed((current) => [normalized, ...current].slice(0, 100));
      void refresh();
    });
    return () => {
      window.clearInterval(timer);
      socket.close();
    };
  }, [refresh, testId]);

  const stats = useMemo(() => ({
    active: attempts.filter((x) => x.status === "IN_PROGRESS").length,
    normal: attempts.filter((x) => x.status === "IN_PROGRESS" && x.violationCount === 0).length,
    warning: attempts.filter((x) => x.status === "IN_PROGRESS" && x.violationCount > 0 && x.violationCount < x.maxViolations).length,
    ended: attempts.filter((x) => ["TERMINATED", "SUBMITTED", "AUTO_SUBMITTED", "VIOLATION_SUBMITTED"].includes(x.status)).length,
  }), [attempts]);

  const sendWarning = async (attempt: Attempt) => {
    const message = window.prompt(`Warning message for ${attempt.studentName}:`);
    if (!message?.trim()) return;
    try {
      await api.post("/exam/send-warning", { studentTestId: attempt.studentTestId, message });
      toast.success("Warning sent");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not send warning");
    }
  };

  const forceSubmit = async (attempt: Attempt) => {
    if (!window.confirm(`Force submit ${attempt.studentName}'s exam?`)) return;
    try {
      await api.post("/exam/force-submit", { studentTestId: attempt.studentTestId });
      toast.success("Exam submitted");
      await refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not submit exam");
    }
  };

  const reopenAttempt = async (attempt: Attempt) => {
    if (!window.confirm(`Allow ${attempt.studentName} to continue this exam from where it stopped?`)) return;
    try {
      await api.post(`/grading/submission/${attempt.studentTestId}/reopen`);
      toast.success("Exam reopened. The student can refresh the kiosk and continue.");
      await refresh();
    } catch (error: any) { toast.error(error.response?.data?.message || "Could not reopen exam"); }
  };

  const statusClass = (attempt: Attempt) => {
    if (["TERMINATED", "VIOLATION_SUBMITTED", "AUTO_SUBMITTED", "SUBMITTED"].includes(attempt.status)) return "bg-red-500/15 text-red-300";
    if (attempt.violationCount > 0) return "bg-yellow-500/15 text-yellow-200";
    return "bg-emerald-500/15 text-emerald-200";
  };

  return (
    <div className="min-h-full p-6 lg:p-8 text-white">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm uppercase tracking-widest text-blue-400">Faculty control room</p><h1 className="mt-1 text-3xl font-bold">Live exam monitor</h1><p className="mt-1 text-sm text-slate-400">Test {testId}</p></div>
        <button onClick={() => void refresh()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">Refresh</button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Students active", count: stats.active, color: "text-blue-300" }, { label: "Normal", count: stats.normal, color: "text-emerald-300" }, { label: "Warning state", count: stats.warning, color: "text-yellow-200" }, { label: "Ended", count: stats.ended, color: "text-red-300" }].map(({ label, count, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4"><p className="text-sm text-slate-400">{label}</p><p className={`mt-1 text-3xl font-bold ${color}`}>{count}</p></div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <div className="border-b border-slate-700 px-5 py-4"><h2 className="font-semibold">Student attempts</h2></div>
          {loading ? <p className="p-6 text-slate-400">Loading attempts…</p> : attempts.length === 0 ? <p className="p-6 text-slate-400">No active or completed attempts yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-900/70 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Batch / Division</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Violations</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-700">{attempts.map((attempt) => (
              <tr key={attempt.studentTestId} className="hover:bg-slate-700/30"><td className="px-4 py-4"><div className="font-medium">{attempt.studentName}</div><div className="text-xs text-slate-400">{attempt.enrollmentNo}</div></td><td className="px-4 py-4 text-slate-300">{attempt.batch} / {attempt.division}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(attempt)}`}>{attempt.status.replaceAll("_", " ")}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${attempt.violationCount ? "bg-yellow-500/20 text-yellow-100" : "bg-emerald-500/15 text-emerald-200"}`}>{attempt.violationCount}/{attempt.maxViolations}</span></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button onClick={() => setSelected(attempt)} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">Evidence logs</button><button disabled={attempt.status !== "IN_PROGRESS"} onClick={() => void sendWarning(attempt)} title="Send warning" className="rounded bg-yellow-600/80 p-1.5 hover:bg-yellow-500 disabled:opacity-40"><Send size={14}/></button><button disabled={attempt.status !== "IN_PROGRESS"} onClick={() => void forceSubmit(attempt)} title="Force submit" className="rounded bg-red-600/80 p-1.5 hover:bg-red-500 disabled:opacity-40"><ShieldAlert size={14}/></button>{attempt.submissionReason === "VIOLATION_LIMIT" && ["VIOLATION_SUBMITTED", "TERMINATED", "AUTO_SUBMITTED"].includes(attempt.status) && <button onClick={() => void reopenAttempt(attempt)} className="rounded bg-cyan-700/80 px-2 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-600">Reopen attempt</button>}</div></td></tr>
            ))}</tbody></table></div>
          )}
        </section>

        <aside className="max-h-[680px] overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4"><h2 className="font-semibold">Violation feed</h2><span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">LIVE</span></div>
          <div className="max-h-[620px] space-y-3 overflow-y-auto p-3">{feed.length === 0 ? <p className="p-3 text-sm text-slate-400">No violations recorded.</p> : feed.map((item, i) => <button key={`${item.studentTestId}-${item.id || item.createdAt}-${i}`} onClick={() => setEvidence(item)} className="w-full rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-left transition hover:border-red-500/50 hover:bg-red-500/5"><div className="flex items-center gap-2"><AlertTriangle size={15} className="shrink-0 text-amber-300"/><span className="font-semibold text-red-200">{item.violationType.replaceAll("_", " ")}</span>{item.screenshotUrl && <Camera size={14} className="ml-auto text-blue-300"/>}</div><p className="mt-1 text-sm text-white">{item.studentName} <span className="text-slate-400">({item.enrollmentNo})</span></p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p><p className="mt-2 text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></button>)}</div>
        </aside>
      </div>

      {(selected || evidence) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setSelected(null); setEvidence(null); }}><div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{evidence ? "Violation evidence" : `Evidence logs · ${selected?.studentName}`}</h3><button onClick={() => { setSelected(null); setEvidence(null); }} className="text-slate-400 hover:text-white">Close</button></div>{(evidence ? [evidence] : selected?.violations || []).map((item, i) => <div key={item.id || `${item.createdAt}-${i}`} className="mb-4 rounded-lg border border-slate-700 p-4"><p className="font-semibold text-amber-200">{item.violationType.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-300">{item.description || "No details"}</p><p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>{item.screenshotUrl && <img src={item.screenshotUrl} alt="Captured desktop evidence" className="mt-3 max-h-[50vh] w-full rounded border border-slate-700 object-contain"/>}{!item.screenshotUrl && <p className="mt-3 text-xs text-slate-500">No screenshot attached.</p>}</div>)}{!evidence && !selected?.violations.length && <p className="text-sm text-slate-400">No evidence logs for this attempt.</p>}</div></div>}
    </div>
  );
}
