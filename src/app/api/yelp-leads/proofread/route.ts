import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

async function verifyAdmin(clerkUserId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .single();
  return data as { id: string; role: string } | null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await verifyAdmin(userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { message, customerName, service } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `You are a proofreading assistant for Joshua, the owner of Jenkins Home & Property Solutions (JHPS). Your ONLY job is to clean up his message before it gets sent to a customer on Yelp.

RULES:
- Fix grammar, spelling, punctuation, and capitalization
- Keep his voice and tone — do NOT make it sound corporate or robotic
- Do NOT add or remove content. Do NOT change the meaning
- Do NOT add greetings, sign-offs, or emojis unless he already included them
- If the message is already clean, return it unchanged
- Keep it natural — like a real person texting a customer
- Return ONLY the cleaned-up message, nothing else. No quotes, no explanation, no preamble.

Customer: ${customerName || "Unknown"}
Service: ${service || "property maintenance"}`,
        messages: [
          { role: "user", content: message.trim() },
        ],
      }),
    });

    const data = await response.json();
    const proofread = data.content?.[0]?.text?.trim() || message.trim();
    return NextResponse.json({ proofread });
  } catch (err) {
    console.error("Proofread failed:", err);
    return NextResponse.json({ error: "Proofread failed" }, { status: 500 });
  }
}
