import { Chapter } from "../models/Chapter.model.js";
import { Manga } from "../models/Manga.model.js";
import { User } from "../models/User.model.js";
import { localizeChapterForReader, localizeManga } from "../utils/contentLanguage.js";

/** @typedef {{ id: string, roles?: string[], email?: string, language?: string }} Viewer */

/**
 * @param {string} chapterId
 * @param {Viewer | null} viewer
 * @param {"en" | "he" | undefined} langOverride From `X-Content-Language`-equivalent header.
 */
export async function chapterViewerPayload(chapterId, viewer, langOverride) {
  const ch = await Chapter.findById(chapterId).lean();
  if (!ch) return null;
  const manga = await Manga.findById(ch.mangaId).lean();
  if (!manga) return null;

  let lang =
    langOverride === "he" || langOverride === "en"
      ? langOverride
      : viewer?.language === "he" || viewer?.language === "en"
        ? viewer.language
        : "en";

  const isPremiumUser = viewer?.roles?.some((r) => ["premium", "admin"].includes(r));
  const isPremiumChapter = ch.isPremiumOnly || Boolean(manga.isPremiumOnly);

  let isFavorite = false;
  if (viewer?.id) {
    const u = await User.findById(viewer.id).select("favorites").lean();
    isFavorite = Boolean(u?.favorites?.some((fid) => String(fid) === String(manga._id)));
  }

  if (isPremiumChapter && !isPremiumUser) {
    const chLocked = localizeChapterForReader({ ...ch, pages: ch.pages.slice(0, 2) }, lang);
    return {
      locked: true,
      chapter: { ...chLocked, locked: true },
      manga: { title: localizeManga(manga, lang).title, id: manga._id, _id: manga._id, isFavorite },
    };
  }
  void Chapter.updateOne({ _id: ch._id }, { $inc: { readCount: 1 } }).catch(() => {});
  const mg = localizeManga(manga, lang);
  return {
    locked: false,
    chapter: { ...localizeChapterForReader(ch, lang), locked: false },
    manga: { ...mg, isFavorite },
  };
}
