import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { MangaRatingBlock } from "../components/manga/MangaRatingBlock";

export default function MangaDetails() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [chapterSearch, setChapterSearch] = useState("");

  useEffect(() => {
    setChapterSearch("");
  }, [id]);

  const detailQ = useQuery({
    queryKey: ["manga", id, lang],
    queryFn: async () => {
      const res = await api.get(`/api/manga/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const favMutation = useMutation({
    mutationFn: () => api.post(`/api/manga/${id}/favorite`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", id] });
      qc.invalidateQueries({ queryKey: ["manga", "favorites"] });
      qc.invalidateQueries({ queryKey: ["reading-stats"] });
    },
  });

  if (detailQ.isLoading || !detailQ.data) {
    return (
      <div className="page-shell">
        <div className="skeleton" style={{ height: 260, borderRadius: "var(--radius)", marginBottom: 16 }} />
        <div className="skeleton skeleton-line" style={{ width: "70%" }} />
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      </div>
    );
  }

  const { manga, chapters } = detailQ.data;
  const filteredChapters = useMemo(() => {
    const raw = chapterSearch.trim();
    if (!raw) return chapters;
    const digits = raw.replace(/\D/g, "");
    if (!digits) return chapters;
    return chapters.filter((c) => String(c.number ?? "").includes(digits));
  }, [chapters, chapterSearch]);
  const isFiltering = Boolean(chapterSearch.trim() && chapterSearch.replace(/\D/g, "").length > 0);
  const isFavorite = Boolean(manga.isFavorite);
  const title = manga.title;
  const desc = manga.description;
  const isPremiumUser = hasRole("premium");
  const mangaIsPremiumOnly = Boolean(manga.isPremiumOnly);
  const needsUpgrade = mangaIsPremiumOnly && !isPremiumUser;

  return (
    <div className="page-shell">
      <div className="detail-hero glass-panel">
        <div className="detail-cover-wrap">
          <img src={manga.coverUrl || "/favicon.svg"} alt="" />
        </div>
        <div className="detail-body">
          <h1 className="detail-title">{title}</h1>
          {manga.status === "published" && (
            <div className="detail-rating-slot">
              <MangaRatingBlock mangaId={id} published />
            </div>
          )}
          <p className="detail-genres">{(manga.genres || []).join(" · ")}</p>
          <p className="detail-desc">{desc}</p>
          {user && (
            <button
              type="button"
              className={isFavorite ? "chip active" : "chip"}
              onClick={() => favMutation.mutate()}
              disabled={favMutation.isPending}
            >
              {isFavorite ? "♥ " : "♡ "}
              {isFavorite ? t("favorites.remove") : t("favorites.add")}
            </button>
          )}
        </div>
      </div>

      {needsUpgrade && (
        <aside className="manga-premium-callout glass-panel">
          <p className="manga-premium-callout-title">{t("manga.seriesPremiumTitle")}</p>
          <p className="manga-premium-callout-copy">{t("manga.seriesPremiumCopy")}</p>
          {user ? (
            <Link to="/profile#premium-billing" className="neon-btn manga-premium-callout-cta">
              {t("manga.seriesPremiumCta")}
            </Link>
          ) : (
            <Link to="/login?next=/profile" className="neon-btn manga-premium-callout-cta">
              {t("manga.seriesPremiumCtaGuest")}
            </Link>
          )}
        </aside>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{t("manga.chapters")}</h2>
          <p className="section-hint">
            {isFiltering ? `${filteredChapters.length}/${chapters.length}` : chapters.length}
          </p>
        </div>
        <label className="manga-chapter-search-label" htmlFor="manga-chapter-search">
          {t("manga.chapterSearchLabel")}
        </label>
        <input
          id="manga-chapter-search"
          type="search"
          inputMode="numeric"
          autoComplete="off"
          className="search-field manga-chapter-search"
          value={chapterSearch}
          onChange={(e) => setChapterSearch(e.target.value)}
          placeholder={t("manga.chapterSearchPlaceholder")}
          aria-label={t("manga.chapterSearchLabel")}
        />
        <div className="chapter-list">
          {filteredChapters.map((c) => (
            <Link key={c._id} to={`/read/${c._id}`} className="chapter-link glass-panel">
              <span>
                #{c.number} {c.title || ""}
              </span>
              {c.isPremiumOnly || mangaIsPremiumOnly ? <small>{t("manga.locked")}</small> : <small>→</small>}
            </Link>
          ))}
        </div>
        {isFiltering && filteredChapters.length === 0 && (
          <p className="manga-chapter-search-empty">{t("manga.chapterSearchNoMatch")}</p>
        )}
      </section>

      {chapters[0] && (!isFiltering || filteredChapters.length > 0) && (
        <Link
          to={`/read/${(isFiltering ? filteredChapters[0] : chapters[0])._id}`}
          className="neon-btn"
          style={{ display: "block", textAlign: "center", marginTop: 18 }}
        >
          {t("manga.start")}
        </Link>
      )}
    </div>
  );
}
