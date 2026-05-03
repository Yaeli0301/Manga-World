import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export function MangaRatingBlock({ mangaId, published }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["manga", mangaId, "ratings"],
    queryFn: async () => {
      const { data } = await api.get(`/api/manga/${mangaId}/ratings`);
      return data;
    },
    enabled: Boolean(mangaId) && Boolean(published),
  });

  const saveMut = useMutation({
    mutationFn: (body) => api.put(`/api/manga/${mangaId}/ratings/me`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", mangaId, "ratings"] });
      qc.invalidateQueries({ queryKey: ["manga", mangaId] });
      qc.invalidateQueries({ queryKey: ["manga", "browse"] });
      qc.invalidateQueries({ queryKey: ["manga", "list"] });
      qc.invalidateQueries({ queryKey: ["manga", "trending"] });
    },
  });

  const delMut = useMutation({
    mutationFn: () => api.delete(`/api/manga/${mangaId}/ratings/me`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", mangaId, "ratings"] });
      qc.invalidateQueries({ queryKey: ["manga", mangaId] });
      qc.invalidateQueries({ queryKey: ["manga", "browse"] });
      qc.invalidateQueries({ queryKey: ["manga", "list"] });
      qc.invalidateQueries({ queryKey: ["manga", "trending"] });
    },
  });

  if (!published || !mangaId) return null;

  const avg = q.data?.averageRating ?? null;
  const cnt = q.data?.ratingCount ?? 0;
  const mine = q.data?.mine ?? null;

  function commit(nextStars) {
    saveMut.mutate({ stars: nextStars });
  }

  return (
    <div id="manga-rating" className="manga-rating-block glass-panel">
      <div className="manga-rating-summary">
        {avg != null && cnt > 0 ? (
          <p className="manga-rating-line">
            <span className="manga-rating-stars-display" aria-hidden>
              ★
            </span>
            <strong>{Number(avg).toFixed(1)}</strong>
            <span className="manga-rating-muted"> · {t("mangaRating.votes", { n: cnt })}</span>
          </p>
        ) : (
          <p className="manga-rating-muted">{t("mangaRating.noneYet")}</p>
        )}
      </div>
      {user ? (
        <div className="manga-rating-form">
          <span className="manga-rating-label">{t("mangaRating.yourStars")}</span>
          <div className="manga-rating-stars-input" role="group" aria-label={t("mangaRating.yourStars")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`manga-rating-star-btn ${mine === n ? "active" : ""}`}
                aria-pressed={mine === n}
                onClick={() => commit(n)}
                disabled={saveMut.isPending}
                aria-label={t("mangaRating.starLabel", { n })}
              >
                ★
              </button>
            ))}
          </div>
          {mine != null && (
            <button type="button" className="chip manga-rating-clear" disabled={delMut.isPending} onClick={() => delMut.mutate()}>
              {t("mangaRating.clearMine")}
            </button>
          )}
          {(saveMut.isError || delMut.isError) && (
            <p className="manga-rating-error" role="alert">
              {t("mangaRating.saveError")}
            </p>
          )}
        </div>
      ) : (
        <p className="manga-rating-muted">{t("mangaRating.loginToRate")}</p>
      )}
    </div>
  );
}
