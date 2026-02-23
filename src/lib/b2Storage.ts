/**
 * Backblaze B2 Storage Client (S3-compatible)
 *
 * Handles all media storage for JHPS video quote system.
 * Uses the S3-compatible API so this can be swapped to any
 * S3-compatible provider (Cloudflare R2, AWS S3, etc.) by
 * changing the env vars.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── S3-Compatible Client ───
const s3Client = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true, // Required for B2
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || "Jhpsfl";

// ─── File path helpers ───
function getLeadMediaPath(leadId: string, filename: string): string {
  return `leads/${leadId}/${filename}`;
}

function getThumbnailPath(leadId: string, filename: string): string {
  return `leads/${leadId}/thumbs/${filename}`;
}

// ─── Upload file to B2 ───
export async function uploadToB2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<{ key: string; size: number }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    key,
    size: buffer.length,
  };
}

// ─── Upload lead media (video or photo) ───
export async function uploadLeadMedia(
  leadId: string,
  file: Buffer,
  originalFilename: string,
  contentType: string
): Promise<{ storagePath: string; fileSize: number }> {
  // Generate unique filename to prevent collisions
  const timestamp = Date.now();
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = getLeadMediaPath(leadId, `${timestamp}-${sanitized}`);

  const result = await uploadToB2(file, key, contentType);

  return {
    storagePath: result.key,
    fileSize: result.size,
  };
}

// ─── Upload thumbnail ───
export async function uploadThumbnail(
  leadId: string,
  file: Buffer,
  filename: string
): Promise<string> {
  const key = getThumbnailPath(leadId, filename);
  await uploadToB2(file, key, "image/jpeg");
  return key;
}

// ─── Generate signed URL for viewing (expires in 1 hour by default) ───
export async function getSignedViewUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// ─── Delete file from B2 ───
export async function deleteFromB2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

// ─── Delete all media for a lead ───
export async function deleteLeadMedia(leadId: string, storagePaths: string[]): Promise<void> {
  await Promise.all(storagePaths.map((path) => deleteFromB2(path)));
}

// ─── Get content type from filename ───
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return types[ext || ""] || "application/octet-stream";
}

// ─── Validate file type ───
export function isAllowedMediaType(contentType: string): boolean {
  const allowed = [
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm",
    "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  ];
  return allowed.includes(contentType);
}

// ─── Max file sizes ───
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_PHOTO_SIZE = 15 * 1024 * 1024;  // 15MB
