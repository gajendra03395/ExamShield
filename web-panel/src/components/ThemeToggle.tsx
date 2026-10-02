import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "examshield_theme";
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem(KEY) !== "light");
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem(KEY, dark ? "dark" : "light"); }, [dark]);
  return <button type="button" onClick={() => setDark((value) => !value)} className="btn-secondary" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={16}/> : <Moon size={16}/>}<span className="hidden sm:inline">{dark ? "Light mode" : "Dark mode"}</span></button>;
}
