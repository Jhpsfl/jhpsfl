import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import Groq from "groq-sdk";

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

  const { conversationId } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: conv, error } = await supabase
    .from("yelp_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (error || !conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = conv.messages || [];
  if (messages.length === 0) return NextResponse.json({ suggestion: "" });

  const service = (conv.services || []).join(", ") || "property maintenance";
  const location = conv.zip_code ? `zip code ${conv.zip_code}` : "Central Florida";

  const systemPrompt = `You are helping the owner of Jenkins Home & Property Solutions (JHPS) draft a reply to a customer on Yelp.

CONTEXT:
- Customer: ${conv.customer_name}
- Service: ${service}
- Location: ${location}
- This is a Yelp lead conversation. The owner wants to sound warm, professional, and personal.

YOUR JOB: Write a suggested reply FROM the business owner (Joshua) to the customer.

RULES:
- Sound like a real person, not a bot. Warm and professional.
- 2-4 sentences max.
- Reference the conversation context — what the customer just said.
- If the customer asked about scheduling, suggest working with their availability.
- If the customer asked about pricing, mention you'd like to see the site first for an accurate quote.
- NEVER commit to a specific time — say you'll check the schedule and confirm.
- End with "- Joshua, JHPS" (NOT "The JHPS Team" — this is the owner replying personally).
- Do NOT repeat what the AI bot already said. Be fresh and personal.`;

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of messages) {
    chatMessages.push({
      role: msg.role === "customer" ? "user" : "assistant",
      content: msg.text,
    });
  }

  // Add instruction as final user message
  const lastCustomerMsg = [...messages].reverse().find((m: { role: string }) => m.role === "customer");
  chatMessages.push({
    role: "user",
    content: `The customer's latest message is: "${lastCustomerMsg?.text || "(see above)"}"

Write a suggested reply for the business owner Joshua to send. Be warm, personal, and address what the customer said. Keep it 2-4 sentences.`,
  });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const suggestion = response.choices[0].message.content?.trim() || "";
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("AI suggest failed:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
