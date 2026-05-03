import { Router } from "express";
import * as analytics from "../controllers/analytics.controller.js";
import { optionalAuthMiddleware } from "../middleware/auth.middleware.js";

const r = Router();

r.post("/event", optionalAuthMiddleware, analytics.track);

export default r;
