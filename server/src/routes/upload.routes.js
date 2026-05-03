import { Router } from "express";
import multer from "multer";
import * as upload from "../controllers/upload.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";

const uploadMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
});

const r = Router();
r.use(authMiddleware);
r.use(requireRoles("translator", "admin"));

r.post("/image", uploadMw.single("file"), upload.uploadImage);
r.post("/images", uploadMw.array("files", 40), upload.uploadMulti);

export default r;
