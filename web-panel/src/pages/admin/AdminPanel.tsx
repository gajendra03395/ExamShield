import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import toast from "react-hot-toast";
import ThemeToggle from "../../components/ThemeToggle";

type View = "dashboard" | "groups" | "users" | "audit";
const initialView = (): View => {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "groups" || requested === "users" || requested === "audit" ? requested : "dashboard";
};
export default function AdminPanel() {
  const [view, setView] = useState<View>(initialView);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"batches" | "divisions">("batches");
  const { user, logout } = useAuthStore();
  const refresh = useCallback(async () => {
    if (view === "dashboard") setStats((await api.get("/admin/overview")).data.data);
    if (view === "users") setUsers((await api.get("/admin/users")).data.data);
    if (view === "audit") setLogs((await api.get("/admin/audit-logs")).data.data);
    if (view === "groups") {
      const [b, d] = await Promise.all([api.get("/admin/batches"), api.get("/admin/divisions")]);
      setBatches(b.data.data); setDivisions(d.data.data);
    }
  }, [view]);
  useEffect(() => { void refresh().catch((error) => toast.error(error.response?.data?.message || "Could not load administration data")); }, [refresh]);
  const create = async () => {
    if (!name.trim()) return;
    try { await api.post(`/admin/${kind}`, { name: name.trim() }); setName(""); await refresh(); toast.success("Saved"); }
    catch (error: any) { toast.error(error.response?.data?.message || "Could not create entry"); }
  };
  const toggleUser = async (u: any) => {
    try { await api.patch(`/admin/users/${u.role.toLowerCase()}/${u.id}/active`, { isActive: !u.isActive }); await refresh(); toast.success("User status updated"); }
    catch (error: any) { toast.error(error.response?.data?.message || "Could not update user status"); }
  };
  const nav: [View, string][] = [["dashboard", "Dashboard"], ["groups", "Batches & divisions"], ["users", "User management"], ["audit", "Audit logs"]];
  return <div className="app-shell min-h-screen text-white">
    <header className="glass-panel flex flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 px-6 py-5"><div><p className="eyebrow">Operations console</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Administration</h1><p className="muted mt-1 text-sm">Signed in as {user?.name}</p></div><div className="flex gap-2"><ThemeToggle/><button onClick={logout} className="btn-secondary text-rose-200">Log out</button></div></header>
    <nav className="flex flex-wrap gap-2 border-b border-white/8 px-6 py-4">{nav.map(([id, label]) => <button key={id} onClick={() => setView(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === id ? "bg-cyan-300 text-slate-950" : "bg-white/6 text-slate-400 hover:text-white"}`}>{label}</button>)}</nav>
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {view === "dashboard" && <section><h2 className="mb-4 text-xl font-semibold">Platform overview</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(stats).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-700 bg-slate-900 p-5"><div className="text-sm capitalize text-slate-400">{key.replace(/[A-Z]/g, x => ` ${x.toLowerCase()}`)}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>)}</div></section>}
      {view === "groups" && <section><h2 className="mb-4 text-xl font-semibold">Batch and division manager</h2><div className="mb-5 flex max-w-xl gap-2"><select value={kind} onChange={e => setKind(e.target.value as any)} className="rounded bg-slate-800 p-3"><option value="batches">Batch</option><option value="divisions">Division</option></select><input value={name} onChange={e => setName(e.target.value)} placeholder="New batch or division" className="min-w-0 flex-1 rounded bg-slate-800 p-3"/><button onClick={create} className="rounded bg-blue-600 px-4">Create</button></div><div className="grid gap-4 md:grid-cols-2"><Group title="Batches" rows={batches}/><Group title="Divisions" rows={divisions}/></div></section>}
      {view === "users" && <section><h2 className="mb-4 text-xl font-semibold">User management</h2><div className="overflow-x-auto rounded border border-slate-700"><table className="w-full text-left text-sm"><thead className="bg-slate-800"><tr>{["Name", "Email", "Role", "Group", "Status", "Action"].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{users.map(u => <tr key={`${u.role}-${u.id}`} className="border-t border-slate-800"><td className="p-3">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td><td className="p-3">{u.batch ? `${u.batch} / ${u.division}` : u.department || "—"}</td><td className="p-3">{u.isActive ? "Active" : "Inactive"}</td><td className="p-3"><button onClick={() => toggleUser(u)} className="rounded bg-slate-700 px-3 py-1">{u.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div></section>}
      {view === "audit" && <section><h2 className="mb-4 text-xl font-semibold">Audit log</h2><div className="overflow-x-auto rounded border border-slate-700"><table className="w-full text-left text-sm"><thead className="bg-slate-800"><tr>{["Time", "Action", "Actor", "IP", "Details"].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{logs.map(log => <tr key={log.id} className="border-t border-slate-800"><td className="whitespace-nowrap p-3">{new Date(log.createdAt).toLocaleString()}</td><td className="p-3">{log.action}</td><td className="p-3">{log.userType} · {log.userId}</td><td className="p-3">{log.ipAddress || "—"}</td><td className="max-w-sm p-3">{JSON.stringify(log.details || {})}</td></tr>)}</tbody></table></div></section>}
    </main>
  </div>;
}
function Group({ title, rows }: { title: string; rows: any[] }) { return <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="mb-3 font-semibold">{title}</h3><div className="flex flex-wrap gap-2">{rows.map(item => <span key={item.id} className="rounded bg-slate-800 px-3 py-2">{item.name}</span>)}</div></div>; }
