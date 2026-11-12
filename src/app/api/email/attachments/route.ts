import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { uploadToS3, isAttachmentKey, newAttachmentKey, attachmentViewPath } from '@/lib/s3';
import { getSignedViewUrl, getSignedUploadUrl } from '@/lib/b2Storage';

const MAX_DIRECT = 25 * 1024 * 1024;

async function isAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  const { data } = await createSupabaseAdmin().from('admin_users').select('id').eq('clerk_user_id', userId).maybeSingle();
  return !!data;
}

// GET ?key=…: admins only; opens the stored file through a short-lived link.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!isAttachmentKey(key)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.redirect(await getSignedViewUrl(key, 600), 302);
}

// POST JSON { filename, size, content_type }: a one-time upload link, so the browser PUTs the file straight
// into storage (no 4.5 MB request limit). Answers { upload_url, attachment: { filename, content_type, size_bytes, s3_key, s3_url } }.
// POST multipart (file): the old path, server-side upload for small files.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if ((req.headers.get('content-type') || '').includes('application/json')) {
    if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const b = await req.json().catch(() => ({})) as { filename?: string; size?: number; content_type?: string };
    const filename = String(b.filename || 'attachment').slice(0, 200);
    const contentType = String(b.content_type || 'application/octet-stream');
    if (Number(b.size || 0) > MAX_DIRECT) return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 413 });
    const key = newAttachmentKey(filename);
    try {
      const upload_url = await getSignedUploadUrl(key, contentType, 900);
      return NextResponse.json({ upload_url, attachment: { filename, content_type: contentType, size_bytes: Number(b.size || 0), s3_key: key, s3_url: attachmentViewPath(key) } });
    } catch (err) {
      console.error('Attachment upload link error:', err);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  }

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

  const buffer = Buffer.from(await file.arrayBuffer());
  let s3Key: string;
  let s3Url: string;
  try {
    ({ s3_key: s3Key, s3_url: s3Url } = await uploadToS3(buffer, file.name, file.type || 'application/octet-stream'));
  } catch (err) {
    console.error('Attachment upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

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
