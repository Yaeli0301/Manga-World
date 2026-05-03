import sharp from "sharp";
import { Chapter } from "../models/Chapter.model.js";
import { Manga } from "../models/Manga.model.js";
import { resolveContentLanguage } from "../utils/contentLanguage.js";
import { assertCanCreateChapter } from "../services/assignmentAccess.service.js";
import { pushChapterTranslationVersion } from "../services/chapterVersion.service.js";
import { uploadBufferToStorage, optimizeImageBuffer } from "../services/upload.service.js";
import { chapterViewerPayload } from "../services/chapterViewer.service.js";

export async function getChapter(req, res, next) {
  try {
    const lang = resolveContentLanguage(req);
    const payload = await chapterViewerPayload(req.params.id, req.user, lang);
    if (!payload) return res.status(404).json({ error: "Not found" });
    res.json({ chapter: payload.chapter, manga: payload.manga });
  } catch (e) {
    next(e);
  }
}

export async function listByManga(req, res, next) {
  try {
    const chapters = await Chapter.find({ mangaId: req.params.mangaId }).sort({ number: 1 }).lean();
    /** Raw titles for translator tools + reader chapter order (IDs only); UI lists use manga detail. */
    res.json({ items: chapters });
  } catch (e) {
    next(e);
  }
}

const ALL_TR = ["none", "draft", "pending_review", "published", "rejected"];

export async function updateChapter(req, res, next) {
  try {
    const { title, titleHe, isPremiumOnly, translationStatus, translationDraft, moderationNote, pageHeOverlays } = req.body;
    const ch = await Chapter.findById(req.params.id);
    if (!ch) return res.status(404).json({ error: "Not found" });
    const isAdmin = req.user.roles?.includes("admin");
    const versionTrigger =
      titleHe !== undefined ||
      translationDraft !== undefined ||
      Array.isArray(pageHeOverlays) ||
      (translationStatus !== undefined && translationStatus !== ch.translationStatus);

    if (title !== undefined) ch.title = title;
    if (titleHe !== undefined) ch.titleHe = titleHe;
    if (typeof isPremiumOnly === "boolean" && isAdmin) ch.isPremiumOnly = isPremiumOnly;
    if (translationDraft !== undefined) ch.translationDraft = translationDraft;
    if (moderationNote !== undefined && isAdmin) ch.moderationNote = moderationNote;
    if (translationStatus !== undefined && ALL_TR.includes(translationStatus)) {
      if (isAdmin) ch.translationStatus = translationStatus;
      else if (["none", "draft", "rejected"].includes(translationStatus)) ch.translationStatus = translationStatus;
    }
    if (Array.isArray(pageHeOverlays)) {
      for (const o of pageHeOverlays) {
        if (!Number.isFinite(Number(o.index))) continue;
        const pg = ch.pages.find((p) => p.index === Number(o.index));
        if (pg && typeof o.imageUrlHe === "string") pg.imageUrlHe = o.imageUrlHe;
      }
    }
    await ch.save();
    if (versionTrigger) {
      await pushChapterTranslationVersion(ch, req.user, "draft_save");
    }
    res.json({ chapter: ch });
  } catch (e) {
    next(e);
  }
}

export async function createChapterWithPages(req, res, next) {
  try {
    const { mangaId } = req.params;
    const gate = await assertCanCreateChapter(req.user, mangaId);
    if (!gate.ok) return res.status(gate.code || 403).json({ error: gate.error });
    const { number, title, pages } = req.body;
    if (!number || !Array.isArray(pages) || !pages.length) {
      return res.status(400).json({ error: "number and pages[] required" });
    }
    const isAdmin = req.user.roles?.includes("admin");
    let translationStatus = "none";
    if (!isAdmin) translationStatus = "draft";
    else if (ALL_TR.includes(req.body?.translationStatus)) translationStatus = req.body.translationStatus;
    const ch = await Chapter.create({ mangaId, number, title: title || "", pages, translationStatus });
    res.status(201).json({ chapter: ch });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "Chapter number exists" });
    next(e);
  }
}

/** Ordered multipart images → one chapter (same order as files in the request). */
export async function createChapterFromImages(req, res, next) {
  try {
    const { mangaId } = req.params;
    const gate = await assertCanCreateChapter(req.user, mangaId);
    if (!gate.ok) return res.status(gate.code || 403).json({ error: gate.error });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "At least one image file required" });

    const isAdmin = req.user.roles?.includes("admin");
    const translationStatus = isAdmin ? "none" : "draft";

    let number = Number(req.body?.number);
    if (!Number.isFinite(number) || number < 1) {
      const last = await Chapter.findOne({ mangaId }).sort({ number: -1 }).lean();
      number = last ? last.number + 1 : 1;
    }
    const title = typeof req.body?.title === "string" ? req.body.title.slice(0, 500).trim() : "";

    const pages = [];
    let index = 0;
    for (const file of files) {
      const optimized = await optimizeImageBuffer(file.buffer);
      const { url } = await uploadBufferToStorage(optimized, {
        folder: `manga/${mangaId}/ch${number}`,
        publicId: `p_${index}`,
      });
      const meta = await sharp(optimized).metadata();
      pages.push({ index, imageUrl: url, width: meta.width, height: meta.height });
      index += 1;
    }

    const ch = await Chapter.create({ mangaId, number, title: title || `Chapter ${number}`, pages, translationStatus });
    await Manga.findByIdAndUpdate(mangaId, { updatedAt: new Date() });
    res.status(201).json({ chapter: ch });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "Chapter number exists" });
    next(e);
  }
}
