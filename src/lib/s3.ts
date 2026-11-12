import { randomUUID } from 'crypto';
import { getSignedViewUrl, uploadToB2 } from '@/lib/b2Storage';

/**
 * Email and quote attachments live in Backblaze B2 (private), like video quotes.
 * Production has no AWS keys, so the old S3 bucket never stored anything.
 * The names stay s3_* because the email_attachments columns use them.
 */

const KEY_PREFIX = 'email-attachments/';

/** Admin-only link the inbox uses to show or download a file. */
export const attachmentViewPath = (key: string) => `/api/email/attachments?key=${encodeURIComponent(key)}`;

export const isAttachmentKey = (key: string) => key.startsWith(KEY_PREFIX) && !key.includes('..');

/** Upload a buffer and return { s3_key, s3_url } */
export async function uploadToS3(buffer: Buffer, filename: string, contentType: string): Promise<{ s3_key: string; s3_url: string }> {
  const ext = (filename.split('.').pop() || 'bin').replace(/[^\w]/g, '').slice(0, 10) || 'bin';
  const s3Key = `${KEY_PREFIX}${randomUUID()}.${ext}`;
  await uploadToB2(buffer, s3Key, contentType);
  return { s3_key: s3Key, s3_url: attachmentViewPath(s3Key) };
}

/** Short-lived public link, so Resend can fetch a file when sending an email. */
export async function attachmentSendUrl(att: { s3_key?: string; s3_url: string }): Promise<string> {
  return att.s3_key && isAttachmentKey(att.s3_key) ? getSignedViewUrl(att.s3_key, 3600) : att.s3_url;
}
