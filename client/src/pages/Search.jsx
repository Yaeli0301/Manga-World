import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { MangaCard } from "../components/ui/MangaCard";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const HISTORY_KEY = "searchHistory";

const UPLOAD_PRESETS = [
  { id: "all", days: null },
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
  { id: "90d", days: 90 },
  { id: "365d", days: 365 },
];

const SORT_IDS = ["updated", "new", "popular", "trending", "rating"];

const MIN_RATING_IDS = ["0", "1", "2", "3", "4", "5"];

export default function Search() {
  const { t, i18n } = useTranslation();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 280);
  const [genrePick, setGenrePick] = useState(() => new Set());
  const [sort, setSort] = useState("updated");
  const [uploadPreset, setUploadPreset] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const genresQ = useQuery({
    queryKey: ["manga", "meta", "genres"],
    queryFn: async () => {
      const { data } = await api.get("/api/manga/meta/genres");
      return data.genres || [];
    },
    staleTime: 5 * 60_000,
  });

  const uploadedAfterIso = useMemo(() => {
    const row = UPLOAD_PRESETS.find((p) => p.id === uploadPreset);
    if (!row?.days) return undefined;
    return new Date(Date.now() - row.days * 86400000).toISOString();
  }, [uploadPreset]);

  const genreKey = useMemo(() => [...genrePick].sort().join(","), [genrePick]);

  const hasActiveQuery = useMemo(() => {
    if (debounced.trim().length > 0) return true;
    if (genrePick.size > 0) return true;
    if (uploadPreset !== "all") return true;
    if (sort !== "updated") return true;
    if (minRating !== "0") return true;
    return false;
  }, [debounced, genrePick, uploadPreset, sort, minRating]);

  const searchInfinite = useInfiniteQuery({
    queryKey: ["manga", "browse", debounced.trim(), genreKey, sort, uploadPreset, minRating, i18n.language],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = { page: pageParam, limit: 24, sort };
      const term = debounced.trim();
      if (term) params.q = term;
      if (genrePick.size) params.genres = [...genrePick].join(",");
      if (uploadedAfterIso) params.uploadedAfter = uploadedAfterIso;
      if (minRating !== "0") params.minRating = minRating;
      const { data } = await api.get("/api/manga", { params });
      return data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: hasActiveQuery,
  });

  const items = useMemo(() => searchInfinite.data?.pages.flatMap((p) => p.items || []) ?? [], [searchInfinite.data]);

  const pushHistory = useCallback((term) => {
    setHistory((prev) => {
      const next = [term, ...prev.filter((h) => h !== term)].slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  function toggleGenre(g) {
    setGenrePick((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }

  function clearFilters() {
    setQ("");
    setGenrePick(new Set());
    setSort("updated");
    setUploadPreset("all");
    setMinRating("0");
  }

  const loading = searchInfinite.isFetching;
  const empty = hasActiveQuery && !loading && items.length === 0 && !searchInfinite.isError;

  return (
    <div className="page-shell search-page">
      <h1 className="search-page-title">{t("nav.search")}</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => q.trim() && pushHistory(q.trim())}
        placeholder={t("search.placeholder")}
        className="search-field"
        aria-label={t("search.placeholder")}
      />

      <div className="search-filters-toolbar">
        <button type="button" className={`chip search-filters-toggle ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen((o) => !o)}>
          {t("search.advancedToggle")}
        </button>
        {(genrePick.size > 0 || uploadPreset !== "all" || sort !== "updated" || minRating !== "0" || debounced.trim()) && (
          <button type="button" className="chip" onClick={clearFilters}>
            {t("search.clearFilters")}
          </button>
        )}
      </div>

      {filtersOpen && (
        <section className="glass-panel search-advanced" aria-label={t("search.advancedTitle")}>
          <h2 className="search-advanced-title">{t("search.advancedTitle")}</h2>

          <div className="search-field-group">
            <span className="search-label">{t("search.sortLabel")}</span>
            <div className="search-chip-row">
              {SORT_IDS.map((id) => (
                <button key={id} type="button" className={`chip ${sort === id ? "active" : ""}`} onClick={() => setSort(id)}>
                  {t(`search.sort.${id}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="search-field-group">
            <span className="search-label">{t("search.minRatingLabel")}</span>
            <div className="search-chip-row search-chip-row--wrap">
              {MIN_RATING_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`chip ${minRating === id ? "active" : ""}`}
                  onClick={() => setMinRating(id)}
                >
                  {id === "0" ? t("search.minRatingAny") : t("search.minRatingAtLeast", { n: id })}
                </button>
              ))}
            </div>
          </div>

          <div className="search-field-group">
            <span className="search-label">{t("search.uploadedLabel")}</span>
            <div className="search-chip-row search-chip-row--wrap">
              {UPLOAD_PRESETS.map((p) => (
                <button key={p.id} type="button" className={`chip ${uploadPreset === p.id ? "active" : ""}`} onClick={() => setUploadPreset(p.id)}>
                  {t(`search.uploaded.${p.id}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="search-field-group">
            <span className="search-label">{t("search.genresLabel")}</span>
            {genresQ.isLoading && <p className="search-muted">{t("search.genresLoading")}</p>}
            {genresQ.data?.length === 0 && !genresQ.isLoading && <p className="search-muted">{t("search.genresEmpty")}</p>}
            <div className="search-chip-row search-chip-row--wrap">
              {(genresQ.data || []).map((g) => (
                <button key={g} type="button" className={`chip ${genrePick.has(g) ? "active" : ""}`} onClick={() => toggleGenre(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <h3 className="search-subheading">{t("search.history")}</h3>
      <div className="search-chip-row search-chip-row--wrap search-history-row">
        {history.map((h) => (
          <button key={h} type="button" className="chip" onClick={() => setQ(h)}>
            {h}
          </button>
        ))}
      </div>

      {!hasActiveQuery && (
        <p className="search-hint glass-panel">{t("search.hint")}</p>
      )}

      {searchInfinite.isError && (
        <p className="search-error" role="alert">
          {t("search.error")}
        </p>
      )}

      {loading && hasActiveQuery && <p className="search-muted">{t("search.loading")}</p>}

      {empty && <p className="search-empty glass-panel">{t("search.noResults")}</p>}

      <div className="grid-feed search-results-grid">
        {items.map((m) => (
          <MangaCard key={m._id} manga={m} />
        ))}
      </div>

      {searchInfinite.hasNextPage && (
        <button
          type="button"
          className="neon-btn search-load-more"
          style={{ width: "100%", marginTop: 16 }}
          disabled={searchInfinite.isFetchingNextPage}
          onClick={() => searchInfinite.fetchNextPage()}
        >
          {searchInfinite.isFetchingNextPage ? "…" : t("search.loadMore")}
        </button>
      )}
    </div>
  );
}
