import mongoose from "mongoose";

/** One row per user per manga — whole-series star rating (1–5). */
const mangaRatingSchema = new mongoose.Schema(
  {
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

mangaRatingSchema.index({ mangaId: 1, userId: 1 }, { unique: true });

export const MangaRating = mongoose.model("MangaRating", mangaRatingSchema);
