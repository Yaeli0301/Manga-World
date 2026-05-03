import { Chapter } from "../models/Chapter.model.js";
import { ChapterReview } from "../models/ChapterReview.model.js";

function hasContent({ stars, comment, emoji }) {
  const c = (comment || "").trim();
  const e = (emoji || "").trim();
  const st = Number(stars);
  const hasStars = Number.isFinite(st) && st >= 1 && st <= 5;
  return hasStars || c.length > 0 || e.length > 0;
}

function toPublicReview(doc, userLean) {
  if (!userLean || typeof userLean !== "object") {
    return {
      id: doc._id.toString(),
      stars: doc.stars,
      comment: doc.comment || "",
      emoji: doc.emoji || "",
      createdAt: doc.createdAt,
      displayName: "Reader",
    };
  }
  const u = userLean;
  const name = (u.displayName || "").trim() || (u.email ? String(u.email).split("@")[0] : "Reader");
  return {
    id: doc._id.toString(),
    stars: doc.stars,
    comment: doc.comment || "",
    emoji: doc.emoji || "",
    createdAt: doc.createdAt,
    displayName: name,
  };
}

export async function listReviews(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id).select("_id mangaId").lean();
    if (!ch) return res.status(404).json({ error: "Not found" });

    const all = await ChapterReview.find({ chapterId: ch._id }).populate("userId", "displayName email").sort({ createdAt: -1 }).limit(60).lean();

    const withStars = all.filter((r) => r.stars >= 1 && r.stars <= 5);
    const avgStars = withStars.length ? withStars.reduce((a, r) => a + r.stars, 0) / withStars.length : null;
    const emojiCounts = {};
    for (const r of all) {
      const em = (r.emoji || "").trim();
      if (em) emojiCounts[em] = (emojiCounts[em] || 0) + 1;
    }

    const recent = all.slice(0, 25).map((r) => toPublicReview(r, r.userId));

    let mine = null;
    if (req.user?.id) {
      const mdoc = await ChapterReview.findOne({ chapterId: ch._id, userId: req.user.id }).lean();
      if (mdoc) mine = { stars: mdoc.stars, comment: mdoc.comment || "", emoji: mdoc.emoji || "" };
    }

    res.json({
      stats: {
        avgStars: avgStars != null ? Math.round(avgStars * 10) / 10 : null,
        countWithStars: withStars.length,
        reviewCount: all.length,
        emojiCounts,
      },
      recent,
      mine,
    });
  } catch (e) {
    next(e);
  }
}

export async function upsertMine(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id).select("_id mangaId").lean();
    if (!ch) return res.status(404).json({ error: "Not found" });

    const existing = await ChapterReview.findOne({ chapterId: ch._id, userId: req.user.id }).lean();
    const body = req.body || {};

    const com =
      body.comment !== undefined ? String(body.comment).slice(0, 2000).trim() : (existing?.comment || "").trim();
    const em = body.emoji !== undefined ? String(body.emoji).trim().slice(0, 32) : (existing?.emoji || "").trim();

    let st;
    if (body.stars === undefined) {
      st = existing?.stars != null && existing.stars >= 1 && existing.stars <= 5 ? existing.stars : null;
    } else if (body.stars === null || body.stars === "") {
      st = null;
    } else {
      st = Number(body.stars);
      if (!Number.isFinite(st) || st < 1 || st > 5) {
        return res.status(400).json({ error: "stars must be between 1 and 5, or null to clear" });
      }
    }

    if (!hasContent({ stars: st, comment: com, emoji: em })) {
      return res.status(400).json({ error: "Provide at least one of: stars (1–5), comment, or emoji" });
    }

    const filter = { chapterId: ch._id, userId: req.user.id };
    const $set = {
      chapterId: ch._id,
      mangaId: ch.mangaId,
      userId: req.user.id,
      comment: com,
      emoji: em,
    };
    if (st != null) $set.stars = st;
    const update = { $set };
    if (st == null) update.$unset = { stars: "" };

    const doc = await ChapterReview.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

    res.json({ review: { stars: doc.stars, comment: doc.comment || "", emoji: doc.emoji || "" } });
  } catch (e) {
    next(e);
  }
}

export async function deleteMine(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id).select("_id").lean();
    if (!ch) return res.status(404).json({ error: "Not found" });
    await ChapterReview.deleteOne({ chapterId: ch._id, userId: req.user.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
