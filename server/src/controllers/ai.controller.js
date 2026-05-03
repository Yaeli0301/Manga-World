import { Manga } from "../models/Manga.model.js";
import { Chapter } from "../models/Chapter.model.js";
import { inferMetadataFromText, naturalLanguageCatalogIntent, summarizeChapterForReaders } from "../services/ai.service.js";
import { escapeRegex } from "../utils/string.js";

export async function suggestMetadata(req, res, next) {
  try {
    const out = await inferMetadataFromText({ title: req.body?.title || "", description: req.body?.description || "" });
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function naturalLanguageSearch(req, res, next) {
  try {
    const q = String(req.body?.q ?? req.query.q ?? "").trim().slice(0, 600);
    if (!q) return res.status(400).json({ error: "q required" });
    const intent = await naturalLanguageCatalogIntent(q);
    const terms = [...new Set([...(intent.keywords || []), ...(intent.moodTags || [])].map((s) => String(s).trim()).filter(Boolean))]
      .slice(0, 12);
    const perTerm =
      terms.length > 0
        ? terms.map((kw) => {
            const safe = escapeRegex(kw.slice(0, 80));
            const rx = new RegExp(safe, "i");
            return {
              $or: [{ title: rx }, { description: rx }, { genres: kw.toLowerCase() }],
            };
          })
        : [];
    const fallbackRx = new RegExp(escapeRegex(q.slice(0, 140)), "i");
    let filter =
      perTerm.length === 1
        ? { status: "published", ...perTerm[0] }
        : perTerm.length > 1
          ? { status: "published", $or: perTerm }
          : {
              status: "published",
              $or: [{ title: fallbackRx }, { description: fallbackRx }],
            };
    let items = await Manga.find(filter).sort({ trendingScore: -1 }).limit(40).select("title coverUrl genres description").lean();
    if (!items.length) {
      items = await Manga.find({
        status: "published",
        $or: [{ title: fallbackRx }, { description: fallbackRx }],
      })
        .sort({ trendingScore: -1 })
        .limit(40)
        .select("title coverUrl genres description")
        .lean();
    }
    res.json({ intent, items, count: items.length });
  } catch (e) {
    next(e);
  }
}

export async function summarizeChapter(req, res, next) {
  try {
    const chapterId = req.params.chapterId;
    const ch = await Chapter.findById(chapterId).lean();
    if (!ch) return res.status(404).json({ error: "not found" });
    const manga = await Manga.findById(ch.mangaId).lean();
    const excerptParts = [(ch.pages || []).slice(0, 4).map((p) => p.imageUrl)].flat();
    const excerpt = excerptParts.join(" ");
    const out = await summarizeChapterForReaders({
      mangaTitle: manga?.title || "",
      chapterTitle: ch.title || `Ch.${ch.number}`,
      excerpt,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
}
