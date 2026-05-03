import mongoose from "mongoose";

const chapterCommentSchema = new mongoose.Schema(
  {
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    /** User IDs who liked (capped uniqueness via $addToSet in controller). */
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

chapterCommentSchema.index({ chapterId: 1, createdAt: -1 });

export const ChapterComment = mongoose.model("ChapterComment", chapterCommentSchema);
