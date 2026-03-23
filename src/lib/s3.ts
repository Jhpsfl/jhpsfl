import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'jhpsfl-uploads';

/** Upload a buffer to S3 and return { s3_key, s3_url } */
export async function uploadToS3(buffer: Buffer, filename: string, contentType: string): Promise<{ s3_key: string; s3_url: string }> {
  const ext = filename.split('.').pop() || 'bin';
  const s3Key = `email-attachments/${randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  }));

  return {
    s3_key: s3Key,
    s3_url: `https://${BUCKET}.s3.amazonaws.com/${s3Key}`,
  };
}
