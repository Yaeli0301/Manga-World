import { Manga } from "../models/Manga.model.js";
import { ReadingProgress } from "../models/ReadingProgress.model.js";
import { runChatCompletion } from "./ai.service.js";

export async function getRecommendationsForUser(userId, limit = 12) {
  const recent = await ReadingProgress.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(5)
    .populate({ path: "mangaId", select: "genres title" })
    .lean();

  const genreWeights = {};
  for (const r of recent) {
    const m = r.mangaId;
    if (!m?.genres) continue;
    for (const g of m.genres) {
      genreWeights[g] = (genreWeights[g] || 0) + 1;
    }
  }
  const topGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g)
    .slice(0, 5);

  const query = { status: "published" };
  if (topGenres.length) {
    query.genres = { $in: topGenres };
  }

  let list = await Manga.find(query).sort({ trendingScore: -1, updatedAt: -1 }).limit(limit).lean();

  if (list.length < limit) {
    const more = await Manga.find({ status: "published" })
      .sort({ trendingScore: -1 })
      .limit(limit)
      .lean();
    const ids = new Set(list.map((x) => x._id.toString()));
    for (const m of more) {
      if (!ids.has(m._id.toString())) {
        list.push(m);
        ids.add(m._id.toString());
      }
      if (list.length >= limit) break;
    }
  }

  return { items: list.slice(0, limit), signals: { topGenres } };
}

export async function aiExplainRecommendations({ userId }) {
  const { items, signals } = await getRecommendationsForUser(userId, 6);
  const titles = items.map((m) => m.title).join(", ");
  const { content, mock } = await runChatCompletion({
    system: "You personalize manga discovery. Given genres and titles, write 2 short bullet reasons (max 280 chars total).",
    user: `Top genres: ${signals.topGenres.join(", ") || "general"}\nTitles: ${titles}`,
  });
  return { blurb: content, mock };
}
