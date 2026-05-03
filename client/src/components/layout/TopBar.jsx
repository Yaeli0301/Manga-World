import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import "./TopBar.css";

export function TopBar() {
  const { t, i18n } = useTranslation();
  const { user, logout, patchProfile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  async function setLang(lng) {
    await i18n.changeLanguage(lng);
    if (user) {
      try {
        await patchProfile({ language: lng });
      } catch {
        /* ignore */
      }
    }
    qc.invalidateQueries({ queryKey: ["manga"] });
    qc.invalidateQueries({ queryKey: ["progress"] });
    qc.invalidateQueries({ queryKey: ["reading-stats"] });
  }

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <Link to="/" className="top-bar-brand">
          Manga AI
        </Link>
        <div className="top-bar-lang">
          <button type="button" className={i18n.language?.startsWith("en") ? "tb-chip active" : "tb-chip"} onClick={() => setLang("en")}>
            EN
          </button>
          <button type="button" className={i18n.language?.startsWith("he") ? "tb-chip active" : "tb-chip"} onClick={() => setLang("he")}>
            עב
          </button>
        </div>
        <div className="top-bar-auth">
          {user ? (
            <>
              <span className="top-bar-user" title={user.email}>
                {user.displayName || user.email?.split("@")[0]}
              </span>
              <button
                type="button"
                className="tb-btn tb-btn--ghost"
                onClick={() => {
                  logout();
                  nav("/");
                }}
              >
                {t("topbar.logout")}
              </button>
            </>
          ) : (
            <Link to="/login" className="tb-btn tb-btn--primary">
              {t("topbar.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
