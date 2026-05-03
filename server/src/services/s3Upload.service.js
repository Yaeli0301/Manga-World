import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export function isS3Configured() {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION
  );
}

function getClient() {
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function publicObjectUrl(key) {
  const custom = process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (custom) return `${custom}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadBufferToS3(buffer, { folder = "manga", publicId, contentType = "image/webp" } = {}) {
  const id = publicId || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeFolder = folder.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
  const key = `${safeFolder}/${id}.webp`;
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return { url: publicObjectUrl(key), provider: "s3", key };
}
