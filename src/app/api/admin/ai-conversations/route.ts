import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

function estimateTokens(messages: any[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, summary, token_estimate, compacted, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data || [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ title: body.title || "New Chat", messages: body.messages || [] })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversation: data });
  }

  if (action === "save") {
    const { id, messages, title } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const tokens = estimateTokens(messages);
    const update: any = { messages, token_estimate: tokens, updated_at: new Date().toISOString() };
    if (title) update.title = title;
    const { error } = await supabase.from("ai_conversations").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, token_estimate: tokens });
  }

  if (action === "load") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { data, error } = await supabase.from("ai_conversations").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ conversation: data });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "compact") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { data: conv } = await supabase.from("ai_conversations").select("messages").eq("id", id).single();
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messages = conv.messages as any[];
    if (messages.length < 6) return NextResponse.json({ error: "Too short to compact" }, { status: 400 });

    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const summaryRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": claudeKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: "Summarize this conversation into 3-5 bullet points. Include: key decisions, data looked up, questions answered, pending items. Be concise.",
        messages: [{ role: "user", content: messages.map((m: any) => `${m.role}: ${m.content}`).join("\n\n") }],
      }),
    });
    if (!summaryRes.ok) return NextResponse.json({ error: "Compaction failed" }, { status: 500 });
    const summaryData = await summaryRes.json();
    const summary = summaryData.content?.[0]?.text || "Previous conversation (compacted)";

    const kept = messages.slice(-4);
    const compactedMessages = [{ role: "assistant", content: `**Previous conversation summary:**\n${summary}` }, ...kept];
    const tokens = estimateTokens(compactedMessages);

    await supabase.from("ai_conversations").update({
      messages: compactedMessages, summary, token_estimate: tokens, compacted: true, updated_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ success: true, summary, token_estimate: tokens, messages: compactedMessages });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
