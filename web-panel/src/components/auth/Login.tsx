import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import toast from "react-hot-toast";
import ThemeToggle from "../ThemeToggle";

type Role = "ADMIN" | "FACULTY" | "STUDENT";
type Mode = "login" | "register";

export default function Login() {
  const [role, setRole] = useState<Role>("STUDENT");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
  const [divisions, setDivisions] = useState(["A", "B", "C"]);
  const [form, setForm] = useState({ name: "", email: "", password: "", identifier: "", enrollmentNo: "", batch: "S1", division: "A", department: "", subject: "" });
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => { api.get("/auth/options").then(({ data }) => { if (data.batches?.length) { setBatches(data.batches); setForm((f) => ({ ...f, batch: data.batches.includes(f.batch) ? f.batch : data.batches[0] })); } if (data.divisions?.length) { setDivisions(data.divisions); setForm((f) => ({ ...f, division: data.divisions.includes(f.division) ? f.division : data.divisions[0] })); } }).catch(() => {}); }, []);
  const change = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const switchRole = (next: Role) => { setRole(next); setMode("login"); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true);
    try {
      if (mode === "login") {
        const response = await api.post("/auth/login", { identifier: role === "STUDENT" ? form.identifier : form.email, password: form.password, role });
        if (!response.data.token || !response.data.user) throw new Error("The server returned an incomplete login response");
        login(response.data.user, response.data.token);
        toast.success(`Welcome back, ${response.data.user.name}`);
        navigate(role === "STUDENT" ? "/student" : "/faculty");
        return;
      }
      if (role === "ADMIN") throw new Error("Administrator accounts are created by the deployment administrator");
      const endpoint = role === "STUDENT" ? "/auth/register/student" : "/auth/register/faculty";
      const payload = role === "STUDENT" ? { name: form.name, email: form.email, enrollmentNo: form.enrollmentNo, password: form.password, batch: form.batch, division: form.division } : { name: form.name, email: form.email, password: form.password, department: form.department, subject: form.subject };
      const response = await api.post(endpoint, payload);
      toast.success(response.data.message || "Registration submitted"); setMode("login");
    } catch (error: any) { toast.error(error.response?.data?.error || error.response?.data?.message || error.message || "Something went wrong"); }
    finally { setLoading(false); }
  };

  return <main className="app-shell grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden p-14 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative"><div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200 shadow-inner"><ShieldCheck size={24}/></div><span className="text-xl font-bold tracking-tight">ExamShield</span></div><p className="eyebrow mb-5">Secure assessment workspace</p><h1 className="max-w-xl text-6xl font-semibold leading-[1.02] tracking-[-.05em] text-white">Calm tools for serious exams.</h1><p className="muted mt-7 max-w-lg text-lg leading-8">Plan assessments, monitor sessions, and keep every learner focused in one considered workspace.</p></div>
      <div className="glass-panel relative max-w-lg rounded-3xl p-5"><div className="flex items-center gap-3"><span className="status-dot"/><span className="text-sm font-semibold">Local secure environment</span></div><p className="muted mt-3 text-sm leading-6">Your role determines the workspace and permissions you see after sign in.</p></div>
    </section>
    <section className="relative flex items-center justify-center px-5 py-10 sm:px-10"><div className="absolute right-5 top-5"><ThemeToggle /></div>
      <div className="glass-panel w-full max-w-md rounded-[28px] p-7 sm:p-9">
        <div className="mb-8 lg:hidden"><p className="eyebrow">ExamShield</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Secure assessment workspace</h1></div>
        <div className="mb-7"><p className="eyebrow">{mode === "login" ? "Welcome back" : "Create access"}</p><h2 className="mt-2 text-2xl font-semibold">{mode === "login" ? "Sign in to your portal" : `Register as ${role.toLowerCase()}`}</h2><p className="muted mt-2 text-sm">Use the account issued for your ExamShield workspace.</p></div>
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/10 p-1">{(["STUDENT", "FACULTY", "ADMIN"] as Role[]).map((item) => <button key={item} type="button" onClick={() => switchRole(item)} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${role === item ? "bg-cyan-300 text-slate-950 shadow-lg" : "text-slate-400 hover:text-white"}`}>{item}</button>)}</div>
        {role !== "ADMIN" && <div className="mb-6 flex gap-2"><button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "login" ? "bg-white/10 text-white" : "text-slate-500"}`}>Sign in</button><button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "register" ? "bg-white/10 text-white" : "text-slate-500"}`}>Register</button></div>}
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <input className="field" name="name" placeholder="Full name" value={form.name} onChange={change} required />}
          {mode === "login" && role === "STUDENT" ? <input className="field" name="identifier" placeholder="Email or enrollment number" value={form.identifier} onChange={change} required /> : (mode === "register" || role !== "STUDENT") && <input className="field" name="email" type="email" placeholder="Email address" value={form.email} onChange={change} required />}
          {mode === "register" && role === "STUDENT" && <><input className="field" name="enrollmentNo" placeholder="Enrollment number" value={form.enrollmentNo} onChange={change} required/><div className="grid grid-cols-2 gap-3"><select className="field" name="batch" value={form.batch} onChange={change}>{batches.map((value) => <option className="bg-slate-900" key={value}>{value}</option>)}</select><select className="field" name="division" value={form.division} onChange={change}>{divisions.map((value) => <option className="bg-slate-900" key={value}>{value}</option>)}</select></div></>}
          {mode === "register" && role === "FACULTY" && <><input className="field" name="department" placeholder="Department" value={form.department} onChange={change}/><input className="field" name="subject" placeholder="Primary subject" value={form.subject} onChange={change}/></>}
          <div className="relative"><LockKeyhole className="absolute left-3 top-3.5 text-slate-500" size={17}/><input className="field pl-10" name="password" type="password" placeholder={mode === "register" ? "Password (8+ characters)" : "Password"} value={form.password} onChange={change} required /></div>
          <button className="btn-primary w-full py-3.5" disabled={loading}>{loading ? "Working…" : mode === "login" ? <>Continue <ArrowRight size={17}/></> : "Submit registration"}</button>
        </form>
      </div>
    </section>
  </main>;
}
