import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const PROMPT = `You are a professional Florida landscaping and property maintenance expert writing a friendly, educational project summary for a homeowner. Based on the estimate line items and job details provided, explain in plain English why each major material or service decision was made. Focus on what the homeowner would find genuinely useful — why a specific sod variety was chosen, why rubber mulch outperforms wood mulch in Florida, why a landscape tarp is a better long-term solution, or any other expert reasoning behind the choices made. Write in second person addressed to the customer. Keep it warm, confident, and expert. Maximum 3 short paragraphs. Do not repeat line item prices or act as a salesperson. Educate and build trust.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { line_items, scope_summary, service_address } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    // Build context from estimate data
    const itemList = (line_items || [])
      .filter((i: any) => i.description)
      .map((i: any) => "- " + i.description + (i.quantity > 1 ? " (qty: " + i.quantity + " " + (i.unit || "") + ")" : ""))
      .join("\n");

    const context = [
      scope_summary ? "Scope: " + scope_summary : "",
      service_address ? "Location: " + service_address : "",
      "Line items:\n" + (itemList || "No items yet"),
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: "Generate project notes for this estimate:\n\n" + context },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });

    const data = await res.json();
    const notes = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
