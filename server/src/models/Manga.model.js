import mongoose from "mongoose";

const mangaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleHe: { type: String, trim: true },
    description: { type: String, default: "" },
    descriptionHe: { type: String, default: "" },
    coverUrl: { type: String, default: "" },
    genres: [{ type: String }],
    status: {
      type: String,
      enum: ["draft", "pending", "published", "rejected"],
      default: "draft",
    },
    author: { type: String, default: "" },
    translatorNotes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    viewCount: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    /** When true, non-premium users cannot read chapters (same lock as per-chapter premium). */
    isPremiumOnly: { type: Boolean, default: false },
    metadataAi: {
      suggestedTitle: String,
      suggestedGenres: [String],
      lastRunAt: Date,
    },
    /** Denormalized from MangaRating for list/sort/filter. */
    averageRating: { type: Number, default: null },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

mangaSchema.index({ title: "text", description: "text" });
mangaSchema.index({ status: 1, trendingScore: -1, updatedAt: -1 });
mangaSchema.index({ genres: 1 });
mangaSchema.index({ status: 1, averageRating: -1, ratingCount: -1 });

export const Manga = mongoose.model("Manga", mangaSchema);
