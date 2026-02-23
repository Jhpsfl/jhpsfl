import { NextRequest, NextResponse } from "next/server";
import {
  getSignedUploadUrl,
  buildLeadMediaKey,
  isAllowedMediaType,
  MAX_VIDEO_SIZE,
  MAX_PHOTO_SIZE,
} from "@/lib/b2Storage";

/**
 * POST /api/leads/upload-url
 *
 * Returns a pre-signed URL for the browser to upload directly to B2.
 * No auth required (same as lead submission — zero friction).
 *
 * Body: { leadId, filename, contentType, fileSize }
 * Returns: { uploadUrl, storageKey }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, filename, contentType, fileSize } = body;

    // Validate required fields
    if (!leadId || !filename || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: leadId, filename, contentType" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isAllowedMediaType(contentType)) {
      return NextResponse.json(
        { error: "File type not allowed. Supported: JPG, PNG, WebP, HEIC, MP4, MOV, WebM, AVI" },
        { status: 400 }
      );
    }

    // Validate file size
    const isVideo = contentType.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_PHOTO_SIZE;
    if (fileSize && fileSize > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum ${isVideo ? "video" : "photo"} size is ${maxMB}MB` },
        { status: 400 }
      );
    }

    // Build storage key and get pre-signed URL
    const storageKey = buildLeadMediaKey(leadId, filename);
    const uploadUrl = await getSignedUploadUrl(storageKey, contentType, 1800); // 30 min expiry

    return NextResponse.json({
      uploadUrl,
      storageKey,
      expiresIn: 1800,
    });

  } catch (err) {
    console.error("Upload URL generation error:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
