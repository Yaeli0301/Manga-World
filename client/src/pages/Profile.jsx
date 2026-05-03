import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, logout, patchProfile, hasRole, refresh } = useAuth();
  const qc = useQueryClient();
  const { mode, toggle } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [billingErr, setBillingErr] = useState("");

  const healthQ = useQuery({
    queryKey: ["payment-health"],
    queryFn: async () => {
      const { data } = await api.get("/api/payment/health");
      return data;
    },
  });

  const subQ = useQuery({
    queryKey: ["payment-subscription"],
    queryFn: async () => {
      const { data } = await api.get("/api/payment/subscription");
      return data;
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const statsQ = useQuery({
    queryKey: ["reading-stats"],
    queryFn: async () => {
      const { data } = await api.get("/api/progress/stats");
      return data;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      refresh();
      qc.invalidateQueries({ queryKey: ["payment-subscription"] });
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, refresh, qc]);

  async function startCheckout() {
    setBillingErr("");
    setCheckoutBusy(true);
    try {
      const { data } = await api.post("/api/payment/checkout");
      if (data.url) window.location.href = data.url;
      else setBillingErr(t("profile.checkoutError"));
    } catch {
      setBillingErr(t("profile.checkoutError"));
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function openPortal() {
    setBillingErr("");
    setPortalBusy(true);
    try {
      const { data } = await api.post("/api/payment/portal");
      if (data.url) window.location.href = data.url;
      else setBillingErr(t("profile.portalError"));
    } catch {
      setBillingErr(t("profile.portalError"));
    } finally {
      setPortalBusy(false);
    }
  }

  async function mockPremium() {
    await api.post("/api/payment/mock-subscribe");
    await refresh();
    qc.invalidateQueries({ queryKey: ["payment-subscription"] });
  }

  if (!user) {
    return (
      <div className="page-shell">
        <Link to="/login" className="neon-btn" style={{ display: "inline-block" }}>
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  const sub = subQ.data?.subscription;
  const renewal =
    sub?.currentPeriodEnd &&
    new Date(sub.currentPeriodEnd).toLocaleDateString(i18n.language === "he" ? "he-IL" : undefined);

  return (
    <div className="page-shell">
      <h1 style={{ marginTop: 0 }}>{t("profile.title")}</h1>
      <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{user.displayName || user.email}</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{user.email}</div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          {t("profile.premium")}: {hasRole("premium") ? "✓" : "—"}
        </div>
      </div>

      <div id="premium-billing" className="glass-panel profile-billing" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>{t("profile.billingTitle")}</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{t("profile.billingLead")}</p>
        {hasRole("premium") && renewal && (
          <p className="profile-billing-renewal">
            {sub?.cancelAtPeriodEnd ? t("profile.billingEndsOn", { date: renewal }) : t("profile.billingRenewsOn", { date: renewal })}
          </p>
        )}
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>{t("profile.billingRemindersHint")}</p>

        {!hasRole("premium") && (
          <button
            type="button"
            className="neon-btn profile-billing-primary"
            style={{ width: "100%", marginTop: 12 }}
            disabled={checkoutBusy || !healthQ.data?.configured}
            onClick={startCheckout}
          >
            {checkoutBusy ? "…" : t("profile.subscribeMonthly")}
          </button>
        )}

        {hasRole("premium") && user.hasBillingCustomer && (
          <button
            type="button"
            className="neon-btn profile-billing-primary"
            style={{ width: "100%", marginTop: 12 }}
            disabled={portalBusy}
            onClick={openPortal}
          >
            {portalBusy ? "…" : t("profile.manageBilling")}
          </button>
        )}

        {!healthQ.data?.configured && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>{t("profile.stripeNotConfigured")}</p>
        )}

        {import.meta.env.DEV && !healthQ.data?.configured && !hasRole("premium") && (
          <button type="button" className="chip" style={{ width: "100%", marginTop: 10 }} onClick={mockPremium}>
            {t("profile.mockStripe")}
          </button>
        )}

        {billingErr && (
          <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }} role="alert">
            {billingErr}
          </p>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
        <label>{t("profile.language")}</label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="chip"
            onClick={() =>
              patchProfile({ language: "en" }).then(() => {
                i18n.changeLanguage("en");
                qc.invalidateQueries({ queryKey: ["manga"] });
                qc.invalidateQueries({ queryKey: ["progress"] });
                qc.invalidateQueries({ queryKey: ["reading-stats"] });
              })
            }
          >
            English
          </button>
          <button
            type="button"
            className="chip"
            onClick={() =>
              patchProfile({ language: "he" }).then(() => {
                i18n.changeLanguage("he");
                qc.invalidateQueries({ queryKey: ["manga"] });
                qc.invalidateQueries({ queryKey: ["progress"] });
                qc.invalidateQueries({ queryKey: ["reading-stats"] });
              })
            }
          >
            עברית
          </button>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
        <label>{t("profile.theme")}</label>
        <div style={{ marginTop: 8 }}>
          <button type="button" className="neon-btn" onClick={toggle}>
            {mode}
          </button>
        </div>
      </div>
      <div className="glass-panel profile-stats" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>{t("profile.stats")}</h3>
        {statsQ.isLoading && <p style={{ color: "var(--muted)" }}>…</p>}
        {statsQ.isError && <p style={{ color: "var(--danger)" }}>{t("profile.statsError")}</p>}
        {statsQ.data && (
          <ul className="profile-stats-list">
            <li>
              <span className="profile-stats-label">{t("profile.statsChapters")}</span>
              <span className="profile-stats-value">{statsQ.data.uniqueChaptersOpened}</span>
            </li>
            <li>
              <span className="profile-stats-label">{t("profile.statsSeries")}</span>
              <span className="profile-stats-value">{statsQ.data.seriesWithProgress}</span>
            </li>
            <li>
              <span className="profile-stats-label">{t("profile.statsFavorites")}</span>
              <span className="profile-stats-value">{statsQ.data.favoritesCount}</span>
            </li>
            {statsQ.data.lastReadAt && (
              <li>
                <span className="profile-stats-label">{t("profile.statsLast")}</span>
                <span className="profile-stats-value profile-stats-date">
                  {new Date(statsQ.data.lastReadAt).toLocaleString(i18n.language === "he" ? "he-IL" : undefined)}
                </span>
              </li>
            )}
          </ul>
        )}
        <p className="profile-stats-hint">{t("profile.statsHint")}</p>
      </div>
      {hasRole("translator") && (
        <Link to="/translator" className="glass-panel" style={{ display: "block", padding: 14, marginBottom: 8 }}>
          {t("translator.title")}
        </Link>
      )}
      {hasRole("admin") && (
        <Link to="/admin" className="glass-panel" style={{ display: "block", padding: 14, marginBottom: 8 }}>
          {t("admin.title")}
        </Link>
      )}
      <button type="button" onClick={logout} style={{ color: "var(--danger)", marginTop: 8 }}>
        Log out
      </button>
    </div>
  );
}
