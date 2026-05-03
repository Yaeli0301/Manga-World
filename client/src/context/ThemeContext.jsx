import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.body.dataset.theme = mode;
    localStorage.setItem("theme", mode);
    /* Colors come from CSS (global + comic.css) via data-theme — no inline overrides */
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode, toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")) }), [mode]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("ThemeProvider missing");
  return v;
}
