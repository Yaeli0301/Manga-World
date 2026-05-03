import { Chapter } from "../models/Chapter.model.js";
import { Manga } from "../models/Manga.model.js";
import { TranslatorAssignment } from "../models/TranslatorAssignment.model.js";
import { ChapterTranslationVersion } from "../models/ChapterTranslationVersion.model.js";
import { translateText } from "../services/translation.service.js";
import { assertCanUseTranslationTools } from "../services/assignmentAccess.service.js";
import { pushChapterTranslationVersion } from "../services/chapterVersion.service.js";

export async function translateMangaFields(req, res, next) {
  try {
    const m = await Manga.findById(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    const gate = await assertCanUseTranslationTools(req.user, m._id);
    if (!gate.ok) return res.status(gate.code || 403).json({ error: gate.error });
    const { from = "en", to = "he" } = req.body;
    const titleHe = await translateText({ text: m.title, from, to });
    const descHe = await translateText({ text: m.description || "", from, to });
    m.titleHe = titleHe.translated;
    m.descriptionHe = descHe.translated;
    await m.save();
    res.json({ titleHe: m.titleHe, descriptionHe: m.descriptionHe, mock: titleHe.mock });
  } catch (e) {
    next(e);
  }
}

export async function translateChapterDraft(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    const { from = "en", to = "he", publish } = req.body;
    const titleSrc = ch.title?.trim() || `Chapter ${ch.number}`;
    const titleHe = await translateText({ text: titleSrc, from, to });
    ch.titleHe = titleHe.translated;
    if (ch.translationStatus !== "published" && ch.translationStatus !== "pending_review") {
      ch.translationStatus = "draft";
    }
    await ch.save();
    res.json({ chapter: ch, mock: titleHe.mock });
  } catch (e) {
    next(e);
  }
}

/** @deprecated Use PATCH /api/translate/chapter/:id (same as PATCH /api/chapters/:id). */
export async function saveChapterTranslation(req, res, next) {
  try {
    const { titleHe, translationDraft, translationStatus } = req.body;
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    if (titleHe !== undefined) ch.titleHe = titleHe;
    if (translationDraft !== undefined) ch.translationDraft = translationDraft;
    if (translationStatus !== undefined && req.user.roles?.includes("admin")) {
      if (["none", "draft", "pending_review", "published", "rejected"].includes(translationStatus)) {
        ch.translationStatus = translationStatus;
      }
    }
    await ch.save();
    await pushChapterTranslationVersion(ch, req.user, "draft_save");
    res.json({ chapter: ch });
  } catch (e) {
    next(e);
  }
}

export async function listMyAssignments(req, res, next) {
  try {
    const rows = await TranslatorAssignment.find({ translatorId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate("mangaId", "title titleHe coverUrl status")
      .populate("chapterId", "number title titleHe translationStatus")
      .lean();
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
}

export async function submitChapterForReview(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    const assign = await TranslatorAssignment.findOne({ chapterId: ch._id, translatorId: req.user.id });
    const manga = await Manga.findById(ch.mangaId).select("createdBy").lean();
    const isOwner = manga?.createdBy?.toString() === req.user.id;
    if (!req.user.roles?.includes("admin") && !assign && !isOwner) {
      return res.status(403).json({ error: "No assignment for this chapter" });
    }
    if (assign && assign.status !== "assigned") {
      return res.status(400).json({ error: "Chapter is not in an editable assignment state" });
    }
    ch.translationStatus = "pending_review";
    ch.moderationNote = "";
    await ch.save();
    if (assign) {
      assign.status = "submitted";
      await assign.save();
    }
    await pushChapterTranslationVersion(ch, req.user, "submitted");
    res.json({ chapter: ch });
  } catch (e) {
    next(e);
  }
}

export async function listChapterVersions(req, res, next) {
  try {
    const items = await ChapterTranslationVersion.find({ chapterId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(40)
      .populate("createdBy", "email displayName")
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
}

export async function compareChapterTranslation(req, res, next) {
  try {
    const ch = await Chapter.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ error: "Not found" });
    const original = (ch.pages || []).map((p) => ({ index: p.index, imageUrl: p.imageUrl }));
    const localized = (ch.pages || []).map((p) => ({
      index: p.index,
      imageUrl: p.imageUrlHe?.trim() ? p.imageUrlHe : p.imageUrl,
    }));
    res.json({
      title: ch.title,
      titleHe: ch.titleHe,
      translationDraft: ch.translationDraft,
      translationStatus: ch.translationStatus,
      originalPages: original,
      localizedPages: localized,
    });
  } catch (e) {
    next(e);
  }
}
