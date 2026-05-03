import { uploadBufferToStorage, optimizeImageBuffer } from "../services/upload.service.js";

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const optimized = await optimizeImageBuffer(req.file.buffer);
    const folder = req.body.folder || "misc";
    const { url, provider } = await uploadBufferToStorage(optimized, { folder });
    res.json({ url, provider });
  } catch (e) {
    next(e);
  }
}

export async function uploadMulti(req, res, next) {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "files required" });
    const folder = req.body.folder || "misc";
    const urls = [];
    for (const f of files) {
      const optimized = await optimizeImageBuffer(f.buffer);
      const { url } = await uploadBufferToStorage(optimized, { folder });
      urls.push(url);
    }
    res.json({ urls });
  } catch (e) {
    next(e);
  }
}
