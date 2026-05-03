import mongoose from "mongoose";

const chapterTranslationVersionSchema = new mongoose.Schema(
  {
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    label: { type: String, enum: ["draft_save", "submitted", "published"], required: true },
    title: { type: String, default: "" },
    titleHe: { type: String, default: "" },
    translationDraft: { type: String, default: "" },
    translationStatus: { type: String, default: "" },
    pages: { type: mongoose.Schema.Types.Mixed, default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

chapterTranslationVersionSchema.index({ chapterId: 1, createdAt: -1 });

export const ChapterTranslationVersion = mongoose.model("ChapterTranslationVersion", chapterTranslationVersionSchema);
