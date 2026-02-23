/**
 * Backblaze B2 Storage Client (S3-compatible) — Phase 5b
 *
 * Now includes pre-signed upload URLs for direct browser→B2 uploads,
 * bypassing the Vercel 4.5MB body limit entirely.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── S3-Compatible Client ───
const s3Client = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true,
  // Prevents AWS SDK v3 from adding x-amz-checksum-crc32 params that B2 doesn't support
  requestChecksumCalculation: "WHEN_REQUIRED",
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || "Jhpsfl";

// ─── Generate pre-signed UPLOAD URL (browser → B2 direct) ───
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

// ─── Generate pre-signed DOWNLOAD URL (for admin viewing) ───
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

// ─── Server-side upload (for small files or thumbnails) ───
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
  return { key, size: buffer.length };
}

// ─── Delete file ───
export async function deleteFromB2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
}

// ─── Build storage key for lead media ───
export function buildLeadMediaKey(leadId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `leads/${leadId}/${timestamp}-${sanitized}`;
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
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_PHOTO_SIZE = 50 * 1024 * 1024;  // 50MB
