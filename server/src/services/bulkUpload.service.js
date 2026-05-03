import AdmZip from "adm-zip";
import path from "path";
import sharp from "sharp";
import { uploadBufferToStorage, optimizeImageBuffer } from "./upload.service.js";
import { Chapter } from "../models/Chapter.model.js";
import { Manga } from "../models/Manga.model.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function isImage(name) {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXT.has(ext);
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Parse zip: top-level folders = chapters, or flat list = single chapter.
 * Returns { chapters: [{ folder, files: [{ name, buffer }] }] }
 */
export function parseZipStructure(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((e) => !e.isDirectory && isImage(e.entryName));

  const byFolder = new Map();
  for (const e of entries) {
    const parts = e.entryName.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : "__root__";
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push({ name: path.basename(e.entryName), buffer: e.getData() });
  }

  const folders = [...byFolder.keys()].sort(naturalSort);
  const chapters = folders.map((folder, idx) => {
    const files = byFolder.get(folder).sort((a, b) => naturalSort(a.name, b.name));
    return { folder, order: folder === "__root__" ? 0 : idx + 1, files };
  });

  if (chapters.length === 1 && chapters[0].folder === "__root__") {
    return { mode: "single", chapters: [{ folder: "Chapter 1", order: 1, files: chapters[0].files }] };
  }
  return { mode: "multi", chapters: chapters.map((c, i) => ({ ...c, order: i + 1 })) };
}

export async function persistBulkChapters({ mangaId, zipBuffer, startChapterNumber = 1, translationStatus = "none" }) {
  const { chapters } = parseZipStructure(zipBuffer);
  const created = [];
  let chapterNum = startChapterNumber;
  for (const ch of chapters) {
    const pages = [];
    let index = 0;
    for (const file of ch.files) {
      const optimized = await optimizeImageBuffer(file.buffer);
      const { url } = await uploadBufferToStorage(optimized, {
        folder: `manga/${mangaId}/ch${chapterNum}`,
        publicId: `p_${index}`,
      });
      const meta = await sharp(optimized).metadata();
      pages.push({ index, imageUrl: url, width: meta.width, height: meta.height });
      index += 1;
    }
    const doc = await Chapter.create({
      mangaId,
      number: chapterNum,
      title: ch.folder || `Chapter ${chapterNum}`,
      pages,
      translationStatus,
    });
    created.push(doc);
    chapterNum += 1;
  }
  await Manga.findByIdAndUpdate(mangaId, { updatedAt: new Date() });
  return created;
}
