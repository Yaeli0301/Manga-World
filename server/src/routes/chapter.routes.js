import { Router } from "express";
import multer from "multer";
import * as chapter from "../controllers/chapter.controller.js";
import * as chapterReview from "../controllers/chapterReview.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { requireChapterEditAccess } from "../middleware/chapterEdit.middleware.js";

const chapterImagesMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
});

const r = Router();

r.get("/manga/:mangaId", chapter.listByManga);
r.post(
  "/manga/:mangaId/from-images",
  authMiddleware,
  requireRoles("translator", "admin"),
  chapterImagesMw.array("files", 40),
  chapter.createChapterFromImages
);
r.patch("/:id", authMiddleware, requireRoles("translator", "admin"), requireChapterEditAccess, chapter.updateChapter);
r.get("/:id/reviews", optionalAuthMiddleware, chapterReview.listReviews);
r.put("/:id/reviews/me", authMiddleware, chapterReview.upsertMine);
r.delete("/:id/reviews/me", authMiddleware, chapterReview.deleteMine);
r.get("/:id", optionalAuthMiddleware, chapter.getChapter);
r.post("/manga/:mangaId", authMiddleware, requireRoles("translator", "admin"), chapter.createChapterWithPages);

export default r;
