import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const pill = (g) => (g || "").toLowerCase().slice(0, 12);

export function MangaCard({ manga }) {
  const title = manga.title;
  const genres = (manga.genres || []).filter(Boolean).slice(0, 2);

  return (
    <motion.div layout whileHover={{ y: -3, transition: { duration: 0.2 } }} whileTap={{ scale: 0.99 }}>
      <Link to={`/manga/${manga._id}`} className="manga-card glass-panel">
        <div className="manga-card-media">
          <div className="manga-card-glow" aria-hidden />
          <img src={manga.coverUrl || "/favicon.svg"} alt="" loading="lazy" decoding="async" />
          {manga.isPremiumOnly ? <span className="manga-card-premium-badge">PRO</span> : null}
          <div className="manga-card-shine" aria-hidden />
        </div>
        <div className="manga-card-meta">
          <div className="manga-card-title">{title}</div>
          {manga.averageRating != null && (manga.ratingCount ?? 0) > 0 && (
            <div className="manga-card-rating" aria-label="rating">
              ★ {Number(manga.averageRating).toFixed(1)}{" "}
              <span className="manga-card-rating-count">({manga.ratingCount})</span>
            </div>
          )}
          {genres.length > 0 && (
            <div className="manga-card-genres">
              {genres.map((g) => (
                <span key={g} className="manga-card-pill">
                  {pill(g)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
