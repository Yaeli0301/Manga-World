import { Chapter } from "../models/Chapter.model.js";
import { Manga } from "../models/Manga.model.js";
import { TranslatorAssignment } from "../models/TranslatorAssignment.model.js";

/**
 * Reader = `user` role (+ optional `premium`). Translator / admin checked explicitly.
 */
export async function assertCanEditChapter(user, chapterId) {
  const roles = user.roles || [];
  if (roles.includes("admin")) return { ok: true };
  const ch = await Chapter.findById(chapterId).select("mangaId translationStatus").lean();
  if (!ch) return { ok: false, code: 404, error: "Not found" };
  if (["pending_review", "published"].includes(ch.translationStatus)) {
    return { ok: false, code: 403, error: "Chapter is read-only until admin action" };
  }
  if (!roles.includes("translator")) return { ok: false, code: 403, error: "Forbidden" };
  const manga = await Manga.findById(ch.mangaId).select("createdBy").lean();
  if (manga?.createdBy?.toString() === user.id) return { ok: true };
  const a = await TranslatorAssignment.findOne({ chapterId: ch._id, translatorId: user.id }).lean();
  if (a && ["assigned"].includes(a.status)) return { ok: true };
  if (a && a.status === "submitted") {
    return { ok: false, code: 403, error: "Chapter is awaiting admin review" };
  }
  if (a && a.status === "completed") return { ok: false, code: 403, error: "Assignment completed" };
  return { ok: false, code: 403, error: "No assignment for this chapter" };
}

/** View versions / compare: admin, series owner, or anyone assigned to this chapter (any status). */
export async function assertCanViewChapterWorkspace(user, chapterId) {
  const roles = user.roles || [];
  if (roles.includes("admin")) return { ok: true };
  const ch = await Chapter.findById(chapterId).select("mangaId").lean();
  if (!ch) return { ok: false, code: 404, error: "Not found" };
  const manga = await Manga.findById(ch.mangaId).select("createdBy").lean();
  if (manga?.createdBy?.toString() === user.id) return { ok: true };
  if (roles.includes("translator")) {
    const a = await TranslatorAssignment.findOne({ chapterId: ch._id, translatorId: user.id }).lean();
    if (a) return { ok: true };
  }
  return { ok: false, code: 403, error: "Forbidden" };
}

export async function assertCanUseTranslationTools(user, mangaId) {
  const roles = user.roles || [];
  if (roles.includes("admin")) return { ok: true };
  const m = await Manga.findById(mangaId).select("createdBy").lean();
  if (!m) return { ok: false, code: 404, error: "Not found" };
  if (!roles.includes("translator")) return { ok: false, code: 403, error: "Forbidden" };
  if (m.createdBy?.toString() === user.id) return { ok: true };
  const count = await TranslatorAssignment.countDocuments({ mangaId: m._id, translatorId: user.id });
  if (count > 0) return { ok: true };
  return { ok: false, code: 403, error: "No assignment on this series" };
}

export async function assertCanCreateChapter(user, mangaId) {
  const roles = user.roles || [];
  if (roles.includes("admin")) return { ok: true };
  const m = await Manga.findById(mangaId).select("createdBy status").lean();
  if (!m) return { ok: false, code: 404, error: "Not found" };
  if (!roles.includes("translator")) return { ok: false, code: 403, error: "Forbidden" };
  if (!["draft", "rejected"].includes(m.status)) {
    return {
      ok: false,
      code: 403,
      error: "Uploads are locked while the series is pending review or already published",
    };
  }
  if (m.createdBy?.toString() === user.id) return { ok: true };
  return { ok: false, code: 403, error: "Only the series owner or admin can create chapters" };
}
