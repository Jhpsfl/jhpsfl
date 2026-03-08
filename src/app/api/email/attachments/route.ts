import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';
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

// POST: Upload attachment to S3
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Max 10MB per file
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'bin';
  const s3Key = `email-attachments/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    }));
  } catch (err) {
    console.error('S3 upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const s3Url = `https://${BUCKET}.s3.amazonaws.com/${s3Key}`;

  return NextResponse.json({
    attachment: {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      s3_key: s3Key,
      s3_url: s3Url,
    },
  });
}
