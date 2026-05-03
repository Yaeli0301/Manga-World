import { Manga } from "../models/Manga.model.js";
import { MangaRating } from "../models/MangaRating.model.js";
import { refreshMangaRatingAggregates } from "../services/mangaRating.service.js";

export async function getRatings(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id).select("averageRating ratingCount").lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    let mine = null;
    if (req.user?.id) {
      const r = await MangaRating.findOne({ mangaId: m._id, userId: req.user.id }).select("stars").lean();
      mine = r?.stars ?? null;
    }
    res.json({
      averageRating: m.averageRating ?? null,
      ratingCount: m.ratingCount ?? 0,
      mine,
    });
  } catch (e) {
    next(e);
  }
}

export async function putMine(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id).select("_id status").lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.status !== "published") {
      return res.status(400).json({ error: "Ratings are only allowed on published series" });
    }
    const st = Number(req.body?.stars);
    if (!Number.isFinite(st) || st < 1 || st > 5) {
      return res.status(400).json({ error: "stars must be between 1 and 5" });
    }
    await MangaRating.findOneAndUpdate(
      { mangaId: m._id, userId: req.user.id },
      { mangaId: m._id, userId: req.user.id, stars: st },
      { upsert: true, new: true, runValidators: true }
    );
    await refreshMangaRatingAggregates(m._id);
    const updated = await Manga.findById(m._id).select("averageRating ratingCount").lean();
    res.json({
      mine: st,
      averageRating: updated?.averageRating ?? null,
      ratingCount: updated?.ratingCount ?? 0,
    });
  } catch (e) {
    next(e);
  }
}

export async function deleteMine(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id).select("_id").lean();
    if (!m) return res.status(404).json({ error: "Not found" });
    await MangaRating.deleteOne({ mangaId: m._id, userId: req.user.id });
    await refreshMangaRatingAggregates(m._id);
    const updated = await Manga.findById(m._id).select("averageRating ratingCount").lean();
    res.json({
      mine: null,
      averageRating: updated?.averageRating ?? null,
      ratingCount: updated?.ratingCount ?? 0,
    });
  } catch (e) {
    next(e);
  }
}
