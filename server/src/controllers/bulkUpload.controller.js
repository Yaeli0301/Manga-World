import { persistBulkChapters, parseZipStructure } from "../services/bulkUpload.service.js";
import { Manga } from "../models/Manga.model.js";
import { Chapter } from "../models/Chapter.model.js";
import { assertCanCreateChapter } from "../services/assignmentAccess.service.js";

export async function previewZip(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: "zip file required" });
    const structure = parseZipStructure(req.file.buffer);
    res.json({
      mode: structure.mode,
      chapters: structure.chapters.map((c) => ({
        folder: c.folder,
        order: c.order,
        pageCount: c.files.length,
      })),
    });
  } catch (e) {
    next(e);
  }
}

export async function bulkIngest(req, res, next) {
  try {
    const { mangaId } = req.params;
    if (!req.file) return res.status(400).json({ error: "zip file required" });
    const gate = await assertCanCreateChapter(req.user, mangaId);
    if (!gate.ok) return res.status(gate.code || 403).json({ error: gate.error });
    const manga = await Manga.findById(mangaId);
    if (!manga) return res.status(404).json({ error: "Manga not found" });
    const last = await Chapter.findOne({ mangaId }).sort({ number: -1 }).lean();
    const start = last ? last.number + 1 : 1;
    const isAdmin = req.user.roles?.includes("admin");
    const translationStatus = isAdmin ? "none" : "draft";
    const created = await persistBulkChapters({
      mangaId,
      zipBuffer: req.file.buffer,
      startChapterNumber: start,
      translationStatus,
    });
    res.status(201).json({ chapters: created.map((c) => ({ id: c._id, number: c.number, pages: c.pages.length })) });
  } catch (e) {
    next(e);
  }
}
