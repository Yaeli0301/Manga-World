import { Router } from "express";
import multer from "multer";
import * as bulk from "../controllers/bulkUpload.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";

const zipMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const r = Router();
r.use(authMiddleware);
r.use(requireRoles("translator", "admin"));

r.post("/preview", zipMw.single("file"), bulk.previewZip);
r.post("/manga/:mangaId", zipMw.single("file"), bulk.bulkIngest);

export default r;
