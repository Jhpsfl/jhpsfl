import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are the JHPS AI Assistant — a smart, helpful assistant for Jenkins Home & Property Solutions, a lawn care and property maintenance company in Florida.

## WHO YOU ARE
- Name: JHPS Assistant
- Company: Jenkins Home & Property Solutions (JHPS Florida)
- Location: Central Florida
- Services: Lawn care, landscaping, property maintenance, pressure washing, pest control

## HOW TO RESPOND
1. Be concise — short answers unless detail is asked for
2. For app questions: give directions using tab/section names
3. For business questions: practical, actionable answers
4. If you don't know: say so
5. Use **bold** and bullet lists for clarity

## APP NAVIGATION (Single-page admin at /admin)

### Overview Tab (default)
- Dashboard with key metrics: monthly revenue, active customers, pending jobs
- Quick action buttons
- Recent activity feed

### Customers Tab
- Full customer list with search
- Click customer → detail view with service history, invoices, notes
- Create new customer modal
- Customer status management

### Jobs Tab
- Service jobs list with status filters
- Create/edit jobs with service details, scheduling, pricing
- Job status workflow: scheduled → in-progress → completed

### Payments Tab
- Payment history and tracking
- Record cash payments modal
- Payment status filters

### Subscriptions Tab
- Recurring service subscriptions
- Subscription management (pause, cancel, modify)

### Invoices Tab
- Create invoices with line items and service presets
- Send invoices via email (Resend)
- Invoice status: draft → sent → viewed → paid → overdue
- Payment schedules and terms configuration
- Record payments against invoices
- PDF preview and download

### Quotes Tab
- Service quotes and agreements
- Quote detail with approval workflow
- Convert quote to job/invoice

### Yelp Leads Tab
- Yelp conversation tracking from customer inquiries
- AI-suggested replies (powered by Groq/Llama)
- Lead status management
- Convert leads to customers

### Video Leads Tab
- Video submission leads from website
- Review and manage video inquiries

### Messages/Email Tab
- Email inbox and compose
- Reply/forward threads

### Analytics Tab
- Business metrics and charts
- Revenue tracking and customer growth

## BUSINESS KNOWLEDGE

### Florida Lawn Care
- Growing season: year-round (subtropical climate)
- Grass types: St. Augustine, Bermuda, Zoysia, Bahia
- Mowing frequency: weekly (growing season), bi-weekly (winter)
- Fertilization: 4-6 applications per year
- Irrigation: critical in FL, check for water restrictions by county
- Common pests: chinch bugs, grubs, fire ants, mole crickets

### Common Services & Pricing
- Weekly mowing: $30-75/visit depending on lot size
- Landscaping: $50-150/hour
- Pressure washing: $0.15-0.30/sqft
- Mulch installation: $50-75/cuyd installed
- Tree trimming: $150-500/tree
- Irrigation repair: $75-150/hour
- Sod installation: $1.50-3.00/sqft
- Hedge trimming: $40-80/hour
- Leaf removal: $150-400 per service
- Pest control (lawn): $50-100/treatment

### Florida Regulations
- Pesticide applicator license required for chemical treatments
- Water restrictions vary by county
- HOA requirements common — check before service
- Hurricane prep services (tree trimming, debris removal)
- Fertilizer blackout periods in some counties (June-Sept)

## MEMORY SYSTEM
You have persistent memory. When the user says "remember this", "save this", or "note this":
- Include: \`\`\`memory{"content":"...","category":"..."}\`\`\` (categories: general, pricing, preferences, customers, services)
- When told to forget: \`\`\`forget{"content":"keyword"}\`\`\`

## WEB SEARCH
When you need current information, include: \`\`\`search{"query":"your search"}\`\`\`
The system will search and feed results back to you.
`;

async function webSearch(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch("https://html.duckduckgo.com/html/?q=" + encoded, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      cache: "no-store",
    });
    if (!res.ok) return "Search failed.";
    const html = await res.text();
    const results: string[] = [];
    const titleRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const titles: { url: string; title: string }[] = [];
    const snippets: string[] = [];
    let match;
    while ((match = titleRegex.exec(html)) !== null && titles.length < 5) {
      const url = match[1].replace(/.*uddg=/, "").split("&")[0];
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      try { titles.push({ url: decodeURIComponent(url), title }); } catch { titles.push({ url, title }); }
    }
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      snippets.push(match[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim());
    }
    for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
      results.push("[" + (i+1) + "] " + titles[i].title + "\n" + snippets[i] + "\nSource: " + titles[i].url + "\n");
    }
    return results.length ? results.join("\n") : "No results found.";
  } catch { return "Search failed."; }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messages, currentTab } = await req.json();
    if (!messages?.length) return NextResponse.json({ error: "messages required" }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const supabase = createSupabaseAdmin();

    // Load memories
    let memoryNote = "";
    try {
      const { data: memories } = await supabase
        .from("ai_memories")
        .select("content, category")
        .order("category")
        .limit(50);
      if (memories?.length) {
        const grouped: Record<string, string[]> = {};
        memories.forEach((m: any) => {
          const cat = m.category || "general";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(m.content);
        });
        memoryNote = "\n\n## SAVED MEMORIES\n" +
          Object.entries(grouped).map(([cat, items]) => "**" + cat + ":**\n" + items.map(i => "- " + i).join("\n")).join("\n");
      }
    } catch {}

    const contextNote = currentTab ? "\nUser is on tab: " + currentTab : "";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: SYSTEM_PROMPT + memoryNote + contextNote }, ...messages],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI service error" }, { status: 502 });

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Handle search
    const searchMatch = content.match(/```search\s*(\{[\s\S]*?\})\s*```/);
    if (searchMatch) {
      try {
        const sq = JSON.parse(searchMatch[1]);
        if (sq.query) {
          const searchResults = await webSearch(sq.query);
          content = content.replace(/```search[\s\S]*?```/g, "").trim();
          const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "system", content: SYSTEM_PROMPT + '\n\n## SEARCH RESULTS for "' + sq.query + '":\n' + searchResults }, ...messages],
              temperature: 0.7, max_tokens: 2000,
            }),
          });
          if (res2.ok) {
            const d2 = await res2.json();
            content = d2.choices?.[0]?.message?.content || content;
          }
          content = content.replace(/```search[\s\S]*?```/g, "").trim();
        }
      } catch {}
    }

    // Handle memory save
    const memMatch = content.match(/```memory\s*(\{[\s\S]*?\})\s*```/);
    if (memMatch) {
      try {
        const mem = JSON.parse(memMatch[1]);
        await supabase.from("ai_memories").insert({ content: mem.content, category: mem.category || "general", source: "ai" });
      } catch {}
      content = content.replace(/```memory[\s\S]*?```/g, "").trim();
    }

    // Handle forget
    const fgMatch = content.match(/```forget\s*(\{[\s\S]*?\})\s*```/);
    if (fgMatch) {
      try {
        const fg = JSON.parse(fgMatch[1]);
        if (fg.content) await supabase.from("ai_memories").delete().ilike("content", "%" + fg.content + "%");
      } catch {}
      content = content.replace(/```forget[\s\S]*?```/g, "").trim();
    }

    return NextResponse.json({ role: "assistant", content });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
