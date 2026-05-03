import { Manga } from "../models/Manga.model.js";
import { Chapter } from "../models/Chapter.model.js";
import { User } from "../models/User.model.js";
import { MangaRating } from "../models/MangaRating.model.js";
import { inferMetadataFromText } from "../services/ai.service.js";
import {
  listMangaQuery,
  trendingMangaQuery,
  distinctGenres,
} from "../services/catalogQuery.service.js";
import { cacheGetJSON, cacheSetJSON } from "../services/redis.service.js";
import { localizeManga, localizeChapterSummary, resolveContentLanguage } from "../utils/contentLanguage.js";

function mangaListCacheKey(req) {
  const lang = resolveContentLanguage(req);
  const qs = JSON.stringify({
    lang,
    genre: req.query.genre ?? null,
    genres: req.query.genres ?? null,
    q: req.query.q ?? null,
    page: req.query.page ?? 1,
    limit: req.query.limit ?? 20,
    status: req.query.status ?? "published",
    sort: req.query.sort ?? "updated",
    uploadedAfter: req.query.uploadedAfter ?? null,
    uploadedBefore: req.query.uploadedBefore ?? null,
    minRating: req.query.minRating ?? null,
  });
  return `manga:list:${qs}`;
}

export async function listManga(req, res, next) {
  try {
    const key = mangaListCacheKey(req);
    const cached = await cacheGetJSON(key);
    if (cached) {
      return res.json(cached);
    }
    const out = await listMangaQuery(req.query, req);
    await cacheSetJSON(key, out, Number(process.env.CATALOG_CACHE_TTL_SEC) || 90);
    res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
}

export async function listGenres(req, res, next) {
  try {
    const genres = await distinctGenres();
    res.json({ genres });
  } catch (e) {
    next(e);
  }
}

export async function trending(req, res, next) {
  try {
    const key = `manga:trending:${resolveContentLanguage(req)}`;
    const cached = await cacheGetJSON(key);
    if (cached) return res.json({ items: cached });
    const items = await trendingMangaQuery(req, 12);
    await cacheSetJSON(key, items, 120);
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function getManga(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id).lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.status !== "published" && !req.user?.roles?.includes("admin")) {
      const isOwner = m.createdBy?.toString() === req.user?.id;
      const canSee = req.user?.roles?.some((r) => ["translator", "admin"].includes(r));
      if (!isOwner && !canSee) return res.status(404).json({ error: "Not found" });
    }
    if (m.status === "published") {
      await Manga.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    }
    const chapters = await Chapter.find({ mangaId: req.params.id }).sort({ number: 1 }).select("number title titleHe isPremiumOnly").lean();
    const lang = resolveContentLanguage(req);
    let isFavorite = false;
    let myStars = null;
    if (req.user?.id) {
      const u = await User.findById(req.user.id).select("favorites").lean();
      isFavorite = Boolean(u?.favorites?.some((fid) => String(fid) === String(m._id)));
      if (m.status === "published") {
        const mr = await MangaRating.findOne({ mangaId: m._id, userId: req.user.id }).select("stars").lean();
        myStars = mr?.stars ?? null;
      }
    }
    res.json({
      manga: {
        ...localizeManga(m, lang),
        isFavorite,
        myStars,
        averageRating: m.averageRating ?? null,
        ratingCount: m.ratingCount ?? 0,
      },
      chapters: chapters.map((c) => localizeChapterSummary(c, lang)),
    });
  } catch (e) {
    next(e);
  }
}

export async function createManga(req, res, next) {
  try {
    const { title, description, genres, author, initialStatus } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });
    const isAdmin = req.user.roles.includes("admin");
    let status = "draft";
    if (isAdmin) {
      const s = initialStatus;
      status = ["draft", "pending", "published", "rejected"].includes(s) ? s : "published";
    }
    const doc = await Manga.create({
      title,
      description: description || "",
      genres: genres || [],
      author: author || "",
      createdBy: req.user.id,
      status,
    });
    res.status(201).json({ manga: doc });
  } catch (e) {
    next(e);
  }
}

/** Translator / owner: draft or rejected → pending (queue for admin). Requires ≥1 chapter. */
export async function submitForReview(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    const owner = m.createdBy?.toString() === req.user.id;
    const admin = req.user.roles?.includes("admin");
    if (!owner && !admin) return res.status(403).json({ error: "Forbidden" });
    if (!["draft", "rejected"].includes(m.status)) {
      return res.status(400).json({ error: "Only draft or rejected titles can be submitted for review" });
    }
    const chCount = await Chapter.countDocuments({ mangaId: m._id });
    if (chCount < 1) {
      return res.status(400).json({ error: "Add at least one chapter before submitting for review" });
    }
    m.status = "pending";
    await m.save();
    res.json({ manga: m });
  } catch (e) {
    next(e);
  }
}

/** Translator: own manga in any status (draft workflow). */
export async function listMyWork(req, res, next) {
  try {
    const items = await Manga.find({ createdBy: req.user.id }).sort({ updatedAt: -1 }).limit(120).lean();
    const lang = resolveContentLanguage(req);
    res.json({ items: items.map((m) => localizeManga(m, lang)) });
  } catch (e) {
    next(e);
  }
}

export async function runMetadataAi(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    const meta = await inferMetadataFromText({ title: m.title, description: m.description });
    m.metadataAi = { ...meta, lastRunAt: new Date() };
    await m.save();
    res.json({ metadataAi: m.metadataAi });
  } catch (e) {
    next(e);
  }
}

export async function setMangaStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!["draft", "pending", "published", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const m = await Manga.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!m) return res.status(404).json({ error: "Not found" });
    res.json({ manga: m });
  } catch (e) {
    next(e);
  }
}

export async function listPending(req, res, next) {
  try {
    const items = await Manga.find({ status: "pending" }).sort({ createdAt: -1 }).lean();
    const lang = resolveContentLanguage(req);
    res.json({ items: items.map((m) => localizeManga(m, lang)) });
  } catch (e) {
    next(e);
  }
}

export async function deleteManga(req, res, next) {
  try {
    await Chapter.deleteMany({ mangaId: req.params.id });
    await Manga.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function toggleFavorite(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    const id = req.params.id;
    const idx = user.favorites.map((x) => x.toString()).indexOf(id);
    if (idx >= 0) user.favorites.splice(idx, 1);
    else user.favorites.push(id);
    await user.save();
    res.json({ favorites: user.favorites });
  } catch (e) {
    next(e);
  }
}

export async function listFavorites(req, res, next) {
  try {
    const user = await User.findById(req.user.id).populate("favorites").lean();
    const lang = resolveContentLanguage(req);
    const favs = user.favorites || [];
    const items = Array.isArray(favs) ? favs.map((m) => (m && typeof m === "object" && m.title ? localizeManga(m, lang) : m)) : [];
    res.json({ items });
  } catch (e) {
    next(e);
  }
}
