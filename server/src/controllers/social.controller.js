import mongoose from "mongoose";
import { ChapterComment } from "../models/ChapterComment.model.js";
import { Chapter } from "../models/Chapter.model.js";

export async function listChapterComments(req, res, next) {
  try {
    const chapterId = req.params.chapterId;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    if (!mongoose.isValidObjectId(chapterId)) return res.status(400).json({ error: "invalid chapter id" });
    const items = await ChapterComment.find({ chapterId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "displayName email")
      .lean();
    const mapped = items.map((c) => ({
      id: c._id,
      chapterId: c.chapterId,
      body: c.body,
      likeCount: (c.likes || []).length,
      createdAt: c.createdAt,
      user:
        c.userId && typeof c.userId === "object"
          ? { id: c.userId._id, displayName: c.userId.displayName, email: c.userId.email }
          : null,
    }));
    res.json({ items: mapped });
  } catch (e) {
    next(e);
  }
}

export async function addChapterComment(req, res, next) {
  try {
    const chapterId = req.params.chapterId;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!mongoose.isValidObjectId(chapterId)) return res.status(400).json({ error: "invalid chapter id" });
    if (body.length < 1 || body.length > 4000) return res.status(400).json({ error: "body invalid" });
    const ch = await Chapter.findById(chapterId).select("_id").lean();
    if (!ch) return res.status(404).json({ error: "chapter not found" });
    const doc = await ChapterComment.create({ chapterId, userId: req.user.id, body, likes: [] });
    res.status(201).json({
      comment: {
        id: doc._id,
        chapterId: doc.chapterId,
        body: doc.body,
        likeCount: 0,
        createdAt: doc.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function toggleCommentLike(req, res, next) {
  try {
    const commentId = req.params.commentId;
    if (!mongoose.isValidObjectId(commentId)) return res.status(400).json({ error: "invalid comment id" });
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const c = await ChapterComment.findById(commentId).select("likes").lean();
    if (!c) return res.status(404).json({ error: "not found" });
    const likes = (c.likes || []).map((x) => x.toString());
    const liked = likes.includes(req.user.id);
    await ChapterComment.updateOne(
      { _id: commentId },
      liked ? { $pull: { likes: uid } } : { $addToSet: { likes: uid } }
    );
    const nextCount = liked ? likes.length - 1 : likes.length + 1;
    res.json({ liked: !liked, likeCount: Math.max(0, nextCount) });
  } catch (e) {
    next(e);
  }
}
