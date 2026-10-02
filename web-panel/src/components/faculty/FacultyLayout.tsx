import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { BookOpen, ClipboardCheck, FilePlus, LayoutDashboard, LogOut, Radio, ShieldCheck, Settings2 } from "lucide-react";
import ThemeToggle from "../ThemeToggle";

export default function FacultyLayout() {
  const { user, logout } = useAuthStore(); const location = useLocation();
  const links = [
    { name: "Overview", path: "/faculty", icon: LayoutDashboard },
    { name: "Question bank", path: "/faculty/questions", icon: BookOpen },
    { name: "Test builder", path: "/faculty/tests", icon: FilePlus },
    { name: "Live monitoring", path: "/faculty/tests", icon: Radio },
    { name: "Grading & results", path: "/faculty/grading", icon: ClipboardCheck },
    ...(user?.role === "ADMIN" ? [{ name: "Administration", path: "/faculty/administration", icon: Settings2 }] : []),
  ];
  return <div className="app-shell flex min-h-screen text-white">
    <aside className="glass-panel hidden w-72 shrink-0 flex-col border-y-0 border-l-0 p-5 lg:flex">
      <div className="mb-10 flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200"><ShieldCheck size={22}/></div><div><p className="font-bold tracking-tight">ExamShield</p><p className="eyebrow mt-1">{user?.role === "ADMIN" ? "Operations workspace" : "Faculty workspace"}</p></div></div>
      <nav className="space-y-1.5">{links.map(({ name, path, icon: Icon }, index) => { const active = index === 3 ? location.pathname.includes("/monitor") : location.pathname === path || (path !== "/faculty" && location.pathname.startsWith(path)); return <Link key={name} to={index === 3 ? "/faculty/tests" : path} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition ${active ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-900/20" : "text-slate-400 hover:bg-white/7 hover:text-white"}`}><Icon size={18}/>{name}</Link>; })}</nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-black/10 p-3"><div className="mb-3 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-700 font-bold text-cyan-200">{user?.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div></div><button onClick={logout} className="btn-secondary w-full py-2 text-xs"><LogOut size={15}/> Sign out</button></div>
    </aside>
    <div className="min-w-0 flex-1 overflow-auto"><header className="flex items-center justify-between border-b border-white/8 px-5 py-4 lg:px-10"><div><p className="eyebrow">ExamShield portal</p><p className="mt-1 text-sm text-slate-400">{user?.role === "ADMIN" ? "Manage people, assessments, monitoring, and results." : "Build clear assessments and stay close to the room."}</p></div><div className="flex gap-2"><ThemeToggle/><button onClick={logout} className="btn-secondary py-2 lg:hidden"><LogOut size={16}/><span className="hidden sm:inline">Sign out</span></button></div></header><main><Outlet /></main></div>
  </div>;
}
