import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { TopBar } from "../components/layout/TopBar";

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState("");
  async function onSubmit(e) {
    e.preventDefault();
    try {
      await register({ email, password, displayName });
      nav(nextPath.startsWith("/") ? nextPath : "/");
    } catch {
      setErr("Failed");
    }
  }
  return (
    <>
      <TopBar />
      <div className="page-shell">
      <h1>{t("auth.register")}</h1>
      <form onSubmit={onSubmit} className="glass-panel" style={{ padding: 16, display: "grid", gap: 10 }}>
        <input className="glass-panel" style={{ padding: 12 }} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("auth.name")} />
        <input className="glass-panel" style={{ padding: 12 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email")} />
        <input
          className="glass-panel"
          style={{ padding: 12 }}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.password")}
        />
        {err && <div style={{ color: "var(--danger)" }}>{err}</div>}
        <button className="neon-btn" type="submit">
          {t("auth.register")}
        </button>
      </form>
      <Link to={`/login?next=${encodeURIComponent(nextPath)}`}>{t("auth.login")}</Link>
      </div>
    </>
  );
}
