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

  const { message, customerName, service, conversationHistory } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  try {
    // Build conversation context string from history
    const contextLines = (conversationHistory || []).slice(-8).map(
      (m: { role: string; text: string }) => `${m.role === 'customer' ? customerName || 'Customer' : 'You'}: ${m.text}`
    ).join('\n');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: `You are a smart reply assistant for Joshua, the owner of Jenkins Home & Property Solutions (JHPS), a property services company in Orlando/Central Florida offering lawn care, pressure washing, junk removal, and land clearing.

You have TWO modes based on what Joshua typed:

MODE 1 — GRAMMAR FIX ONLY (for short, simple messages):
If the message is short (under ~15 words) and is clearly just confirming something simple like a time, date, yes/no, quick acknowledgment, or a direct answer — just fix grammar, spelling, punctuation and capitalization. Keep his exact words. Return the cleaned message.
Examples: "tomorrow at 4", "sounds good we can do that", "yes sir", "ill be there at 8 am"

MODE 2 — FULL SUGGESTION (for longer or substantive messages):
If the message is longer or is trying to convey something more complex (explaining services, pricing, scheduling details, follow-ups, objection handling, sales pitch) — rewrite it into a polished, professional but natural-sounding message. Read the conversation context to understand what the customer needs. Make it sound like a knowledgeable business owner, not a robot. Keep Joshua's intent but make it clearer and more persuasive.

RULES FOR BOTH MODES:
- Never use emojis
- Keep it natural — like a real person messaging a customer
- Never reference "the owner" or speak in third person
- Return ONLY the message text, no quotes, no explanation, no preamble
- Do NOT start with "Hi" or a greeting unless Joshua included one
- Sign off with "- Josh" or "- The JHPS Team" only if the message is substantial enough to warrant it

Also return which mode you used.

RESPOND IN THIS EXACT FORMAT:
MODE: [grammar|suggestion]
MESSAGE: [the cleaned/rewritten message]`,
        messages: [
          { role: "user", content: contextLines
            ? `CONVERSATION SO FAR:\n${contextLines}\n\nJOSHUA'S DRAFT REPLY:\n${message.trim()}`
            : `JOSHUA'S DRAFT REPLY:\n${message.trim()}` },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() || '';

    // Parse mode and message from response
    const modeMatch = raw.match(/MODE:\s*(grammar|suggestion)/i);
    const msgMatch = raw.match(/MESSAGE:\s*([\s\S]*)/i);
    const mode = modeMatch?.[1]?.toLowerCase() || 'grammar';
    const proofread = msgMatch?.[1]?.trim() || raw.replace(/MODE:.*\n/i, '').replace(/MESSAGE:\s*/i, '').trim() || message.trim();

    return NextResponse.json({ proofread, mode });
  } catch (err) {
    console.error("Proofread failed:", err);
    return NextResponse.json({ error: "Proofread failed" }, { status: 500 });
  }
}
