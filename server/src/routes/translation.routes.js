import { Router } from "express";
import * as tr from "../controllers/translation.controller.js";
import * as chapter from "../controllers/chapter.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { requireChapterEditAccess } from "../middleware/chapterEdit.middleware.js";
import { requireChapterWorkspaceAccess } from "../middleware/chapterWorkspace.middleware.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRoles("translator", "admin"));

r.get("/my-assignments", tr.listMyAssignments);
r.post("/manga/:id", tr.translateMangaFields);
r.post("/chapter/:id/draft", requireChapterEditAccess, tr.translateChapterDraft);
r.patch("/chapter/:id", requireChapterEditAccess, chapter.updateChapter);
r.post("/chapter/:id/submit-review", requireChapterEditAccess, tr.submitChapterForReview);
r.get("/chapter/:id/versions", requireChapterWorkspaceAccess, tr.listChapterVersions);
r.get("/chapter/:id/compare", requireChapterWorkspaceAccess, tr.compareChapterTranslation);

export default r;
