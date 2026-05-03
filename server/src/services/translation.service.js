import { runChatCompletion } from "./ai.service.js";

export async function translateText({ text, from, to }) {
  if (!text?.trim()) return { translated: "", mock: true };
  const system = `You are a professional manga/comics translator. Preserve tone, SFX context, and line breaks. Translate from ${from} to ${to}. Output ONLY the translation, no quotes.`;
  const { content, mock } = await runChatCompletion({
    system,
    user: text,
  });
  return { translated: content || text, mock };
}

export async function translateChapterPages({ pages, from, to }) {
  const blocks = pages.map((p, i) => `[[PAGE_${i}]]`).join("\n");
  const { content, mock } = await runChatCompletion({
    system: `Translate OCR-like placeholders for a chapter. Input has markers [[PAGE_i]]. Return same markers with short translated captions if any text; if image-only reply markers unchanged. From ${from} to ${to}.`,
    user: blocks,
  });
  return { result: content, mock };
}
