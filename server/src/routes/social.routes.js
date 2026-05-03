import { Router } from "express";
import * as social from "../controllers/social.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";

const r = Router();

r.get("/chapters/:chapterId/comments", optionalAuthMiddleware, social.listChapterComments);
r.post("/chapters/:chapterId/comments", authMiddleware, social.addChapterComment);
r.post("/comments/:commentId/like", authMiddleware, social.toggleCommentLike);

export default r;
