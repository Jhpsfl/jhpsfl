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

  const msgCount = messages.length;
  const customerMsgs = messages.filter((m: { role: string }) => m.role === "customer").length;

  const systemPrompt = `You are helping Joshua, the owner of Jenkins Home & Property Solutions (JHPS), draft a reply to close a deal with a customer on Yelp.

CONTEXT:
- Customer: ${conv.customer_name}
- Service: ${service}
- Location: ${location}
- Conversation length: ${msgCount} messages (${customerMsgs} from customer)
- This customer found JHPS on Yelp and is considering hiring them.

YOUR GOAL: Move this conversation toward BOOKING THE JOB. Read the ENTIRE conversation history — not just the last message — and figure out where we are in the sales process.

STRATEGY based on conversation stage:
- EARLY (1-3 messages): Build rapport, show you understand their specific need, ask what days work for them
- MIDDLE (4-6 messages): They're interested but haven't committed. Push toward scheduling: "I'd love to come take a look this week — what day works best?"
- LATE (7+ messages): Stop being passive. Be direct: "Let's get you on the schedule" or "I can have my crew out there [timeframe]"
- If they asked about PRICING: "I'd love to come see the property so I can give you an accurate number — no surprises. What day works to meet up?"
- If they asked about a service we DON'T do: Be honest but redirect to what we can help with
- If they seem hesitant: Address the hesitation directly, offer to come look for free with no obligation

TONE:
- Sound like Joshua texting back — warm, confident, direct. NOT corporate or salesy.
- 2-4 sentences max. Every sentence should move toward booking.
- End with "- Joshua, JHPS"
- Do NOT repeat things the AI bot already said. Be fresh.
- Do NOT be wishy-washy. Be confident and action-oriented.`;

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
    content: `Customer's latest message: "${lastCustomerMsg?.text || "(see above)"}"

Read the FULL conversation above. Consider:
1. What has the customer already been told? Don't repeat it.
2. What's stopping them from booking? Address that.
3. What's the next step to get this job on the schedule?

Write Joshua's reply. Be direct and move toward closing. 2-4 sentences.`,
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
