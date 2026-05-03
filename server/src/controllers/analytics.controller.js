import mongoose from "mongoose";
import { AnalyticsEvent } from "../models/AnalyticsEvent.model.js";

const ALLOWED = new Set(["reader_open", "chapter_view", "search", "checkout_start", "ad_impression"]);

export async function track(req, res, next) {
  try {
    const type = String(req.body?.type || "").trim();
    const metadata = typeof req.body?.metadata === "object" && req.body.metadata ? req.body.metadata : {};
    if (!ALLOWED.has(type)) return res.status(400).json({ error: "invalid type" });
    const mangaId = req.body?.mangaId;
    const chapterId = req.body?.chapterId;
    const doc = {
      type,
      metadata,
    };
    if (req.user?.id) doc.userId = new mongoose.Types.ObjectId(req.user.id);
    if (mangaId && mongoose.isValidObjectId(mangaId)) doc.mangaId = mangaId;
    if (chapterId && mongoose.isValidObjectId(chapterId)) doc.chapterId = chapterId;
    await AnalyticsEvent.create(doc);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
