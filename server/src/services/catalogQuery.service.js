import { Manga } from "../models/Manga.model.js";
import { Chapter } from "../models/Chapter.model.js";
import { escapeRegex } from "../utils/string.js";
import { localizeManga, resolveContentLanguage } from "../utils/contentLanguage.js";

const SORT_MAP = {
  new: { createdAt: -1 },
  updated: { updatedAt: -1 },
  popular: { viewCount: -1, updatedAt: -1 },
  trending: { trendingScore: -1, updatedAt: -1 },
};

function parseGenreList(genre, genres) {
  if (genres !== undefined && genres !== null && String(genres).trim()) {
    return String(genres)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (genre !== undefined && genre !== null && String(genre).trim()) {
    return [String(genre).trim()];
  }
  return [];
}

/** Published manga with ≥1 chapter and no chapter still in draft / review / rejected translation. */
export async function publishedMangaIdsWithTranslationPipelineComplete() {
  const mangaColl = Manga.collection.collectionName;
  const rows = await Chapter.aggregate([
    { $lookup: { from: mangaColl, localField: "mangaId", foreignField: "_id", as: "m" } },
    { $unwind: "$m" },
    { $match: { "m.status": "published" } },
    {
      $group: {
        _id: "$mangaId",
        anyOpen: {
          $max: {
            $cond: [{ $in: ["$translationStatus", ["draft", "pending_review", "rejected"]] }, 1, 0],
          },
        },
        ch: { $sum: 1 },
      },
    },
    { $match: { anyOpen: 0, ch: { $gte: 1 } } },
    { $project: { _id: 1 } },
  ]);
  return rows.map((r) => r._id);
}

/**
 * Shared catalog list for REST + GraphQL + cache layer.
 * @param {object} params
 * @param {import('express').Request} reqLike - must satisfy resolveContentLanguage(req)
 */
export async function listMangaQuery(params, reqLike) {
  const {
    genre,
    genres,
    q,
    page = 1,
    limit = 20,
    status = "published",
    sort = "updated",
    uploadedAfter,
    uploadedBefore,
    minRating,
  } = params;

  const filter = { status: String(status) };

  const genreList = [...new Set(parseGenreList(genre, genres))];
  if (genreList.length > 0) {
    filter.genres = { $all: genreList };
  }

  const after = uploadedAfter ? new Date(String(uploadedAfter)) : null;
  const before = uploadedBefore ? new Date(String(uploadedBefore)) : null;
  const dateActive =
    (after && !Number.isNaN(after.getTime())) || (before && !Number.isNaN(before.getTime()));
  if (dateActive) {
    filter.createdAt = {};
    if (after && !Number.isNaN(after.getTime())) filter.createdAt.$gte = after;
    if (before && !Number.isNaN(before.getTime())) filter.createdAt.$lte = before;
    const settledIds = await publishedMangaIdsWithTranslationPipelineComplete();
    if (!settledIds.length) {
      const pg0 = Math.max(Number(page) || 1, 1);
      return { items: [], page: pg0, hasMore: false };
    }
    filter._id = { $in: settledIds };
  }

  const rawQ = q != null ? String(q).trim() : "";
  if (rawQ.length > 0) {
    if (rawQ.length > 200) {
      const err = new Error("Search query too long");
      err.statusCode = 400;
      throw err;
    }
    const rx = new RegExp(escapeRegex(rawQ), "i");
    filter.$or = [{ title: rx }, { titleHe: rx }, { description: rx }, { descriptionHe: rx }, { author: rx }];
  }

  const minR = Number(minRating);
  if (Number.isFinite(minR) && minR >= 1 && minR <= 5) {
    filter.ratingCount = { $gte: 1 };
    filter.averageRating = { $gte: minR };
  }

  const sortKey = SORT_MAP[String(sort)] || SORT_MAP.updated;
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 60);
  const pg = Math.max(Number(page) || 1, 1);
  const skip = (pg - 1) * lim;

  const useRatingSort = String(sort) === "rating";
  let items;
  if (useRatingSort) {
    items = await Manga.aggregate([
      { $match: filter },
      { $addFields: { _ratingSort: { $ifNull: ["$averageRating", -1] } } },
      { $sort: { _ratingSort: -1, ratingCount: -1, updatedAt: -1 } },
      { $skip: skip },
      { $limit: lim + 1 },
      { $project: { _ratingSort: 0 } },
    ]);
  } else {
    items = await Manga.find(filter).sort(sortKey).skip(skip).limit(lim + 1).lean();
  }
  const hasMore = items.length > lim;
  const slice = hasMore ? items.slice(0, lim) : items;
  const lang = resolveContentLanguage(reqLike);
  return { items: slice.map((m) => localizeManga(m, lang)), page: pg, hasMore };
}

export async function trendingMangaQuery(reqLike, limit = 12) {
  const items = await Manga.find({ status: "published" })
    .sort({ trendingScore: -1 })
    .limit(limit)
    .lean();
  const lang = resolveContentLanguage(reqLike);
  return items.map((m) => localizeManga(m, lang));
}

export async function distinctGenres() {
  const genres = await Manga.distinct("genres", { status: "published" });
  return [...new Set(genres.filter((g) => typeof g === "string" && g.trim()))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
