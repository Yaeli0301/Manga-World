import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { uploadBufferToS3, isS3Configured } from "./s3Upload.service.js";

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
    return true;
  }
  return false;
}

export async function uploadBufferToStorage(buffer, { folder = "manga", publicId } = {}) {
  if (isS3Configured()) {
    return uploadBufferToS3(buffer, { folder, publicId, contentType: "image/webp" });
  }
  const useCloud = configureCloudinary();
  if (useCloud) {
    const res = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: publicId, resource_type: "image" },
        (err, out) => (err ? reject(err) : resolve(out))
      );
      stream.end(buffer);
    });
    return { url: res.secure_url, provider: "cloudinary" };
  }
  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  await fs.mkdir(uploadsDir, { recursive: true });
  const id = publicId || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const filePath = path.join(uploadsDir, `${id}.webp`);
  await sharp(buffer).webp({ quality: 82 }).toFile(filePath);
  const publicPath = `/uploads/${folder}/${id}.webp`.replace(/\\/g, "/");
  return { url: publicPath, provider: "local" };
}

export async function optimizeImageBuffer(buffer) {
  return sharp(buffer).rotate().webp({ quality: 82 }).toBuffer();
}

export function localStaticMountPath() {
  return path.join(process.cwd(), "uploads");
}
