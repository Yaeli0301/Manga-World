import mongoose from "mongoose";

const STATUSES = ["assigned", "submitted", "completed"];

const translatorAssignmentSchema = new mongoose.Schema(
  {
    translatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    mangaId: { type: mongoose.Schema.Types.ObjectId, ref: "Manga", required: true, index: true },
    status: { type: String, enum: STATUSES, default: "assigned" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

translatorAssignmentSchema.index({ chapterId: 1 }, { unique: true });

export const TranslatorAssignment = mongoose.model("TranslatorAssignment", translatorAssignmentSchema);
export { STATUSES as ASSIGNMENT_STATUSES };
