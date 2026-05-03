import OpenAI from "openai";

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function runChatCompletion({ system, user, model = "gpt-4o-mini" }) {
  const c = getClient();
  if (!c) {
    return { content: "", mock: true };
  }
  const res = await c.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
  });
  const content = res.choices[0]?.message?.content?.trim() || "";
  return { content, mock: false };
}

/** Turn a natural-language or mood phrase into searchable keywords + fuzzy genre hints. */
export async function naturalLanguageCatalogIntent(query) {
  const q = String(query || "").trim().slice(0, 600);
  if (!q.length) return { keywords: [], moodTags: [], mock: false };
  const system =
    "You help users find manga/comics. Reply ONLY JSON: {\"keywords\":[\"word\"],\"moodTags\":[\"cozy\"]}. keywords: 2-8 English/root tokens; moodTags: 0-4 short English tags.";
  const { content, mock } = await runChatCompletion({ system, user: q });
  if (mock) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    return { keywords: words.length ? words : ["manga"], moodTags: ["explore"], mock: true };
  }
  try {
    const parsed = JSON.parse(content.replace(/^```json\n?|```$/g, "").trim());
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
      moodTags: Array.isArray(parsed.moodTags) ? parsed.moodTags.map(String) : [],
      mock: false,
    };
  } catch {
    return { keywords: [q.slice(0, 64)], moodTags: [], mock: false, raw: content };
  }
}

export async function summarizeChapterForReaders({ mangaTitle, chapterTitle, excerpt }) {
  const system =
    "Write a concise spoiler-aware neutral summary for a manga chapter teaser (≤120 words). No bullet points.";
  const user = `Series: ${mangaTitle}\nChapter: ${chapterTitle}\nExcerpt/metadata: ${excerpt?.slice?.(0, 4000) || ""}`;
  const { content, mock } = await runChatCompletion({ system, user, model: process.env.CHAPTER_SUMMARY_MODEL || "gpt-4o-mini" });
  if (mock)
    return { summary: `${mangaTitle} — ${chapterTitle}: follow the protagonists through this chapter.` , mock: true };
  return { summary: content, mock: false };
}

/** Hook for OCR / dialog extraction — integrate Tesseract, Google Vision, or dedicated manga OCR SaaS here. */
export function ocrMangaPanelsStub({ imageUrls = [] }) {
  return {
    mock: true,
    panelsDetected: Math.min(imageUrls.length, 1),
    textRegions: [],
    message: "OCR stub: attach cloud Vision or manga-specific OCR pipeline in server/src/services/ocr.service.js",
  };
}

export async function inferMetadataFromText({ title, description }) {
  const system =
    "You are a manga metadata assistant. Reply ONLY with compact JSON: {\"suggestedTitle\":\"\",\"suggestedGenres\":[\"\"]}. Genres in English lowercase.";
  const user = `Title: ${title}\nDescription: ${description || ""}`;
  const { content, mock } = await runChatCompletion({ system, user });
  if (mock) {
    return {
      suggestedTitle: title,
      suggestedGenres: ["action", "fantasy"],
      mock: true,
    };
  }
  try {
    const parsed = JSON.parse(content.replace(/^```json\n?|```$/g, "").trim());
    return {
      suggestedTitle: parsed.suggestedTitle || title,
      suggestedGenres: Array.isArray(parsed.suggestedGenres) ? parsed.suggestedGenres : [],
      mock: false,
    };
  } catch {
    return { suggestedTitle: title, suggestedGenres: ["drama"], mock: false, raw: content };
  }
}
