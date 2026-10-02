import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import { Clock, BookOpen, AlertTriangle, CheckCircle, FileText, LogOut } from "lucide-react";
import ThemeToggle from "../ThemeToggle";

export default function StudentDashboard() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const { user, logout } = useAuthStore();

  const loadTests = useCallback(async () => {
    try {
      const res = await api.get("/exam/available");
      setTests(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load tests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTests(); }, [loadTests]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);

  return (
    <div className="app-shell min-h-screen text-white">
      <header className="glass-panel flex items-center justify-between border-x-0 border-t-0 px-5 py-4 sm:px-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🛡️ ExamShield</h1>
          <p className="eyebrow">Student workspace</p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle/><Link to="/student/results" className="btn-secondary"><FileText size={16}/><span className="hidden sm:inline">My results</span></Link>
          <div className="text-right">
            <p className="font-semibold">{user?.name}</p>
            <p className="text-xs text-gray-400">
              {user?.enrollmentNo} · Batch {user?.batch} · Div {user?.division}
            </p>
          </div>
          <button
            onClick={logout}
            className="btn-secondary text-rose-200"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-5 sm:p-10">
        <div className="mb-7"><p className="eyebrow">Assessment schedule</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Available exams</h2><p className="muted mt-2">Your kiosk is used to start an exam and keep the session secure.</p></div>

        {loading && <p className="text-gray-400">Loading...</p>}

        {!loading && tests.length === 0 && (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <BookOpen className="mx-auto mb-4 text-gray-500" size={48} />
            <p className="text-gray-400 text-lg">No exams available right now</p>
            <p className="text-gray-500 text-sm mt-2">
              Check back when your faculty publishes a test for Batch {user?.batch}
            </p>
          </div>
        )}

        <div className="grid gap-4">
          {tests.map((t) => (
            <div
              key={t.id}
              className="glass-panel rounded-3xl p-6 transition hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-blue-300">{t.title}</h3>
                  <p className="text-gray-400 text-sm mt-1">
                    {t.subject} · by {t.facultyName}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> {t.durationMinutes} mins
                    </span>
                    <span>{t.totalMarks} Marks</span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={14} /> Max {t.maxViolations} violations
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Window: {new Date(t.startTime).toLocaleString()} →{" "}
                    {new Date(t.endTime).toLocaleString()}
                  </p>
                </div>

                <div className="text-right space-y-2">
                  {t.myAttempt?.status === "SUBMITTED" ||
                  t.myAttempt?.status === "AUTO_SUBMITTED" ||
                  t.myAttempt?.status === "VIOLATION_SUBMITTED" ||
                  t.myAttempt?.status === "TERMINATED" ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={18} />
                      <span className="text-sm font-semibold">Submitted</span>
                    </div>
                  ) : t.myAttempt?.status === "IN_PROGRESS" ? (
                    <span className="max-w-48 text-right text-xs text-yellow-300">Resume in the ExamShield desktop kiosk</span>
                  ) : t.canStart ? (
                    <span className="max-w-48 text-right text-xs text-blue-300">Start in the ExamShield desktop kiosk</span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      {now < Date.parse(t.startTime) ? "Not started yet" : "Window closed"}
                    </span>
                  )}

                  {t.enableLockdown && (
                    <p className="text-xs text-orange-400">🔒 Lockdown enabled</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
