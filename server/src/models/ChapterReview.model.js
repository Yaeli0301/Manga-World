import mongoose from "mongoose";

/** User reaction to a single chapter (stars, short comment, quick emoji) — not whole-series. */
const chapterReviewSchema = new mongoose.Schema(
  {
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stars: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 2000 },
    emoji: { type: String, default: "", maxlength: 32 },
  },
  { timestamps: true }
);

chapterReviewSchema.index({ chapterId: 1, userId: 1 }, { unique: true });

export const ChapterReview = mongoose.model("ChapterReview", chapterReviewSchema);
