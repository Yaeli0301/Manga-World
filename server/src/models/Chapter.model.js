import mongoose from "mongoose";

const pageSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    /** Optional Hebrew (or alternate-locale) page asset; served when user content language is Hebrew. */
    imageUrlHe: { type: String, default: "" },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

const chapterSchema = new mongoose.Schema(
  {
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    number: { type: Number, required: true },
    title: { type: String, default: "" },
    titleHe: { type: String, default: "" },
    pages: [pageSchema],
    translationStatus: {
      type: String,
      enum: ["none", "draft", "pending_review", "published", "rejected"],
      default: "none",
    },
    translationDraft: { type: String, default: "" },
    /** Admin moderation message when translation is rejected. */
    moderationNote: { type: String, default: "" },
    /** Approximate full chapter opens (unlocked reader loads). */
    readCount: { type: Number, default: 0 },
    isPremiumOnly: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chapterSchema.index({ mangaId: 1, number: 1 }, { unique: true });

export const Chapter = mongoose.model("Chapter", chapterSchema);
