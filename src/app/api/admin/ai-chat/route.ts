import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
- Quick action buttons, recent activity feed

### Customers Tab
- Full customer list with search
- Click customer → detail view with service history, invoices, notes
- Create new customer modal

### Jobs Tab
- Service jobs list with status filters
- Create/edit jobs with service details, scheduling, pricing
- Status: scheduled → in-progress → completed

### Payments Tab
- Payment history and tracking, record cash payments

### Subscriptions Tab
- Recurring service subscriptions management

### Invoices Tab
- Create invoices with line items and service presets
- Send via email (Resend), PDF preview/download
- Status: draft → sent → viewed → paid → overdue
- Record payments, payment schedules

### Quotes Tab
- Service quotes and agreements, convert to job/invoice

### Yelp Leads Tab
- Yelp conversation tracking, AI-suggested replies
- Convert leads to customers

### Video Leads Tab
- Video submission leads from website

### Messages/Email Tab
- Email inbox, compose, reply/forward

### Analytics Tab
- Business metrics, revenue tracking, customer growth

## BUSINESS KNOWLEDGE

### Florida Lawn Care
- Growing season: year-round (subtropical)
- Grass types: St. Augustine, Bermuda, Zoysia, Bahia
- Mowing: weekly (growing season), bi-weekly (winter)
- Common pests: chinch bugs, grubs, fire ants, mole crickets
- Fertilizer blackout: some counties June-Sept

### Services & Pricing
- Weekly mowing: $30-75/visit
- Landscaping: $50-150/hour
- Pressure washing: $0.15-0.30/sqft
- Mulch: $50-75/cuyd installed
- Tree trimming: $150-500/tree
- Irrigation repair: $75-150/hour
- Sod: $1.50-3.00/sqft
- Pest control: $50-100/treatment

