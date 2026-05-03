import mongoose from "mongoose";
import { Manga } from "../models/Manga.model.js";
import { MangaRating } from "../models/MangaRating.model.js";

export async function refreshMangaRatingAggregates(mangaId) {
  const mid = mongoose.Types.ObjectId.isValid(mangaId) ? new mongoose.Types.ObjectId(mangaId) : null;
  if (!mid) return;
  const agg = await MangaRating.aggregate([
    { $match: { mangaId: mid } },
    { $group: { _id: null, avg: { $avg: "$stars" }, cnt: { $sum: 1 } } },
  ]);
  const row = agg[0];
  await Manga.findByIdAndUpdate(mangaId, {
    averageRating: row ? Math.round(row.avg * 10) / 10 : null,
    ratingCount: row ? row.cnt : 0,
  });
}
