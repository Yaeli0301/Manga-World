import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { ReaderChrome } from "../components/reader/ReaderChrome";
import { useSwipeNavigation } from "../components/mobile/useSwipeNavigation";
import { PaywallModal } from "../components/ui/PaywallModal";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

function useDebounced(fn, ms) {
  const t = useRef();
  return useCallback(
    (...args) => {
      clearTimeout(t.current);
      t.current = setTimeout(() => fn(...args), ms);
    },
    [fn, ms]
  );
}

export default function Reader() {
  const { chapterId } = useParams();
  const nav = useNavigate();
  const { i18n, t } = useTranslation();
  const { toggle: toggleTheme } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(false);

  const [chapter, setChapter] = useState(null);
  const [manga, setManga] = useState(null);
  const [order, setOrder] = useState([]);
  const [mode, setMode] = useState(() => localStorage.getItem("readerMode") || "vertical");
  const [pageIndex, setPageIndex] = useState(0);
  const [ui, setUi] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [scrollSnap, setScrollSnap] = useState(() => localStorage.getItem("readerScrollSnap") === "1");
  const [fitWidth, setFitWidth] = useState(() => {
    const v = localStorage.getItem("readerFitWidth");
    return ["full", "comfort", "narrow"].includes(v) ? v : "full";
  });
  const [warmTone, setWarmTone] = useState(() => localStorage.getItem("readerWarmTone") === "1");
  const [optionsHintOpen, setOptionsHintOpen] = useState(false);
  const vScrollRef = useRef(null);
  const longPress = useRef(null);

  useEffect(() => {
    localStorage.setItem("readerScrollSnap", scrollSnap ? "1" : "0");
  }, [scrollSnap]);
  useEffect(() => {
    localStorage.setItem("readerFitWidth", fitWidth);
  }, [fitWidth]);
  useEffect(() => {
    localStorage.setItem("readerWarmTone", warmTone ? "1" : "0");
  }, [warmTone]);

  const flushProgress = useCallback(
    async (body) => {
      try {
        await api.put("/api/progress", body);
        qc.invalidateQueries({ queryKey: ["reading-stats"] });
      } catch {
        /* ignore */
      }
    },
    [qc]
  );
  const saveProgress = useDebounced(flushProgress, 400);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await api.get(`/api/chapters/${chapterId}`);
      if (cancelled) return;
      setChapter(data.chapter);
      setManga(data.manga);
      setIsFavorite(Boolean(data.manga?.isFavorite));
      if (data.chapter.locked) {
        setPaywall(true);
        return;
      }
      const chRes = await api.get(`/api/chapters/manga/${data.manga._id}`);
      setOrder(chRes.data.items.sort((a, b) => a.number - b.number));
      try {
        const pr = await api.get(`/api/progress/manga/${data.manga._id}`);
        const p = pr.data.progress;
        if (p && String(p.chapterId) === String(data.chapter._id)) {
          setMode(p.readingMode || "vertical");
          setPageIndex(p.pageIndex || 0);
          requestAnimationFrame(() => {
            if (p.readingMode === "vertical" && vScrollRef.current) {
              vScrollRef.current.scrollTop = p.scrollPositionY || 0;
            }
          });
        }
      } catch {
        /* no progress */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterId, i18n.language]);

  const pages = chapter?.pages || [];
  const title = useMemo(() => {
    if (!chapter || !manga) return "";
    const chTitle = chapter.title || `Ch.${chapter.number}`;
    return `${manga.title} · ${chTitle}`;
  }, [chapter, manga]);

  const persist = useCallback(() => {
    if (!chapter || !manga || chapter.locked) return;
    const scrollY = mode === "vertical" && vScrollRef.current ? vScrollRef.current.scrollTop : 0;
    saveProgress({
      mangaId: manga._id,
      chapterId: chapter._id,
      pageIndex,
      scrollPositionY: scrollY,
      readingMode: mode,
    });
  }, [chapter, manga, mode, pageIndex, saveProgress]);

  useEffect(() => {
    persist();
  }, [pageIndex, mode, persist]);

  const idxInOrder = order.findIndex((c) => String(c._id) === String(chapter?._id));
  const prevChapter = idxInOrder > 0 ? order[idxInOrder - 1] : null;
  const nextChapter = idxInOrder >= 0 && idxInOrder < order.length - 1 ? order[idxInOrder + 1] : null;

  const goChapter = useCallback(
    (dir) => {
      const n = order[idxInOrder + dir];
      if (!n) return;
      nav(`/read/${n._id}`, { replace: true });
    },
    [order, idxInOrder, nav]
  );

  const swipe = useSwipeNavigation({
    enabled: Boolean(chapter && !chapter.locked),
    onLeft: () => goChapter(document.documentElement.dir === "rtl" ? -1 : 1),
    onRight: () => goChapter(document.documentElement.dir === "rtl" ? 1 : -1),
    onUp: () => {
      const el = vScrollRef.current;
      if (el && mode === "vertical") el.scrollBy({ top: Math.min(320, el.clientHeight * 0.55), behavior: "smooth" });
    },
    onDown: () => {
      const el = vScrollRef.current;
      if (el && mode === "vertical") el.scrollBy({ top: -Math.min(320, el.clientHeight * 0.55), behavior: "smooth" });
    },
  });

  useEffect(() => {
    const onKey = (e) => {
      if (!chapter || chapter.locked) return;
      if (e.key === "ArrowRight") (document.documentElement.dir === "rtl" ? goChapter(-1) : goChapter(1));
      if (e.key === "ArrowLeft") (document.documentElement.dir === "rtl" ? goChapter(1) : goChapter(-1));
      if (e.key === "ArrowDown" && mode === "vertical") vScrollRef.current?.scrollBy({ top: 120, behavior: "smooth" });
      if (e.key === "ArrowUp" && mode === "vertical") vScrollRef.current?.scrollBy({ top: -120, behavior: "smooth" });
      if (e.code === "Space") {
        e.preventDefault();
        vScrollRef.current?.scrollBy({ top: mode === "vertical" ? 320 : 0, behavior: "smooth" });
        if (mode === "paged") setPageIndex((i) => Math.min(i + 1, pages.length - 1));
      }
      if (e.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      }
      if (e.key.toLowerCase() === "z") setZoom((z) => !z);
      if (e.key.toLowerCase() === "d") toggleTheme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, mode, pages.length, goChapter, toggleTheme]);

  const onScrollVertical = () => persist();

  const onTouchStartLP = (e) => {
    clearTimeout(longPress.current);
    longPress.current = setTimeout(() => {
      setUi(true);
      setOptionsHintOpen(true);
    }, 650);
    swipe.onTouchStart(e);
  };
  const onTouchEndLP = (e) => {
    clearTimeout(longPress.current);
    swipe.onTouchEnd(e);
  };

  if (!chapter) {
    return (
      <div className="page-shell">
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div
      className={`reader-root reader-fit-${fitWidth} ${zoom ? "reader-zoom" : ""} ${warmTone ? "reader-warm" : ""}`}
      onTouchStart={onTouchStartLP}
      onTouchEnd={onTouchEndLP}
    >
      <button type="button" onClick={() => nav(-1)} className="reader-back glass-panel" aria-label="Back">
        ←
      </button>
      {user && manga?._id && !chapter?.locked && (
        <button
          type="button"
          className={`reader-fav glass-panel ${isFavorite ? "reader-fav--on" : ""}`}
          aria-pressed={isFavorite}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await api.post(`/api/manga/${manga._id}/favorite`);
              setIsFavorite((v) => !v);
              qc.invalidateQueries({ queryKey: ["manga", "favorites"] });
              qc.invalidateQueries({ queryKey: ["manga", String(manga._id)] });
              qc.invalidateQueries({ queryKey: ["reading-stats"] });
            } catch {
              /* ignore */
            }
          }}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      )}
      <div
        className="reader-stage"
        onClick={() => setUi((v) => !v)}
        role="presentation"
        onScroll={mode === "vertical" ? onScrollVertical : undefined}
      >
        {mode === "paged" ? (
          <>
            <div className="reader-paged">
              {pages[pageIndex] && <img src={pages[pageIndex].imageUrl} alt="" decoding="async" />}
            </div>
            {!chapter.locked && manga?._id && (
              <div className="reader-rate-series glass-panel" onClick={(e) => e.stopPropagation()} role="note">
                <Link to={`/manga/${manga._id}#manga-rating`} className="reader-rate-series-link">
                  {t("reader.rateSeries")}
                </Link>
              </div>
            )}
          </>
        ) : (
          <div
            className={`reader-vertical ${scrollSnap ? "reader-vertical--snap" : ""}`}
            ref={vScrollRef}
            onScroll={onScrollVertical}
          >
            {pages.map((p) => (
              <img key={p.index} src={p.imageUrl} alt="" loading={p.index < 3 ? "eager" : "lazy"} decoding="async" />
            ))}
            {!chapter.locked && manga?._id && (
              <div className="reader-rate-series glass-panel" onClick={(e) => e.stopPropagation()} role="note">
                <Link to={`/manga/${manga._id}#manga-rating`} className="reader-rate-series-link">
                  {t("reader.rateSeries")}
                </Link>
              </div>
            )}
            <footer
              className="reader-chapter-end"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="contentinfo"
            >
              <p>{t("reader.chapterEndHint", { count: pages.length })}</p>
              <div className="reader-chapter-end-actions">
                {prevChapter && (
                  <button
                    type="button"
                    className="reader-chapter-btn reader-chapter-btn--secondary"
                    onClick={() => nav(`/read/${prevChapter._id}`, { replace: true })}
                  >
                    ← {t("reader.prevChapter")} (#{prevChapter.number})
                  </button>
                )}
                {nextChapter && (
                  <button type="button" className="reader-chapter-btn" onClick={() => nav(`/read/${nextChapter._id}`, { replace: true })}>
                    {t("reader.nextChapter")} (#{nextChapter.number}) →
                  </button>
                )}
                {!prevChapter && !nextChapter && <p className="reader-page-indicator reader-page-indicator--muted">{t("reader.singleChapter")}</p>}
              </div>
            </footer>
          </div>
        )}
      </div>
      <ReaderChrome
        visible={ui}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          localStorage.setItem("readerMode", m);
        }}
        onPrev={() => {
          if (mode === "paged") setPageIndex((i) => Math.max(0, i - 1));
          else goChapter(-1);
        }}
        onNext={() => {
          if (mode === "paged" && pageIndex < pages.length - 1) setPageIndex((i) => i + 1);
          else if (mode === "paged" && pageIndex >= pages.length - 1) goChapter(1);
          else goChapter(1);
        }}
        title={title}
        pageIndex={pageIndex}
        pageCount={pages.length}
        scrollSnap={scrollSnap}
        onScrollSnap={setScrollSnap}
        fitWidth={fitWidth}
        onFitWidth={setFitWidth}
        warmTone={warmTone}
        onWarmTone={setWarmTone}
        optionsHintOpen={optionsHintOpen}
        onOptionsHintOpen={setOptionsHintOpen}
      />
      <PaywallModal open={paywall} onClose={() => nav(-1)} />
    </div>
  );
}
