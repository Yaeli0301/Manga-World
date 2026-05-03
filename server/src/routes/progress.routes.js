import { Router } from "express";
import * as progress from "../controllers/progress.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const r = Router();

r.use(authMiddleware);
r.put("/", progress.putProgress);
r.get("/stats", progress.getStats);
r.get("/manga/:mangaId", progress.getProgress);
r.get("/", progress.listProgress);

export default r;
