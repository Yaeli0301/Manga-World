import mongoose from "mongoose";

/** Lightweight ingestion for reader funnels — partition by TTL in Atlas or periodic cleanup job. */
const analyticsEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
      maxlength: 64,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga" },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ createdAt: -1 });

export const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);
