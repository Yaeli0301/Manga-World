import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const EMOJIS = ["❤️", "😂", "🤩", "😮", "🔥", "👍"];

function errMessage(err, fallback) {
  const d = err?.response?.data;
  if (d?.error && typeof d.error === "string") return d.error;
  return fallback;
}

export function ChapterReactionPanel({ chapterId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [stars, setStars] = useState(null);
  const [comment, setComment] = useState("");
  const [emoji, setEmoji] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  const q = useQuery({
    queryKey: ["chapter", chapterId, "reviews"],
    queryFn: async () => {
      const { data } = await api.get(`/api/chapters/${chapterId}/reviews`);
      return data;
    },
    enabled: Boolean(chapterId),
  });

  useEffect(() => {
    if (!q.data) return;
    const m = q.data.mine;
    if (m) {
      setStars(m.stars ?? null);
      setComment(m.comment || "");
      setEmoji(m.emoji || "");
    } else {
      setStars(null);
      setComment("");
      setEmoji("");
    }
  }, [chapterId, q.data]);

  const saveMut = useMutation({
    mutationFn: (body) => api.put(`/api/chapters/${chapterId}/reviews/me`, body),
    onSuccess: () => {
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2400);
      qc.invalidateQueries({ queryKey: ["chapter", chapterId, "reviews"] });
    },
  });

  const delMut = useMutation({
    mutationFn: () => api.delete(`/api/chapters/${chapterId}/reviews/me`),
    onSuccess: () => {
      setStars(null);
      setComment("");
      setEmoji("");
      setSaveOk(false);
      qc.invalidateQueries({ queryKey: ["chapter", chapterId, "reviews"] });
    },
  });

  if (!chapterId) return null;

  const stats = q.data?.stats;
  const recent = q.data?.recent || [];

  function save() {
    if (!(stars != null || comment.trim() || emoji)) return;
    saveMut.mutate(
      {
        stars: stars == null ? null : stars,
        comment,
        emoji,
      },
      {
        onError: () => setSaveOk(false),
      }
    );
  }

  return (
    <section className="chapter-reaction-panel" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <h3 className="chapter-reaction-title">{t("chapterReview.title")}</h3>
      {stats?.reviewCount > 0 && (
        <p className="chapter-reaction-stats">
          {stats.avgStars != null && (
            <>
              ★ {stats.avgStars} <span className="chapter-reaction-muted">({stats.countWithStars})</span>
            </>
          )}
          {stats.avgStars != null && stats.reviewCount > stats.countWithStars ? " · " : ""}
          <span className="chapter-reaction-muted">{t("chapterReview.count", { n: stats.reviewCount })}</span>
        </p>
      )}

      {user ? (
        <div className="chapter-reaction-form">
          <div className="chapter-reaction-row">
            <span className="chapter-reaction-label">{t("chapterReview.stars")}</span>
            <div className="chapter-reaction-stars" role="group" aria-label={t("chapterReview.stars")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chapter-star ${stars === n ? "active" : ""}`}
                  onClick={() => setStars(stars === n ? null : n)}
                  aria-pressed={stars === n}
                  aria-label={`${n} ${t("chapterReview.stars")}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="chapter-reaction-row">
            <span className="chapter-reaction-label">{t("chapterReview.emoji")}</span>
            <div className="chapter-reaction-emojis">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`chapter-emoji ${emoji === e ? "active" : ""}`}
                  onClick={() => setEmoji(emoji === e ? "" : e)}
                  aria-pressed={emoji === e}
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="chapter-reaction-textarea"
            rows={3}
            value={comment}
            onChange={(ev) => setComment(ev.target.value)}
            placeholder={t("chapterReview.commentPlaceholder")}
            maxLength={2000}
          />
          <div className="chapter-reaction-actions">
            <button type="button" className="neon-btn" onClick={save} disabled={saveMut.isPending}>
              {saveMut.isPending ? "…" : t("chapterReview.save")}
            </button>
            <button type="button" className="chip" onClick={() => delMut.mutate()} disabled={delMut.isPending || !q.data?.mine}>
              {t("chapterReview.clearMine")}
            </button>
          </div>
          {saveOk && <p className="chapter-reaction-success">{t("chapterReview.saved")}</p>}
          {saveMut.isError && (
            <p className="chapter-reaction-error" role="alert">
              {errMessage(saveMut.error, t("chapterReview.saveError"))}
            </p>
          )}
          {delMut.isError && (
            <p className="chapter-reaction-error" role="alert">
              {errMessage(delMut.error, t("chapterReview.saveError"))}
            </p>
          )}
        </div>
      ) : (
        <p className="chapter-reaction-muted">{t("chapterReview.loginToReact")}</p>
      )}

      {recent.length > 0 && (
        <ul className="chapter-reaction-list">
          {recent.map((r) => (
            <li key={r.id} className="chapter-reaction-item glass-panel">
              <div className="chapter-reaction-item-head">
                <strong>{r.displayName}</strong>
                {r.stars ? <span className="chapter-reaction-item-stars">{"★".repeat(r.stars)}</span> : null}
                {r.emoji ? <span className="chapter-reaction-item-emoji">{r.emoji}</span> : null}
              </div>
              {r.comment ? <p className="chapter-reaction-item-text">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
