import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

function generateCode(): string {
  // 6 chars: a-z, 0-9 (no ambiguous chars like 0/O, 1/l)
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST: Create a short link
export async function POST(req: NextRequest) {
  try {
    const { url, label } = await req.json();
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    const supabase = createSupabaseAdmin();

    // Check if this exact URL already has a short link
    const { data: existing } = await supabase
      .from("short_links")
      .select("code")
      .eq("target_url", url)
      .limit(1);

    if (existing && existing.length > 0) {
      const origin = req.headers.get("origin") || "https://jhpsfl.com";
      return NextResponse.json({
        success: true,
        code: existing[0].code,
        short_url: `${origin}/l/${existing[0].code}`,
      });
    }

    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: collision } = await supabase
        .from("short_links")
        .select("id")
        .eq("code", code)
        .limit(1);
      if (!collision || collision.length === 0) break;
      code = generateCode();
      attempts++;
    }

    const { error } = await supabase
      .from("short_links")
      .insert({ code, target_url: url, label: label || null });

    if (error) {
      console.error("Short link insert error:", error);
      return NextResponse.json({ error: "Failed to create short link" }, { status: 500 });
    }

    const origin = req.headers.get("origin") || "https://jhpsfl.com";
    return NextResponse.json({
      success: true,
      code,
      short_url: `${origin}/l/${code}`,
    });
  } catch (err) {
    console.error("Short link error:", err);
    return NextResponse.json({ error: "Failed to create short link" }, { status: 500 });
  }
}
