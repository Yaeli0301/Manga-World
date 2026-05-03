import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as aiCtrl from "../controllers/ai.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.AI_ROUTE_MAX_PER_MIN) || 30 });

const r = Router();

r.use(aiLimiter);
r.post("/suggest-metadata", authMiddleware, aiCtrl.suggestMetadata);
/** Natural-language discovery over the published catalog — safe for optionally anonymous callers. */
r.post("/natural-search", optionalAuthMiddleware, aiCtrl.naturalLanguageSearch);
r.get("/summarize/:chapterId", optionalAuthMiddleware, aiCtrl.summarizeChapter);

export default r;
