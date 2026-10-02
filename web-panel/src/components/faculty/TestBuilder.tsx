import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { CalendarClock, Plus, Trash2 } from "lucide-react";

const localDateTimeValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const initialFormTime = Date.now();

export default function TestBuilder() {
  const [tests, setTests] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [questionTest, setQuestionTest] = useState<any>(null);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [batches, setBatches] = useState<string[]>(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
  const [divisions, setDivisions] = useState<string[]>(["A", "B", "C"]);
  const [form, setForm] = useState({
    title: "",
    subject: "Java OOP",
    durationMinutes: 60,
    totalMarks: 100,
    startTime: localDateTimeValue(new Date(initialFormTime)),
    endTime: localDateTimeValue(new Date(initialFormTime + 86400000)),
    targetBatches: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as string[],
    targetDivisions: [] as string[],
    maxViolations: 3,
    enableLockdown: true,
  });

  const fetchTests = useCallback(async () => {
    try {
      const res = await api.get("/tests/faculty");
      setTests(res.data.data);
    } catch {
      toast.error("Failed to load tests");
    }
  }, []);

  useEffect(() => {
    void fetchTests();
    api.get("/auth/options").then(({ data }) => {
      if (Array.isArray(data.batches) && data.batches.length) {
        setBatches(data.batches);
        setForm((current) => ({ ...current, targetBatches: current.targetBatches.filter((batch) => data.batches.includes(batch)).length ? current.targetBatches.filter((batch) => data.batches.includes(batch)) : data.batches }));
      }
      if (Array.isArray(data.divisions) && data.divisions.length) setDivisions(data.divisions);
    }).catch(() => {});
  }, [fetchTests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/tests", { ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() });
      toast.success("Test created as DRAFT!");
      setShowModal(false);
      fetchTests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create test");
    }
  };

  const publishTest = async (id: string) => {
    if (!confirm("Publish this test? Students in target batches will see it.")) return;
    try {
      await api.post(`/tests/${id}/publish`);
      toast.success("Test published!");
      fetchTests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Publish failed");
    }
  };

  const deleteTest = async (id: string) => {
    if (!window.confirm("Delete this draft test? This cannot be undone.")) return;
    try { await api.delete(`/tests/${id}`); setTests((current) => current.filter((test) => test.id !== id)); toast.success("Test deleted"); }
    catch (err: any) { toast.error(err.response?.data?.message || "Test could not be deleted"); }
  };

  const configureQuestions = async (test: any) => {
    try {
      const response = await api.get("/questions");
      setBankQuestions(response.data.data || []);
      setSelectedQuestionIds((test.sections || []).flatMap((section: any) => section.questions.map((item: any) => item.question.id)));
      setQuestionTest(test);
    } catch (err: any) { toast.error(err.response?.data?.message || "Could not load your question bank"); }
  };

  const saveQuestions = async () => {
    if (!questionTest || selectedQuestionIds.length === 0) { toast.error("Select at least one question"); return; }
    setSavingQuestions(true);
    try {
      await api.put(`/tests/${questionTest.id}/questions`, { questionIds: selectedQuestionIds });
      toast.success("Test questions saved; total marks now match the selected questions");
      setQuestionTest(null);
      await fetchTests();
    } catch (err: any) { toast.error(err.response?.data?.message || "Could not save test questions"); }
    finally { setSavingQuestions(false); }
  };

  const toggleBatch = (b: string) => {
    setForm((f) => ({
      ...f,
      targetBatches: f.targetBatches.includes(b)
        ? f.targetBatches.filter((x) => x !== b)
        : [...f.targetBatches, b],
    }));
  };

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <p className="eyebrow">Assessment studio</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Test builder</h1>
          <p className="muted mt-2">Shape the schedule, audience, questions, and live room in one place.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus size={17}/> Create exam
        </button>
      </div>

      <div className="grid gap-4">
        {tests.map((t) => (
          <div
            key={t.id}
            className="glass-panel flex items-center justify-between rounded-2xl p-6"
          >
            <div>
              <h3 className="text-xl font-semibold text-cyan-100">{t.title}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {t.subject} · {t.durationMinutes} mins · {t.totalMarks} Marks · Max{" "}
                {t.maxViolations} violations
              </p>
              <p className="muted mt-2 flex items-center gap-2 text-xs">
                <CalendarClock size={14}/>
                {new Date(t.startTime).toLocaleString()} →{" "}
                {new Date(t.endTime).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                Batches: {(t.targetBatches || []).join(", ")} · Students attempted:{" "}
                {t._count?.studentTests || 0}
              </p>
              <p className="text-xs text-gray-500">
                Divisions: {(t.targetDivisions || []).length ? t.targetDivisions.join(", ") : "All divisions"}
              </p>
            </div>
            <div className="text-right space-y-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  t.status === "PUBLISHED" || t.status === "LIVE"
                    ? "bg-green-900/50 text-green-400"
                    : t.status === "DRAFT"
                    ? "bg-yellow-900/50 text-yellow-500"
                    : "bg-slate-700 text-gray-400"
                }`}
              >
                {t.status}
              </span>
              {t.status === "DRAFT" && (
                <>
                  <button onClick={() => configureQuestions(t)} className="block w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600">{t.sections?.length ? "Edit Questions" : "Choose Questions"}</button>
                  <button onClick={() => publishTest(t.id)} disabled={!t.sections?.some((section: any) => section.questions.length > 0)} className="block w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40">Publish</button>
                  <button onClick={() => void deleteTest(t.id)} className="btn-danger mt-1 w-full"><Trash2 size={15}/>Delete draft</button>
                </>
              )}
              {(t.status === "LIVE" || t.status === "PUBLISHED") && (
                <Link to={`/faculty/tests/${t.id}/monitor`} className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">Live monitor</Link>
              )}
            </div>
          </div>
        ))}
        {tests.length === 0 && (
          <p className="text-gray-500">No tests yet. Create one!</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-xl w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Create New Exam</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input
                type="text"
                placeholder="Exam Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700"
                required
              />

              <input
                type="text"
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full bg-slate-800 p-3 rounded-lg border border-slate-700"
                required
              />

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                  <input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full bg-slate-800 p-2 rounded border border-slate-700"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                  <input
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full bg-slate-800 p-2 rounded border border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Duration (mins)"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: Number(e.target.value) })
                  }
                  className="flex-1 bg-slate-800 p-2 rounded border border-slate-700"
                  required
                />
                <input
                  type="number"
                  placeholder="Total Marks"
                  value={form.totalMarks}
                  onChange={(e) =>
                    setForm({ ...form, totalMarks: Number(e.target.value) })
                  }
                  className="flex-1 bg-slate-800 p-2 rounded border border-slate-700"
                  required
                />
                <input
                  type="number"
                  placeholder="Max Violations"
                  value={form.maxViolations}
                  onChange={(e) =>
                    setForm({ ...form, maxViolations: Number(e.target.value) })
                  }
                  className="flex-1 bg-slate-800 p-2 rounded border border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Target Batches
                </label>
                <div className="flex flex-wrap gap-2">
                  {batches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBatch(b)}
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        form.targetBatches.includes(b)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-gray-400"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-gray-400">Target Divisions (leave empty for all divisions)</label>
                <div className="flex flex-wrap gap-2">{divisions.map((division) => <button key={division} type="button" onClick={() => setForm((current) => ({ ...current, targetDivisions: current.targetDivisions.includes(division) ? current.targetDivisions.filter((item) => item !== division) : [...current.targetDivisions, division] }))} className={`rounded px-3 py-1 text-sm font-semibold ${form.targetDivisions.includes(division) ? "bg-purple-600 text-white" : "bg-slate-800 text-gray-400"}`}>{division}</button>)}</div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
                >
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {questionTest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900"><header className="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 className="text-xl font-bold">Choose questions</h2><p className="text-sm text-slate-400">{questionTest.title}</p></div><button onClick={() => setQuestionTest(null)} className="rounded bg-slate-800 px-3 py-2">Close</button></header><div className="max-h-[65vh] space-y-2 overflow-y-auto p-5">{bankQuestions.map((question) => <label key={question.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4"><input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={(event) => setSelectedQuestionIds((ids) => event.target.checked ? [...ids, question.id] : ids.filter((id) => id !== question.id))} className="mt-1"/><span className="min-w-0 flex-1"><span className="block font-medium">{question.questionText}</span><span className="mt-1 block text-xs text-slate-400">{question.questionType} · {question.marks} mark(s) · {question.subject}</span></span></label>)}{bankQuestions.length === 0 && <p className="p-6 text-center text-slate-400">Your question bank is empty. Add questions before building this exam.</p>}</div><footer className="flex items-center justify-between border-t border-slate-800 p-5"><span>{selectedQuestionIds.length} selected · {bankQuestions.filter((q) => selectedQuestionIds.includes(q.id)).reduce((sum, q) => sum + Number(q.marks), 0)} marks</span><button onClick={saveQuestions} disabled={savingQuestions || selectedQuestionIds.length === 0} className="rounded bg-blue-600 px-5 py-2 font-semibold disabled:opacity-50">{savingQuestions ? "Saving…" : "Save questions"}</button></footer></section></div>}
    </div>
  );
}
