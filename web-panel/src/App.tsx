import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { BookOpen, ClipboardCheck, FilePlus } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import Login from "./components/auth/Login";
import FacultyLayout from "./components/faculty/FacultyLayout";
import QuestionBank from "./components/faculty/QuestionBank";
import TestBuilder from "./components/faculty/TestBuilder";
import StudentDashboard from "./components/student/StudentDashboard";
import ExamTaking from "./components/student/ExamTaking";
import LiveMonitor from "./components/faculty/LiveMonitor";
import GradingDashboard from "./pages/faculty/GradingDashboard";
import TestSubmissions from "./pages/faculty/TestSubmissions";
import StudentEvaluation from "./pages/faculty/StudentEvaluation";
import TestAnalytics from "./pages/faculty/TestAnalytics";
import StudentResults from "./pages/student/StudentResults";
import DetailedMarksheet from "./pages/student/DetailedMarksheet";
import AdminPanel from "./pages/admin/AdminPanel";

function initializeAuth() {
  const auth = useAuthStore.getState();
  const token = new URLSearchParams(window.location.search).get("token");
  const embeddedExam = new URLSearchParams(window.location.search).get("embedded") === "1";
  if (token) {
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(payload));
      if (["ADMIN", "FACULTY", "STUDENT"].includes(claims.role) && (claims.id || claims.userId)) {
        if (embeddedExam && claims.role === "STUDENT") sessionStorage.setItem("examshield_embedded_exam", "1");
        auth.login({ id: claims.id || claims.userId, name: claims.name || "Student", email: claims.email || "", role: claims.role }, token);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("token");
        cleanUrl.searchParams.delete("embedded");
        window.history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        return;
      }
    } catch { /* Use any existing web session if the embedded token is malformed. */ }
  }
  auth.loadFromStorage();
}

function EmbeddedExamRoute({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem("examshield_embedded_exam") !== "1") return <Navigate to="/student" replace />;
  return <ProtectedRoute allowedRoles={["STUDENT"]}>{children}</ProtectedRoute>;
}

initializeAuth();

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Navigate to="/faculty/administration" replace />} />

        {/* Faculty */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={["FACULTY", "ADMIN"]}>
              <FacultyLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <div className="mx-auto max-w-7xl p-5 sm:p-10">
                <p className="eyebrow">Workspace overview</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Good to see you.</h1>
                <p className="text-gray-400 mt-2">
                  Welcome to Faculty Portal — use the sidebar to manage questions and tests.
                </p><div className="mt-10 grid gap-5 md:grid-cols-3"><Link className="glass-panel rounded-3xl p-6 transition hover:-translate-y-1" to="/faculty/questions"><BookOpen size={22} className="text-cyan-200"/><h2 className="mt-8 text-xl font-semibold">Question bank</h2><p className="muted mt-2 text-sm leading-6">Create and maintain a trusted pool of questions.</p></Link><Link className="glass-panel rounded-3xl p-6 transition hover:-translate-y-1" to="/faculty/tests"><FilePlus size={22} className="text-cyan-200"/><h2 className="mt-8 text-xl font-semibold">Test builder</h2><p className="muted mt-2 text-sm leading-6">Set the audience, timing, and assessment structure.</p></Link><Link className="glass-panel rounded-3xl p-6 transition hover:-translate-y-1" to="/faculty/grading"><ClipboardCheck size={22} className="text-cyan-200"/><h2 className="mt-8 text-xl font-semibold">Grading & results</h2><p className="muted mt-2 text-sm leading-6">Review submissions and publish outcomes with confidence.</p></Link></div>
              </div>
            }
          />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="tests" element={<TestBuilder />} />
          <Route path="tests/:testId/monitor" element={<LiveMonitor />} />
          <Route path="grading" element={<GradingDashboard />} />
          <Route path="grading/test/:testId/submissions" element={<TestSubmissions />} />
          <Route path="grading/submission/:studentTestId" element={<StudentEvaluation />} />
          <Route path="grading/test/:testId/analytics" element={<TestAnalytics />} />
          <Route path="administration" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminPanel /></ProtectedRoute>} />
        </Route>

        {/* Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/student/results" element={<ProtectedRoute allowedRoles={["STUDENT"]}><StudentResults /></ProtectedRoute>} />
        <Route path="/student/results/:studentTestId" element={<ProtectedRoute allowedRoles={["STUDENT"]}><DetailedMarksheet /></ProtectedRoute>} />

        {/* Live Exam */}
        <Route
          path="/exam/:studentTestId"
          element={
            <EmbeddedExamRoute>
              <ExamTaking />
            </EmbeddedExamRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
