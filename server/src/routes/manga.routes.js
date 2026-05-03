import { Router } from "express";
import * as manga from "../controllers/manga.controller.js";
import * as mangaRating from "../controllers/mangaRating.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";

const r = Router();

r.get("/", optionalAuthMiddleware, manga.listManga);
r.get("/meta/genres", optionalAuthMiddleware, manga.listGenres);
r.get("/trending", optionalAuthMiddleware, manga.trending);
r.get("/pending", authMiddleware, requireRoles("admin"), manga.listPending);
r.get("/favorites", authMiddleware, manga.listFavorites);
r.get("/my-work", authMiddleware, requireRoles("translator", "admin"), manga.listMyWork);
r.get("/:id/ratings", optionalAuthMiddleware, mangaRating.getRatings);
r.put("/:id/ratings/me", authMiddleware, mangaRating.putMine);
r.delete("/:id/ratings/me", authMiddleware, mangaRating.deleteMine);
r.post("/:id/submit-for-review", authMiddleware, requireRoles("translator", "admin"), manga.submitForReview);
r.get("/:id", optionalAuthMiddleware, manga.getManga);
r.post("/", authMiddleware, requireRoles("translator", "admin"), manga.createManga);
r.post("/:id/favorite", authMiddleware, manga.toggleFavorite);
r.post("/:id/metadata-ai", authMiddleware, requireRoles("translator", "admin"), manga.runMetadataAi);
r.patch("/:id/status", authMiddleware, requireRoles("admin"), manga.setMangaStatus);
r.delete("/:id", authMiddleware, requireRoles("admin"), manga.deleteManga);

export default r;
