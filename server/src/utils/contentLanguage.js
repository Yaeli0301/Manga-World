/**
 * Resolves which language to serve for manga/chapter *content* (titles, descriptions, page art).
 * Priority: X-Content-Language header → logged-in user.language → Accept-Language → "en".
 */
export function resolveContentLanguage(req) {
  const hdr = (req.headers["x-content-language"] || "").toString().toLowerCase().trim();
  if (hdr === "he" || hdr === "en") return hdr;
  if (req.user?.language === "he" || req.user?.language === "en") return req.user.language;
  const accept = (req.headers["accept-language"] || "").toLowerCase();
  if (accept.startsWith("he")) return "he";
  return "en";
}

export function localizeManga(doc, lang) {
  if (!doc || typeof doc !== "object") return doc;
  const title = lang === "he" && doc.titleHe?.trim() ? doc.titleHe.trim() : doc.title;
  const description =
    lang === "he" && doc.descriptionHe?.trim() ? doc.descriptionHe.trim() : doc.description || "";
  return { ...doc, title, description };
}

export function localizeChapterSummary(ch, lang) {
  if (!ch || typeof ch !== "object") return ch;
  const title = lang === "he" && ch.titleHe?.trim() ? ch.titleHe.trim() : ch.title || "";
  return { ...ch, title };
}

/** Reader payload: resolves per-page imageUrl from imageUrlHe when lang is Hebrew. */
export function localizeChapterForReader(ch, lang) {
  if (!ch || typeof ch !== "object") return ch;
  const title = lang === "he" && ch.titleHe?.trim() ? ch.titleHe.trim() : ch.title || "";
  const pages = (ch.pages || []).map((p) => {
    const he = p.imageUrlHe?.trim();
    const imageUrl = lang === "he" && he ? he : p.imageUrl;
    return { ...p, imageUrl };
  });
  return { ...ch, title, pages };
}
