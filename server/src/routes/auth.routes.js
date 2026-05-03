import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const r = Router();

r.post("/register", auth.register);
r.post("/login", auth.login);
r.post("/refresh", auth.refresh);
r.post("/logout", auth.logoutRefresh);
r.get("/me", authMiddleware, auth.me);
r.patch("/me", authMiddleware, auth.updateProfile);

export default r;
