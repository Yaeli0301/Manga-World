import { ChapterTranslationVersion } from "../models/ChapterTranslationVersion.model.js";

export async function pushChapterTranslationVersion(chapterDoc, user, label = "draft_save") {
  const pages = (chapterDoc.pages || []).map((p) => ({
    index: p.index,
    imageUrl: p.imageUrl,
    imageUrlHe: p.imageUrlHe || "",
  }));
  await ChapterTranslationVersion.create({
    chapterId: chapterDoc._id,
    mangaId: chapterDoc.mangaId,
    label,
    title: chapterDoc.title || "",
    titleHe: chapterDoc.titleHe || "",
    translationDraft: chapterDoc.translationDraft || "",
    translationStatus: chapterDoc.translationStatus || "",
    pages,
    createdBy: user?.id || undefined,
  });
}