## MEMORY SYSTEM
When the user says "remember this", "save this", or "note this":
- Include: \`\`\`memory{"content":"...","category":"..."}\`\`\`
- When told to forget: \`\`\`forget{"content":"keyword"}\`\`\`

## ACTIONS
You can execute actions in the app. When the user asks you to DO something (not just explain how), include an action block:
\`\`\`action{"type":"...","data":{...}}\`\`\`

Available actions:

### Create Customer
\`\`\`action{"type":"create_customer","data":{"name":"John Smith","email":"john@email.com","phone":"407-555-1234","address":"123 Main St","customer_type":"residential"}}\`\`\`

### Create Quote/Estimate
\`\`\`action{"type":"create_quote","data":{"customer_name":"John Smith","line_items":[{"description":"Weekly Lawn Mowing","quantity":4,"unit_price":45},{"description":"Hedge Trimming","quantity":1,"unit_price":50}],"tax_rate":0,"notes":"Monthly service quote","expiration_days":30}}\`\`\`

### Create Invoice
\`\`\`action{"type":"create_invoice","data":{"customer_name":"John Smith","line_items":[{"description":"Weekly Lawn Mowing - March","quantity":4,"unit_price":45}],"tax_rate":0,"due_days":15,"notes":"March service invoice"}}\`\`\`

### Navigate
\`\`\`action{"type":"navigate","data":{"tab":"customers|jobs|invoices|quotes|yelp_leads|analytics|messages"}}\`\`\`

### Service Presets (use these default prices)
- Weekly mowing (standard): $45
- Weekly mowing (large): $75
- Weekly mowing (XL): $120
- Edging: $25
- Hedge trimming: $50
- Full lawn package: $95
- Driveway pressure wash: $150
- House soft wash: $250
- Patio pressure wash: $125
- Junk removal (small): $150
- Junk removal (half load): $275
- Junk removal (full load): $450
- Brush clearing (1/4 acre): $500
- General cleanup: $200

Rules:
- When creating quotes/invoices, ALWAYS calculate amounts (qty × unit_price) for each item
- If customer name is given but no email/phone, create the quote anyway with just the name
- Use service presets when the user describes common services
- After creating, confirm with the quote/invoice number and total
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
    const titles: { url: string; title: string }[] = [];
    const snippets: string[] = [];
    const titleRegex = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = titleRegex.exec(html)) !== null && titles.length < 5) {
      const url = match[1].replace(/.*uddg=/, "").split("&")[0];
      const title = match[2].replace(/<[^>]*>/g, "").trim();
      try { titles.push({ url: decodeURIComponent(url), title }); } catch { titles.push({ url, title }); }
    }
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      snippets.push(match[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim());
    }
    const results: string[] = [];
    for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
      results.push("[" + (i+1) + "] " + titles[i].title + "\n" + snippets[i] + "\nSource: " + titles[i].url);
    }
    return results.length ? results.join("\n\n") : "No results found.";
  } catch { return "Search failed."; }
}

// Detect if a query likely needs web search
function needsWebSearch(lastMessage: string): string | null {
  const msg = lastMessage.toLowerCase();
  const searchTriggers = [
    /what(?:'s| is) the (?:latest|current|new|2024|2025|2026)/,
    /search (?:for|the web|online|google)/,
    /look up/,
    /find (?:me |out )/,
    /current (?:price|cost|rate|code|regulation|law|requirement)/,
    /(?:price|cost) of .+ (?:in|near|around)/,
    /(?:florida|fl) (?:code|law|regulation|permit|license|requirement)/,
    /how much (?:does|do|is|are) .+ cost/,
    /latest .+ (?:code|regulation|update|news|price)/,
  ];
  for (const trigger of searchTriggers) {
    if (trigger.test(msg)) return lastMessage;
  }
  if (msg.includes('search') || msg.includes('look up') || msg.includes('google')) {
    return lastMessage;
  }
  return null;
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

    let contextNote = currentTab ? "\nUser is on tab: " + currentTab : "";

    // Pre-detect if web search is needed — run it BEFORE the AI call
    const lastUserMsg = messages[messages.length - 1]?.content || "";
    const searchQuery = needsWebSearch(lastUserMsg);
    let searchResults = "";
    if (searchQuery) {
      searchResults = await webSearch(searchQuery);
      if (searchResults && searchResults !== "No results found." && searchResults !== "Search failed.") {
        contextNote += '\n\n## WEB SEARCH RESULTS for "' + searchQuery + '":\n' + searchResults + '\n\nUse these results to answer. Include source URLs.';
      }
    }

    // Single AI call with all context pre-loaded
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

    // If AI still requested a search (for queries we didn't pre-detect), handle it
    const searchMatch = content.match(/```search\s*(\{[\s\S]*?\})\s*```/);
    if (searchMatch) {
      try {
        const sq = JSON.parse(searchMatch[1]);
        if (sq.query) {
          const results = await webSearch(sq.query);
          content = content.replace(/```search[\s\S]*?```/g, "").trim();
          const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "system", content: SYSTEM_PROMPT + '\n\n## SEARCH RESULTS for "' + sq.query + '":\n' + results }, ...messages],
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

    // Handle action execution
    let action = null;
    const actionMatch = content.match(/```action\s*(\{[\s\S]*?\})\s*```/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);

        if (action.type === "create_customer" && action.data) {
          const { data: newCust, error } = await supabase.from("customers").insert({
            name: action.data.name || (action.data.first_name + " " + (action.data.last_name || "")).trim(),
            email: action.data.email || null,
            phone: action.data.phone || null,
            address: action.data.address || null,
            customer_type: action.data.customer_type || "residential",
          }).select().single();
          if (error) action.result = "Failed: " + error.message;
          else action.result = "Customer created: " + (newCust?.name || "");
          action.created_id = newCust?.id;
        }

        if (action.type === "create_quote" && action.data) {
          // Find or skip customer
          let customerId = null;
          if (action.data.customer_name) {
            const { data: customers } = await supabase
              .from("customers")
              .select("id, name")
              .ilike("name", "%" + action.data.customer_name + "%")
              .limit(1);
            if (customers?.length) {
              customerId = customers[0].id;
            } else {
              // Auto-create customer
              const { data: newCust } = await supabase
                .from("customers")
                .insert({ name: action.data.customer_name, customer_type: "residential" })
                .select().single();
              customerId = newCust?.id;
            }
          }

          // Generate quote number
          const now = new Date();
          const prefix = "QTE-" + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0") + "-";
          const { data: existing } = await supabase
            .from("quotes")
            .select("quote_number")
            .like("quote_number", prefix + "%")
            .order("quote_number", { ascending: false })
            .limit(1);
          let nextNum = 1;
          if (existing?.length) {
            const last = parseInt(existing[0].quote_number.replace(prefix, ""), 10);
            if (!isNaN(last)) nextNum = last + 1;
          }
          const quoteNumber = prefix + String(nextNum).padStart(4, "0");

          // Calculate totals
          const lineItems = (action.data.line_items || []).map((li: any) => ({
            description: li.description || "",
            quantity: li.quantity || 1,
            unit_price: li.unit_price || 0,
            amount: (li.quantity || 1) * (li.unit_price || 0),
          }));
          const subtotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
          const taxRate = action.data.tax_rate || 0;
          const taxAmount = subtotal * (taxRate / 100);
          const total = subtotal + taxAmount;
          const expDays = action.data.expiration_days || 30;
          const expDate = new Date(now.getTime() + expDays * 86400000).toISOString().split("T")[0];

          const { data: newQuote, error } = await supabase.from("quotes").insert({
            quote_number: quoteNumber,
            customer_id: customerId,
            status: "draft",
            line_items: lineItems,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            notes: action.data.notes || null,
            expiration_date: expDate,
          }).select().single();

          if (error) action.result = "Failed: " + error.message;
          else action.result = "Quote " + quoteNumber + " created — $" + total.toFixed(2) + " total";
          action.created_id = newQuote?.id;
        }

        if (action.type === "create_invoice" && action.data) {
          let customerId = null;
          if (action.data.customer_name) {
            const { data: customers } = await supabase
              .from("customers")
              .select("id, name")
              .ilike("name", "%" + action.data.customer_name + "%")
              .limit(1);
            if (customers?.length) customerId = customers[0].id;
            else {
              const { data: newCust } = await supabase
                .from("customers")
                .insert({ name: action.data.customer_name, customer_type: "residential" })
                .select().single();
              customerId = newCust?.id;
            }
          }

          const now = new Date();
          const prefix = "INV-" + String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0") + "-";
          const { data: existing } = await supabase
            .from("invoices")
            .select("invoice_number")
            .like("invoice_number", prefix + "%")
            .order("invoice_number", { ascending: false })
            .limit(1);
          let nextNum = 1;
          if (existing?.length) {
            const last = parseInt(existing[0].invoice_number.replace(prefix, ""), 10);
            if (!isNaN(last)) nextNum = last + 1;
          }
          const invoiceNumber = prefix + String(nextNum).padStart(4, "0");

          const lineItems = (action.data.line_items || []).map((li: any) => ({
            description: li.description || "",
            quantity: li.quantity || 1,
            unit_price: li.unit_price || 0,
            amount: (li.quantity || 1) * (li.unit_price || 0),
          }));
          const subtotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
          const taxRate = action.data.tax_rate || 0;
          const taxAmount = subtotal * (taxRate / 100);
          const total = subtotal + taxAmount;
          const dueDays = action.data.due_days || 15;
          const dueDate = new Date(now.getTime() + dueDays * 86400000).toISOString().split("T")[0];

          const { data: newInv, error } = await supabase.from("invoices").insert({
            invoice_number: invoiceNumber,
            customer_id: customerId,
            status: "draft",
            line_items: lineItems,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            amount_paid: 0,
            due_date: dueDate,
            notes: action.data.notes || null,
          }).select().single();

          if (error) action.result = "Failed: " + error.message;
          else action.result = "Invoice " + invoiceNumber + " created — $" + total.toFixed(2) + " total, due " + dueDate;
          action.created_id = newInv?.id;
        }

        content = content.replace(/```action[\s\S]*?```/g, "").trim();
        if (action.result) content += "\n\n**" + action.result + "**";
      } catch (err) {
        console.error("[ai-chat] action error:", err);
      }
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

    return NextResponse.json({ role: "assistant", content, action });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
