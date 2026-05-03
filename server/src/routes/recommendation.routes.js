import { Router } from "express";
import * as rec from "../controllers/recommendation.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const r = Router();
r.use(authMiddleware);

r.get("/for-you", rec.forYou);
r.get("/explain", rec.explain);

export default r;
