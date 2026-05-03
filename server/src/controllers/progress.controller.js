import { ReadingProgress } from "../models/ReadingProgress.model.js";
import { User } from "../models/User.model.js";
import { upsertProgress, getProgressForUser, listProgressForUser } from "../services/progress.service.js";
import { localizeManga, localizeChapterSummary, resolveContentLanguage } from "../utils/contentLanguage.js";

export async function putProgress(req, res, next) {
  try {
    const { mangaId, chapterId, pageIndex, scrollPositionY, readingMode } = req.body;
    if (!mangaId || !chapterId) return res.status(400).json({ error: "mangaId and chapterId required" });
    const doc = await upsertProgress({
      userId: req.user.id,
      mangaId,
      chapterId,
      pageIndex: Number.isFinite(pageIndex) ? pageIndex : 0,
      scrollPositionY: Number.isFinite(scrollPositionY) ? scrollPositionY : 0,
      readingMode: readingMode === "paged" ? "paged" : "vertical",
    });
    res.json({ progress: doc });
  } catch (e) {
    next(e);
  }
}

export async function getProgress(req, res, next) {
  try {
    const { mangaId } = req.params;
    const doc = await getProgressForUser(req.user.id, mangaId);
    res.json({ progress: doc });
  } catch (e) {
    next(e);
  }
}

export async function listProgress(req, res, next) {
  try {
    const lang = resolveContentLanguage(req);
    const items = await listProgressForUser(req.user.id);
    const mapped = items.map((row) => ({
      ...row,
      mangaId:
        row.mangaId && typeof row.mangaId === "object" && row.mangaId.title !== undefined
          ? localizeManga(row.mangaId, lang)
          : row.mangaId,
      chapterId:
        row.chapterId && typeof row.chapterId === "object" && Number.isFinite(Number(row.chapterId.number))
          ? localizeChapterSummary(row.chapterId, lang)
          : row.chapterId,
    }));
    res.json({ items: mapped });
  } catch (e) {
    next(e);
  }
}

export async function getStats(req, res, next) {
  try {
    const u = await User.findById(req.user.id).select("chapterIdsVisited favorites readingStreak").lean();
    const seriesWithProgress = await ReadingProgress.countDocuments({ userId: req.user.id });
    const last = await ReadingProgress.findOne({ userId: req.user.id }).sort({ updatedAt: -1 }).select("updatedAt").lean();
    res.json({
      uniqueChaptersOpened: (u?.chapterIdsVisited || []).length,
      seriesWithProgress,
      favoritesCount: (u?.favorites || []).length,
      readingStreak: u?.readingStreak ?? 0,
      lastReadAt: last?.updatedAt || null,
    });
  } catch (e) {
    next(e);
  }
}
