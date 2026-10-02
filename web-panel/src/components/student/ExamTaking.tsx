import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../../services/api";
import { connectSocket } from "../../services/socket";
import toast from "react-hot-toast";
import { flushPendingAnswers, pendingAnswerCount, saveAnswerOfflineSafe } from "../../services/offlineSync";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
} from "lucide-react";

interface Question {
  order: number;
  questionId: string;
  sectionId: string | null;
  sectionTitle: string;
  questionType: string;
  questionText: string;
  codeSnippet: string | null;
  codeLanguage: string;
  options: { id: string; text: string }[] | null;
  marks?: number;
  selectedOptions: any;
  codeAnswer: string | null;
  textAnswer: string | null;
  isFlagged: boolean;
}

export default function ExamTaking() {
  const { studentTestId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "queued" | "">("");
  const [warningNotice, setWarningNotice] = useState("");
  const [terminalNotice, setTerminalNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const timerRef = useRef<any>(null);
  const heartbeatRef = useRef<any>(null);
  const answersRef = useRef<Record<string, any>>({});

  const current = questions[currentIdx];

  useEffect(() => {
    if (!session?.studentTestId) return;
    const token = localStorage.getItem("examshield_token");
    if (!token) return;
    const socket = connectSocket(token);
    socket.on("warning:received", (event: { message?: string }) => {
      setWarningNotice(event.message || "Your faculty has sent you a warning.");
      toast.error(event.message || "Your faculty has sent you a warning.");
      window.setTimeout(() => setWarningNotice(""), 10000);
    });
    const terminate = (event: { message?: string }) => {
      clearInterval(timerRef.current);
      clearInterval(heartbeatRef.current);
      setSubmitting(true);
      setTerminalNotice(event.message || "Your exam has been submitted.");
    };
    socket.on("exam:terminated", terminate);
    socket.on("exam:force_submitted", terminate);
    return () => socket.close();
  }, [session?.studentTestId]);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = async () => { setOffline(false); await flushPendingAnswers(); setPendingCount(pendingAnswerCount()); };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    setPendingCount(pendingAnswerCount());
    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const res = await api.get(`/exam/session/${studentTestId}`);
      const data = res.data.data;

      if (data.status !== "IN_PROGRESS") {
        toast.error("Exam is not active");
        navigate("/student");
        return;
      }

      setSession(data);
      setQuestions(data.questions);
      setTimeLeft(data.timeRemainingSec || 0);

      // Init answers ref
      data.questions.forEach((q: Question) => {
        answersRef.current[q.questionId] = {
          selectedOptions: q.selectedOptions,
          codeAnswer: q.codeAnswer,
          textAnswer: q.textAnswer,
          isFlagged: q.isFlagged,
        };
      });

      startTimer(data.timeRemainingSec || 0);
      startHeartbeat();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load exam");
      navigate("/student");
    } finally {
      setLoading(false);
    }
  }, [studentTestId, navigate]);

  // Load session once the loader is defined so the effect tracks its dependencies.
  useEffect(() => {
    void loadSession();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [loadSession]);

  const startTimer = (seconds: number) => {
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const startHeartbeat = () => {
    clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (!navigator.onLine) { setOffline(true); return; }
      try {
        await api.get("/health");
        setOffline(false);
        await flushPendingAnswers();
        setPendingCount(pendingAnswerCount());
      } catch { setOffline(true); }
      setTimeLeft((current) => {
        api
          .post(`/exam/session/${studentTestId}/heartbeat`, {
            timeRemainingSec: current,
          })
          .catch(() => setOffline(true));
        return current;
      });
    }, 10000);
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const saveAnswer = useCallback(
    async (questionId: string, patch: any) => {
      answersRef.current[questionId] = {
        ...answersRef.current[questionId],
        ...patch,
      };

      // Update local state
      setQuestions((prev) =>
        prev.map((q) =>
          q.questionId === questionId ? { ...q, ...patch } : q
        )
      );

      setSaveStatus("saving");
      try {
        const q = questions.find((x) => x.questionId === questionId) || current;
        const result = await saveAnswerOfflineSafe(studentTestId!, {
          questionId,
          sectionId: q?.sectionId,
          ...answersRef.current[questionId],
        });
        setSaveStatus(result.queued ? "queued" : "saved");
        setPendingCount(pendingAnswerCount());
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (error: any) {
        setSaveStatus("");
        toast.error(error.response?.data?.message || "Answer could not be saved");
      }
    },
    [studentTestId, questions, current]
  );

  const selectOption = (optionId: string) => {
    if (!current) return;
    const isMulti = current.questionType === "MULTI_SELECT";
    let selected: string[] = Array.isArray(current.selectedOptions)
      ? [...current.selectedOptions]
      : [];

    if (isMulti) {
      if (selected.includes(optionId)) {
        selected = selected.filter((id) => id !== optionId);
      } else {
        selected.push(optionId);
      }
    } else {
      selected = [optionId];
    }

    saveAnswer(current.questionId, { selectedOptions: selected });
  };

  const toggleFlag = () => {
    if (!current) return;
    saveAnswer(current.questionId, { isFlagged: !current.isFlagged });
  };

  const handleSubmit = useCallback(async (reason = "NORMAL") => {
    if (reason === "NORMAL") {
      const unanswered = questions.filter((q) => {
        const a = answersRef.current[q.questionId];
        if (["MCQ", "TRUE_FALSE", "MULTI_SELECT"].includes(q.questionType)) {
          return !a?.selectedOptions || a.selectedOptions.length === 0;
        }
        if (["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING"].includes(q.questionType)) {
          return !a?.codeAnswer || a.codeAnswer.trim() === "";
        }
        return !a?.textAnswer;
      });

      const msg =
        unanswered.length > 0
          ? `You have ${unanswered.length} unanswered question(s). Submit anyway?`
          : "Are you sure you want to submit? You cannot change answers after this.";

      if (!confirm(msg)) return;
    }

    setSubmitting(true);
    clearInterval(timerRef.current);
    clearInterval(heartbeatRef.current);

    try {
      await flushPendingAnswers();
      if (current) {
        const result = await saveAnswerOfflineSafe(studentTestId!, {
          questionId: current.questionId,
          sectionId: current.sectionId,
          ...answersRef.current[current.questionId],
        });
        setPendingCount(pendingAnswerCount());
        if (result.queued) throw new Error("You are offline. Your answer was saved on this device and will sync when connection returns.");
      }
      if (!navigator.onLine || pendingAnswerCount() > 0) throw new Error("Some answers are still waiting to sync. Reconnect before submitting.");

      const res = await api.post(`/exam/session/${studentTestId}/submit`, { reason });
      (window as any).chrome?.webview?.postMessage("exam-submitted");
      toast.success(res.data.data.message || "Submitted!");
      navigate("/student");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Submit failed");
      setSubmitting(false);
      if (timeLeft > 0) startTimer(timeLeft);
      startHeartbeat();
    }
  }, [questions, current, studentTestId, navigate, timeLeft]);

  useEffect(() => {
    if (session?.status === "IN_PROGRESS" && timeLeft === 0 && !offline && !submitting) void handleSubmit("TIME_UP");
  }, [session?.status, timeLeft, offline, submitting, handleSubmit]);

  const getStatusColor = (q: Question) => {
    const a = q;
    const answered =
      (a.selectedOptions && a.selectedOptions.length > 0) ||
      (a.codeAnswer && a.codeAnswer.trim()) ||
      (a.textAnswer && a.textAnswer.trim());

    if (q.isFlagged || a.isFlagged) return "bg-yellow-500 text-black";
    if (answered) return "bg-green-600 text-white";
    return "bg-slate-700 text-gray-300";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p className="text-xl">Loading exam...</p>
      </div>
    );
  }

  if (!session || !current) return null;

  const timeDanger = timeLeft < 300; // < 5 min

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {offline && <div className="bg-yellow-500 px-5 py-2 text-center font-semibold text-slate-950">Connection lost. Answers are being saved on this device until the connection returns.</div>}
      {!offline && pendingCount > 0 && <div className="bg-yellow-600 px-5 py-2 text-center font-semibold text-white">Syncing {pendingCount} saved answer(s)…</div>}
      {warningNotice && <div className="bg-red-700 px-5 py-3 text-center font-semibold text-white shadow-lg">FACULTY WARNING: {warningNotice}</div>}
      {/* Top Bar */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-bold text-lg">{session.test.title}</h1>
          <p className="text-xs text-gray-400">
            {session.test.subject} · Q{current.order}/{session.totalQuestions}
            {current.marks !== undefined && ` · ${current.marks} marks`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {saveStatus && (
            <span className="text-xs text-gray-400">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "queued" ? "Saved offline" : "✓ Saved"}
            </span>
          )}

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
              timeDanger ? "bg-red-600 animate-pulse" : "bg-slate-800"
            }`}
          >
            <Clock size={18} />
            {formatTime(timeLeft)}
          </div>

          {session.violationCount > 0 && (
            <div className="flex items-center gap-1 text-orange-400 text-sm">
              <AlertTriangle size={16} />
              {session.violationCount}/{session.test.maxViolations}
            </div>
          )}

          <button
            onClick={() => handleSubmit("NORMAL")}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold disabled:opacity-50"
          >
            <Send size={16} />
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Question Panel */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Section badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                {current.sectionTitle}
              </span>
              <span className="text-xs bg-slate-800 text-gray-400 px-2 py-1 rounded">
                {current.questionType.replace(/_/g, " ")}
              </span>
              <button
                onClick={toggleFlag}
                className={`ml-auto flex items-center gap-1 text-sm px-3 py-1 rounded ${
                  current.isFlagged
                    ? "bg-yellow-500 text-black"
                    : "bg-slate-800 text-gray-400 hover:text-yellow-400"
                }`}
              >
                <Flag size={14} />
                {current.isFlagged ? "Flagged" : "Flag"}
              </button>
            </div>

            {/* Question Text */}
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 mb-6">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {current.questionText}
              </p>
            </div>

            {/* MCQ Options */}
            {["MCQ", "TRUE_FALSE", "MULTI_SELECT"].includes(current.questionType) &&
              current.options && (
                <div className="space-y-3">
                  {current.options.map((opt, i) => {
                    const selected = Array.isArray(current.selectedOptions)
                      ? current.selectedOptions.includes(opt.id)
                      : false;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectOption(opt.id)}
                        className={`w-full text-left p-4 rounded-xl border transition flex items-start gap-3 ${
                          selected
                            ? "bg-blue-600/30 border-blue-500"
                            : "bg-slate-900 border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            selected ? "bg-blue-500" : "bg-slate-700"
                          }`}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="pt-1">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* Code Editor */}
            {["CODE_WRITING", "CODE_COMPLETION", "ERROR_FINDING"].includes(
              current.questionType
            ) && (
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-800 px-4 py-2 text-sm text-gray-400 flex justify-between">
                  <span>
                    Write your {current.codeLanguage?.toUpperCase() || "code"} solution
                  </span>
                  <span className="text-xs">Auto-saves as you type</span>
                </div>
                <Editor
                  height="400px"
                  theme="vs-dark"
                  language={current.codeLanguage || "java"}
                  value={current.codeAnswer || current.codeSnippet || ""}
                  onChange={(val) => {
                    // Local update immediately
                    setQuestions((prev) =>
                      prev.map((q) =>
                        q.questionId === current.questionId
                          ? { ...q, codeAnswer: val || "" }
                          : q
                      )
                    );
                    answersRef.current[current.questionId] = {
                      ...answersRef.current[current.questionId],
                      codeAnswer: val || "",
                    };
                  }}
                  onMount={(editor) => {
                    // Debounced save on blur / pause
                    let timeout: any;
                    editor.onDidChangeModelContent(() => {
                      clearTimeout(timeout);
                      timeout = setTimeout(() => {
                        saveAnswer(current.questionId, {
                          codeAnswer: editor.getValue(),
                        });
                      }, 1500);
                    });
                  }}
                  options={{
                    fontSize: 15,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            )}

            {/* Short Answer */}
            {current.questionType === "SHORT_ANSWER" && (
              <textarea
                className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your answer..."
                value={current.textAnswer || ""}
                onChange={(e) => {
                  setQuestions((prev) =>
                    prev.map((q) =>
                      q.questionId === current.questionId
                        ? { ...q, textAnswer: e.target.value }
                        : q
                    )
                  );
                  answersRef.current[current.questionId] = {
                    ...answersRef.current[current.questionId],
                    textAnswer: e.target.value,
                  };
                }}
                onBlur={() =>
                  saveAnswer(current.questionId, {
                    textAnswer: answersRef.current[current.questionId]?.textAnswer,
                  })
                }
              />
            )}

            {/* Nav buttons */}
            <div className="flex justify-between mt-8">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-700"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <button
                onClick={() =>
                  setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
                }
                disabled={currentIdx === questions.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-700"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </main>

        {/* Right Navigator */}
        <aside className="w-56 bg-slate-900 border-l border-slate-700 p-4 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Questions ({questions.length})
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => (
              <button
                key={q.questionId}
                onClick={() => setCurrentIdx(i)}
                className={`w-9 h-9 rounded text-xs font-bold transition ${getStatusColor(
                  q
                )} ${i === currentIdx ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""}`}
              >
                {q.order}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-600" /> Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-yellow-500" /> Flagged
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-slate-700" /> Not visited
            </div>
          </div>

          <button
            onClick={() => handleSubmit("NORMAL")}
            disabled={submitting}
            className="w-full mt-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-sm disabled:opacity-50"
          >
            Submit Exam
          </button>
        </aside>
      </div>
      {terminalNotice && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"><div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-red-500/50 bg-slate-900 p-7 text-center shadow-2xl"><AlertTriangle className="mx-auto text-red-400" size={42}/><h2 className="mt-4 text-2xl font-bold">Exam submitted</h2><p className="mt-3 text-slate-300">{terminalNotice}</p><button onClick={() => navigate("/student")} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500">Return to dashboard</button></div></div>}
    </div>
  );
}
