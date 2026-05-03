import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { TopBar } from "../components/layout/TopBar";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function onSubmit(e) {
    e.preventDefault();
    try {
      await login({ email, password });
      nav(nextPath.startsWith("/") ? nextPath : "/");
    } catch {
      setErr("Failed");
    }
  }
  return (
    <>
      <TopBar />
      <div className="page-shell">
      <h1>{t("auth.login")}</h1>
      <form onSubmit={onSubmit} className="glass-panel" style={{ padding: 16, display: "grid", gap: 10 }}>
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
          {t("auth.login")}
        </button>
      </form>
      <Link to="/register">{t("auth.register")}</Link>
      </div>
    </>
  );
}
