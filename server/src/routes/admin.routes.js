import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";

const r = Router();
r.use(authMiddleware);
r.use(requireRoles("admin"));

r.get("/stats", admin.dashboardStats);
r.get("/analytics", admin.getAnalytics);
r.get("/manga", admin.listMangaCatalog);
r.patch("/manga/:id", admin.patchManga);
r.post("/manga/bulk-status", admin.bulkSetMangaStatus);
r.get("/users", admin.listUsers);
r.post("/users", admin.createUserAccount);
r.patch("/users/:id/roles", admin.setUserRoles);
r.get("/assignments", admin.listTranslatorAssignments);
r.post("/assignments", admin.upsertTranslatorAssignments);
r.delete("/assignments/:id", admin.deleteTranslatorAssignment);
r.get("/chapters/pending-review", admin.listPendingReviewChapters);
r.post("/chapters/:id/approve-translation", admin.approveChapterTranslation);
r.post("/chapters/:id/reject-translation", admin.rejectChapterTranslation);

export default r;
