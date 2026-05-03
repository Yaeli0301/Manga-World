import { assertCanEditChapter } from "../services/assignmentAccess.service.js";

export async function requireChapterEditAccess(req, res, next) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Chapter id required" });
    const gate = await assertCanEditChapter(req.user, id);
    if (!gate.ok) return res.status(gate.code || 403).json({ error: gate.error });
    next();
  } catch (e) {
    next(e);
  }
}
