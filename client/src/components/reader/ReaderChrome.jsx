import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ReaderChrome({
  visible,
  mode,
  onMode,
  onPrev,
  onNext,
  title,
  pageIndex,
  pageCount,
  scrollSnap,
  onScrollSnap,
  fitWidth,
  onFitWidth,
  warmTone,
  onWarmTone,
  optionsHintOpen = false,
  onOptionsHintOpen,
}) {
  const { t } = useTranslation();
  const [optsOpen, setOptsOpen] = useState(false);

  useEffect(() => {
    if (!optionsHintOpen) return;
    setOptsOpen(true);
    onOptionsHintOpen?.(false);
  }, [optionsHintOpen, onOptionsHintOpen]);

  if (!visible) return null;

  const fitCycle = () => {
    const order = ["full", "comfort", "narrow"];
    const i = order.indexOf(fitWidth);
    onFitWidth(order[(i + 1) % order.length]);
  };

  return (
    <div className="reader-chrome glass-panel">
      <div className="reader-chrome-row reader-chrome-top">
        <span className="reader-title">{title}</span>
        <div className="reader-chrome-actions">
          <div className="reader-modes">
            <button type="button" className={mode === "vertical" ? "chip active" : "chip"} onClick={() => onMode("vertical")}>
              {t("reader.modeMangaScroll")}
            </button>
            <button type="button" className={mode === "paged" ? "chip active" : "chip"} onClick={() => onMode("paged")}>
              {t("reader.modeSinglePage")}
            </button>
          </div>
          <button
            type="button"
            className={`reader-gear ${optsOpen ? "active" : ""}`}
            onClick={() => setOptsOpen((o) => !o)}
            aria-expanded={optsOpen}
            aria-label={t("reader.moreOptions")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {optsOpen && (
        <div className="reader-opts" role="group" aria-label={t("reader.moreOptions")}>
          <div className="reader-opts-row">
            <span className="reader-opts-label">{t("reader.snapScroll")}</span>
            <button type="button" className={scrollSnap ? "chip active" : "chip"} onClick={() => onScrollSnap(!scrollSnap)}>
              {scrollSnap ? t("reader.on") : t("reader.off")}
            </button>
          </div>
          <div className="reader-opts-row">
            <span className="reader-opts-label">{t("reader.pageWidth")}</span>
            <button type="button" className="chip active" onClick={fitCycle}>
              {t(`reader.fit.${fitWidth}`)}
            </button>
          </div>
          <div className="reader-opts-row">
            <span className="reader-opts-label">{t("reader.warmTone")}</span>
            <button type="button" className={warmTone ? "chip active" : "chip"} onClick={() => onWarmTone(!warmTone)}>
              {warmTone ? t("reader.on") : t("reader.off")}
            </button>
          </div>
          <p className="reader-opts-hint">{t("reader.hints")}</p>
        </div>
      )}

      <div className="reader-chrome-row reader-chrome-nav">
        <button type="button" className="neon-btn" onClick={onPrev}>
          {mode === "vertical" ? t("reader.prevChapter") : t("reader.prevPage")}
        </button>
        {mode === "paged" && pageCount > 0 ? (
          <span className="reader-page-indicator">
            {pageIndex + 1} / {pageCount}
          </span>
        ) : (
          <span className="reader-page-indicator reader-page-indicator--muted">
            {t("reader.stripMeta", { pages: pageCount })}
          </span>
        )}
        <button type="button" className="neon-btn" onClick={onNext}>
          {mode === "vertical" ? t("reader.nextChapter") : t("reader.nextPage")}
        </button>
      </div>
    </div>
  );
}
