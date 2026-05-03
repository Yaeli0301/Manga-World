import bcrypt from "bcryptjs";
import { User } from "../models/User.model.js";
import { Manga } from "../models/Manga.model.js";
import { Chapter } from "../models/Chapter.model.js";
import { TranslatorAssignment } from "../models/TranslatorAssignment.model.js";
import { escapeRegex } from "../utils/string.js";
import { pushChapterTranslationVersion } from "../services/chapterVersion.service.js";

export async function listUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(200).select("-passwordHash").lean();
    res.json({ items: users });
  } catch (e) {
    next(e);
  }
}

export async function listMangaCatalog(req, res, next) {
  try {
    const { status = "pending", page = 1, limit = 50, q, createdBy } = req.query;
    const filter = {};
    if (status && status !== "all") {
      const list = String(status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length) filter.status = { $in: list };
    }
    const qt = q != null ? String(q).trim() : "";
    if (qt.length > 0) {
      const rx = new RegExp(escapeRegex(qt.slice(0, 200)), "i");
      filter.$or = [{ title: rx }, { titleHe: rx }, { description: rx }, { descriptionHe: rx }];
    }
    if (createdBy) filter.createdBy = createdBy;
    const skip = (Number(page) - 1) * Number(limit);
    const items = await Manga.find(filter)
      .populate("createdBy", "email displayName")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    const total = await Manga.countDocuments(filter);
    res.json({ items, page: Number(page), total });
  } catch (e) {
    next(e);
  }
}

export async function dashboardStats(req, res, next) {
  try {
    const [pending, draft, published, rejected, users, translators, pendingTranslationReviews, openAssignments] =
      await Promise.all([
        Manga.countDocuments({ status: "pending" }),
        Manga.countDocuments({ status: "draft" }),
        Manga.countDocuments({ status: "published" }),
        Manga.countDocuments({ status: "rejected" }),
        User.countDocuments({}),
        User.countDocuments({ roles: "translator" }),
        Chapter.countDocuments({ translationStatus: "pending_review" }),
        TranslatorAssignment.countDocuments({ status: "assigned" }),
      ]);
    res.json({
      pending,
      draft,
      published,
      rejected,
      users,
      translators,
      pendingTranslationReviews,
      openAssignments,
    });
  } catch (e) {
    next(e);
  }
}

export async function bulkSetMangaStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "ids array required" });
    if (!["draft", "pending", "published", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const result = await Manga.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.json({ modified: result.modifiedCount });
  } catch (e) {
    next(e);
  }
}

export async function patchManga(req, res, next) {
  try {
    const { isPremiumOnly } = req.body;
    const m = await Manga.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (typeof isPremiumOnly === "boolean") m.isPremiumOnly = isPremiumOnly;
    await m.save();
    res.json({ manga: m });
  } catch (e) {
    next(e);
  }
}

export async function setUserRoles(req, res, next) {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "roles array required" });
    const allowed = new Set(["user", "premium", "translator", "admin"]);
    let clean = [...new Set(roles)].filter((r) => allowed.has(r));
    if (!clean.includes("user")) clean.push("user");
    const user = await User.findByIdAndUpdate(req.params.id, { roles: clean }, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ user });
  } catch (e) {
    next(e);
  }
}

export async function createUserAccount(req, res, next) {
  try {
    const { email, password, displayName, roles } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const allowed = new Set(["user", "premium", "translator", "admin"]);
    let clean = Array.isArray(roles) ? [...new Set(roles)].filter((r) => allowed.has(r)) : ["user", "translator"];
    if (!clean.includes("user")) clean.push("user");
    const passwordHash = await bcrypt.hash(String(password), 12);
    const user = await User.create({
      email: String(email).toLowerCase(),
      passwordHash,
      displayName: displayName || "",
      roles: clean,
    });
    res.status(201).json({ user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}

export async function listTranslatorAssignments(req, res, next) {
  try {
    const { translatorId, mangaId } = req.query;
    const filter = {};
    if (translatorId) filter.translatorId = translatorId;
    if (mangaId) filter.mangaId = mangaId;
    const items = await TranslatorAssignment.find(filter)
      .sort({ updatedAt: -1 })
      .limit(500)
      .populate("translatorId", "email displayName")
      .populate("chapterId", "number title translationStatus")
      .populate("mangaId", "title status")
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function upsertTranslatorAssignments(req, res, next) {
  try {
    const { translatorId, chapterIds } = req.body;
    if (!translatorId || !Array.isArray(chapterIds) || !chapterIds.length) {
      return res.status(400).json({ error: "translatorId and chapterIds[] required" });
    }
    const chapters = await Chapter.find({ _id: { $in: chapterIds } }).select("_id mangaId").lean();
    for (const ch of chapters) {
      await TranslatorAssignment.findOneAndUpdate(
        { chapterId: ch._id },
        {
          translatorId,
          mangaId: ch.mangaId,
          chapterId: ch._id,
          assignedBy: req.user.id,
          status: "assigned",
        },
        { upsert: true, new: true }
      );
    }
    res.json({ ok: true, count: chapters.length });
  } catch (e) {
    next(e);
  }
}

export async function deleteTranslatorAssignment(req, res, next) {
  try {
    const r = await TranslatorAssignment.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function listPendingReviewChapters(req, res, next) {
  try {
    const items = await Chapter.find({ translationStatus: "pending_review" })
      .sort({ updatedAt: -1 })
      .limit(120)
      .populate("mangaId", "title status")
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function approveChapterTranslation(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    if (ch.translationStatus !== "pending_review") {
      return res.status(400).json({ error: "Chapter is not pending review" });
    }
    ch.translationStatus = "published";
    ch.moderationNote = "";
    await ch.save();
    await TranslatorAssignment.findOneAndUpdate({ chapterId: ch._id }, { $set: { status: "completed" } });
    await pushChapterTranslationVersion(ch, req.user, "published");
    res.json({ chapter: ch });
  } catch (e) {
    next(e);
  }
}

export async function rejectChapterTranslation(req, res, next) {
  try {
    const { note } = req.body;
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    if (ch.translationStatus !== "pending_review") {
      return res.status(400).json({ error: "Chapter is not pending review" });
    }
    ch.translationStatus = "rejected";
    ch.moderationNote = typeof note === "string" ? note.slice(0, 2000) : "Please revise.";
    await ch.save();
    await TranslatorAssignment.findOneAndUpdate({ chapterId: ch._id }, { $set: { status: "assigned" } });
    res.json({ chapter: ch });
  } catch (e) {
    next(e);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const mangaByViews = await Manga.find({ status: "published" })
      .sort({ viewCount: -1 })
      .limit(20)
      .select("title viewCount trendingScore updatedAt")
      .lean();
    const topChapters = await Chapter.find({ readCount: { $gt: 0 } })
      .sort({ readCount: -1 })
      .limit(20)
      .select("number title readCount mangaId")
      .populate("mangaId", "title")
      .lean();
    const translatorPerformance = await TranslatorAssignment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$translatorId", completedChapters: { $sum: 1 } } },
      { $sort: { completedChapters: -1 } },
      { $limit: 30 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          translatorId: "$_id",
          completedChapters: 1,
          email: "$u.email",
          displayName: "$u.displayName",
        },
      },
    ]);
    res.json({ mangaByViews, topChapters, translatorPerformance });
  } catch (e) {
    next(e);
  }
}
