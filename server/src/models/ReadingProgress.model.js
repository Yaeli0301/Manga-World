import mongoose from "mongoose";

const readingProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    pageIndex: { type: Number, default: 0 },
    scrollPositionY: { type: Number, default: 0 },
    readingMode: { type: String, enum: ["paged", "vertical"], default: "vertical" },
    updatedAtSnapshot: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

readingProgressSchema.index({ userId: 1, mangaId: 1 }, { unique: true });

export const ReadingProgress = mongoose.model("ReadingProgress", readingProgressSchema);
