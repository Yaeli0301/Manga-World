import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../context/AuthContext";
import "./BottomNav.css";

const icons = {
  home: (
    <svg className="bn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
    </svg>
  ),
  library: (
    <svg className="bn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg className="bn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  ),
  favorites: (
    <svg className="bn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M12 21s-7-4.35-7-10a4.5 4.5 0 017.09-3.7A4.5 4.5 0 0119 11c0 5.65-7 10-7 10z"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
    </svg>
  ),
  profile: (
    <svg className="bn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 20.5c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5" strokeLinecap="round" />
    </svg>
  ),
};

const baseItems = [
  { to: "/", key: "home", iconKey: "home" },
  { to: "/library", key: "library", iconKey: "library" },
  { to: "/search", key: "search", iconKey: "search" },
];

const authedItems = [
  { to: "/favorites", key: "favorites", iconKey: "favorites" },
  { to: "/profile", key: "profile", iconKey: "profile" },
];

const guestEnd = [{ to: "/login", key: "login", iconKey: "profile" }];

export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const items = [...baseItems, ...(user ? authedItems : guestEnd)];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-track">
        <div className="bottom-nav-accent" aria-hidden />
        <div className="bottom-nav-inner">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} className={({ isActive }) => `bn-item ${isActive ? "active" : ""}`} end={it.to === "/"}>
              <span className="bn-icon-wrap">{icons[it.iconKey]}</span>
              <span className="bn-label">{t(`nav.${it.key}`)}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
