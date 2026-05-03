import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export function PaywallModal({ open, onClose }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function checkout() {
    setErr("");
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await api.post("/api/payment/checkout");
      if (data.url) window.location.href = data.url;
      else setErr(t("paywall.checkoutFailed"));
    } catch {
      setErr(t("paywall.checkoutFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="paywall-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="paywall-modal glass-panel" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <h2>{t("paywall.title")}</h2>
            <p style={{ color: "var(--muted)" }}>{t("paywall.body")}</p>
            {!user && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, alignItems: "center" }}>
                <Link to="/login?next=/profile" className="neon-btn" style={{ display: "inline-block", padding: "10px 18px" }}>
                  {t("paywall.loginToSubscribe")}
                </Link>
                <button type="button" onClick={onClose} style={{ padding: "12px 16px", color: "var(--muted)" }}>
                  {t("paywall.close")}
                </button>
              </div>
            )}
            {user && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                <button type="button" className="neon-btn" onClick={checkout} disabled={busy}>
                  {busy ? "…" : t("paywall.cta")}
                </button>
                <button type="button" onClick={onClose} style={{ padding: "12px 16px", color: "var(--muted)" }}>
                  {t("paywall.close")}
                </button>
              </div>
            )}
            {err && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>
                {err}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
