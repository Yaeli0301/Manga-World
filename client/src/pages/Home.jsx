import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { MangaCard } from "../components/ui/MangaCard";
import { useAuth } from "../context/AuthContext";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isPremium = Boolean(user?.roles?.includes("premium"));

  const trendingQ = useQuery({
    queryKey: ["manga", "trending", i18n.language],
    queryFn: async () => {
      const { data } = await api.get("/api/manga/trending");
      return data.items || [];
    },
  });

  const feedQ = useQuery({
    queryKey: ["manga", "list", { limit: 12, page: 1 }, i18n.language],
    queryFn: async () => {
      const { data } = await api.get("/api/manga", { params: { limit: 12, page: 1 } });
      return data.items || [];
    },
  });

  const progressQ = useQuery({
    queryKey: ["progress", "list", i18n.language],
    queryFn: async () => {
      const { data } = await api.get("/api/progress");
      return data.items || [];
    },
    enabled: Boolean(user),
  });

  const trending = trendingQ.data ?? [];
  const foryou = feedQ.data ?? [];
  const cont = progressQ.data ?? [];

  return (
    <div className="page-shell">
      <header className="hero glass-panel">
        <div className="hero-bg" aria-hidden />
        <div className="hero-content">
          <p className="hero-kicker">{t("home.heroKicker")}</p>
          <h1 className="hero-title">Manga AI</h1>
          <p className="hero-sub">{t("home.heroSub")}</p>
          <div className="hero-badges">
            <span className="hero-badge">{t("home.badgePwa")}</span>
            <span className="hero-badge">{t("home.badgeSync")}</span>
            <span className="hero-badge">{t("home.badgeNeon")}</span>
          </div>
        </div>
      </header>

      {!isPremium && (
        <aside className="premium-promo glass-panel" aria-label={t("home.premiumPromoTitle")}>
          <div className="premium-promo-glow" aria-hidden />
          <div className="premium-promo-inner">
            <div>
              <p className="premium-promo-kicker">{t("home.premiumPromoKicker")}</p>
              <h2 className="premium-promo-title">{t("home.premiumPromoTitle")}</h2>
              <p className="premium-promo-copy">{t("home.premiumPromoCopy")}</p>
            </div>
            <div className="premium-promo-actions">
              {user ? (
                <Link to="/profile#premium-billing" className="neon-btn premium-promo-cta">
                  {t("home.premiumPromoCta")}
                </Link>
              ) : (
                <Link to="/login?next=/profile" className="neon-btn premium-promo-cta">
                  {t("home.premiumPromoCtaGuest")}
                </Link>
              )}
            </div>
          </div>
        </aside>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{t("home.trending")}</h2>
          <p className="section-hint">{trending.length ? `${trending.length}` : ""}</p>
        </div>
        {trendingQ.isLoading && (
          <div style={{ display: "flex", gap: 10 }}>
            <div className="skeleton skeleton-line" style={{ flex: 1, height: 220, borderRadius: "var(--radius)" }} />
            <div className="skeleton skeleton-line" style={{ flex: 1, height: 220, borderRadius: "var(--radius)" }} />
          </div>
        )}
        <motion.div className="rail" initial="hidden" animate="show" variants={staggerContainer}>
          {trending.map((m) => (
            <motion.div key={m._id} className="rail-item" variants={staggerItem}>
              <MangaCard manga={m} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {user && cont.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">{t("home.continue")}</h2>
          </div>
          <motion.div className="continue-stack" variants={staggerContainer} initial="hidden" animate="show">
            {cont.slice(0, 5).map((p) => {
              const manga = p.mangaId && typeof p.mangaId === "object" ? p.mangaId : null;
              const ch = p.chapterId && typeof p.chapterId === "object" ? p.chapterId : null;
              const chapterHref =
                ch?._id != null
                  ? `/read/${ch._id}`
                  : typeof p.chapterId === "string"
                    ? `/read/${p.chapterId}`
                    : "#";
              const coverSrc = manga?.coverUrl || "/favicon.svg";
              const mangaTitle = manga?.title || "Manga";
              const chNum = ch?.number;
              const chTitle = (ch?.title || "").trim();
              const modeLabel = p.readingMode === "paged" ? t("reader.modePaged") : t("reader.modeVertical");
              return (
                <motion.div key={p._id} variants={staggerItem}>
                  <Link to={chapterHref} className="continue-card glass-panel">
                    <div className="continue-card-thumb">
                      <img src={coverSrc} alt="" loading="lazy" decoding="async" />
                    </div>
                    <div className="continue-card-body">
                      <p className="continue-card-title">{mangaTitle}</p>
                      {chNum != null && (
                        <p className="continue-card-chapter">
                          <span className="continue-card-chapter-num">{t("home.continueChapterNum", { n: chNum })}</span>
                          {chTitle ? <span className="continue-card-chapter-title"> · {chTitle}</span> : null}
                        </p>
                      )}
                      <p className="continue-card-meta">
                        {t("home.continueReadingMeta", { y: Math.round(p.scrollPositionY || 0), mode: modeLabel })}
                      </p>
                    </div>
                    <div className="continue-card-icon" aria-hidden>
                      ▶
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{t("home.forYou")}</h2>
        </div>
        {feedQ.isLoading && (
          <div className="grid-feed">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "3/4", borderRadius: "var(--radius)" }} />
            ))}
          </div>
        )}
        <motion.div className="grid-feed" variants={staggerContainer} initial="hidden" animate="show">
          {foryou.map((m) => (
            <motion.div key={m._id} variants={staggerItem}>
              <MangaCard manga={m} />
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
