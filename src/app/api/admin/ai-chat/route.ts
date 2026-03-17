import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

## IMPORTANT: DATA ACCESS
You CAN see live data. When the user asks about customers, quotes, invoices, or jobs, the system automatically fetches the data and provides it to you in the context below. You DO NOT need to tell the user to navigate anywhere or ask them for quote numbers — just look at the LIVE DATA section provided and answer their question directly. If data is provided, use it. Never say "I can't access the database" or "I need you to navigate" — you already have the data.

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
You can execute actions. Include an action block: \`\`\`action{"type":"...","data":{...}}\`\`\`

### CRITICAL: QUESTION BEFORE CREATING
When a user asks to create a quote or estimate, do NOT create it immediately unless they've given you enough detail. ASK QUESTIONS FIRST to build a complete, professional estimate.

**Minimum info needed before creating a quote:**
1. Customer name (required)
2. Service address (ask if not given)
3. What services are needed (be specific — ask about add-ons)
4. Lot size or quantity details (standard/large/XL? how many sqft? how many visits?)
5. Any special conditions (heavy brush, slope, obstacles, HOA requirements?)

**Ask in batches of 2-3 questions, not all at once. Be conversational.**

Example flow:
- User: "Create a quote for lawn service for Dave"
- AI: "Got it! A few questions about Dave's job: What's the service address? And is this weekly mowing, or are there additional services like edging, hedge trimming, or cleanup?"
- User: "123 Oak St, weekly mowing and hedge trimming"
- AI: "What size lot — standard, large, or XL? And how often for the hedges — every visit or monthly?"
- User: "Large lot, hedges monthly"
- AI: Creates complete quote with all fields filled

### Available Actions

#### Create Customer
\`\`\`action{"type":"create_customer","data":{"name":"...","email":"...","phone":"...","address":"...","customer_type":"residential"}}\`\`\`

#### Create Quote/Estimate (FULL)
\`\`\`action{"type":"create_quote","data":{
  "customer_name":"John Smith",
  "service_address":"123 Oak St, Orlando FL",
  "scope_summary":"Weekly lawn maintenance including mowing, edging, and monthly hedge trimming for a large residential lot.",
  "line_items":[
    {"description":"Weekly Lawn Mowing (Large Lot)","quantity":4,"unit":"visit","unit_price":75},
    {"description":"Edging - Driveway & Walkways","quantity":4,"unit":"visit","unit_price":25},
    {"description":"Hedge Trimming","quantity":1,"unit":"visit","unit_price":50}
  ],
  "exclusions":"Irrigation repairs\\nFertilizer application\\nTree removal",
  "warranty":"All workmanship guaranteed for 30 days from completion.",
  "closing_statement":"We look forward to keeping your property looking its best. Our schedule fills quickly — securing your spot ensures consistent, reliable service. Call or text (407) 686-9817 with any questions.\\n\\n— Jenkins Home & Property Solutions",
  "tax_rate":0,
  "notes":"Monthly service - 4 weekly visits",
  "expiration_days":30,
  "start_date":"2026-03-25",
  "completion_date":"Ongoing weekly service"
}}\`\`\`

#### Update/Edit Existing Quote
\`\`\`action{"type":"update_quote","data":{"quote_number":"QTE-2603-XXXX","updates":{...fields to change...}}}\`\`\`

ALL updatable fields:
- "service_address": "123 Main St, Orlando FL"
- "scope_summary": "Description of work..."
- "ai_project_notes": "About Your Project paragraphs..."
- "line_items": [{"description":"...","quantity":1,"unit":"flat","unit_price":100}] — REPLACES all items
- "exclusions": "Item 1\nItem 2\nItem 3"
- "warranty": "30-day workmanship guarantee..."
- "closing_statement": "Ready to get started?..."
- "notes": "Internal notes..."
- "start_date": "2026-04-01"
- "completion_date": "2-3 weeks"
- "tax_rate": 7 (percent)
- "expiration_date": "2026-04-15"
- "show_financing": true/false
- "is_commercial": true/false
- "terms_conditions": ["term_id_1","term_id_2"] — array of term IDs to enable
- "payment_terms": {"type":"deposit_balance","deposit_amount":800,"schedule":[{"label":"Deposit","amount":800},{"label":"Balance","amount":765}]}
  Payment types: "full" | "deposit_balance" | "deposit_installments"

Only include the fields you're changing. Omitted fields stay as-is.

Granular operations (add/remove without replacing everything):
- "add_items": [{"description":"New item","quantity":1,"unit":"flat","unit_price":100}] — ADDS to existing items
- "remove_items": ["hedge trimming", "debris"] — REMOVES items matching these descriptions
- "add_terms": ["term_id_1"] — turns ON specific terms
- "remove_terms": ["term_id_2"] — turns OFF specific terms

For terms, use these IDs from the quote_terms table:
- Payment Terms, Scope of Work, Cancellation Policy, Property Access, Liability Limitation, Weather Delays, Change Orders (these are ON by default)
- Material Price Fluctuation, Independent Contractor, Warranty, FL Lien Rights, Dispute Resolution (these are OFF by default)
When the user says "add warranty term" or "turn on lien rights", fetch the term IDs first with a query action if needed.

#### Create Invoice
\`\`\`action{"type":"create_invoice","data":{"customer_name":"...","line_items":[...],"tax_rate":0,"due_days":15}}\`\`\`

#### Query Data
\`\`\`action{"type":"query","data":{"table":"customers|quotes|invoices|jobs","limit":10}}\`\`\`

#### Navigate
\`\`\`action{"type":"navigate","data":{"tab":"customers|jobs|invoices|quotes|yelp_leads|analytics|messages"}}\`\`\`

### Service Presets & Pricing
**Lawn Care:**
- Standard mow: $45/visit | Large: $75 | XL: $120
- Edging: $25/visit | Leaf blowing: $35 | Hedge trim: $50
- Full lawn package (mow+edge+blow): $95/visit

**Pressure Washing:**
- Driveway: $150 | House soft wash: $250 | Patio: $125
- Fence: $100 | Roof: $350 | Sidewalk: $75 | Full property: $450

**Junk Removal:**
- Small load: $150 | Half load: $275 | Full load: $450
- Appliance: $75 | Furniture: $50 | Yard debris: $200

**Land Clearing:**
- Brush clearing (1/4 acre): $500 | Small tree: $150
- Medium tree: $350 | Stump: $100 | Full lot: $1500

**Property Cleanup:**
- General: $200 | Post-construction: $400 | Estate: $600 | Storm: $300

**Landscaping:**
- Mulch: $50-75/cuyd installed | Sod: $1.50-3.00/sqft
- Rock/gravel: $75-125/cuyd | Landscape border: $8-15/lnft
- Rubber mulch: $100-150/cuyd (lasts 10+ years)

### Building Changes Over Multiple Messages
The user may discuss changes across several messages before saying "do it" or "apply that" or "go ahead". When this happens:
- Keep track of what they want changed in your conversation
- When they say "go ahead", "apply it", "do it", "update it now", "make those changes" — THEN execute the update_quote action with ALL discussed changes combined
- Include EVERY field discussed across the conversation in one single update action
- Confirm what you're about to change before executing: "I'll update QTE-XXXX with: [list changes]. Go ahead?"

### Natural Language → Action Translation
When the user says things informally, translate to the right action:
- "add a 50% deposit" → payment_terms: {type: "deposit_balance", deposit_percentage: 50}
- "make it 3 monthly payments" → payment_terms: {type: "deposit_installments", num_installments: 3}
- "turn on warranty" or "add warranty term" → include warranty term ID in terms_conditions array
- "remove the lien rights" → remove that term ID from terms_conditions
- "make it commercial" → is_commercial: true
- "add financing" → show_financing: true
- "change the price of hedge trimming to 250" → update that line item
- "add mulch spreading for $100" → add new line item to existing items
- "delete the debris removal" → remove that item from line_items
- "set tax to 7%" → tax_rate: 7
- "expires in 2 weeks" → expiration_date: calculated date
- "start next monday" → start_date: calculated date

### Quote Building Rules
1. ALWAYS use realistic quantities — not 1 for everything
2. Include appropriate units (visit, sqft, cuyd, each, lot, hour)
3. ALWAYS fill scope_summary — 1-2 sentences describing the work
4. ALWAYS fill exclusions — list 3-5 things NOT included
5. ALWAYS fill warranty — default "All workmanship guaranteed for 30 days"
6. ALWAYS fill closing_statement — warm, professional close with phone number
7. If the job has a start date, include it
8. Calculate amounts correctly (qty × unit_price)
9. After creating, confirm with quote number, total, and summary
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
    if (searchQuery) {
      const searchResults = await webSearch(searchQuery);
      if (searchResults && searchResults !== "No results found." && searchResults !== "Search failed.") {
        contextNote += '\n\n## WEB SEARCH RESULTS for "' + searchQuery + '":\n' + searchResults + '\n\nUse these results to answer. Include source URLs.';
      }
    }

    // Smart data detection — keyword-based (no extra API call)
    const lm = lastUserMsg.toLowerCase();
    const mentionsData = /quote|estimate|customer|invoice|job|sherry|dave|john/i.test(lastUserMsg);
    const isLookup = /show|list|see|check|find|pull|get|view|look|open|status|how much|what.*quote|what.*customer|what.*invoice/i.test(lm);

    if (mentionsData && isLookup) {
      // Extract name — look for capitalized words that aren't common verbs
      const skipWords = new Set(["show", "me", "the", "all", "my", "see", "can", "you", "get", "find", "check", "look", "pull", "up", "list", "view", "open", "what", "how", "much", "quote", "quotes", "customer", "customers", "invoice", "invoices", "job", "jobs", "estimate", "for", "about", "from"]);
      const words = lastUserMsg.split(/\s+/);
      let searchName: string | null = null;
      for (const w of words) {
        const clean = w.replace(/[^a-zA-Z']/g, "");
        if (clean.length > 1 && clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase() && !skipWords.has(clean.toLowerCase())) {
          searchName = clean.replace(/'s$/, "");
          break;
        }
      }

      // Determine table
      let table = "quotes";
      if (/customer/i.test(lm)) table = "customers";
      else if (/invoice/i.test(lm)) table = "invoices";
      else if (/job/i.test(lm)) table = "jobs";

      let rows: any[] = [];
      if (table === "quotes" || table === "invoices") {
        let query = supabase.from(table).select("*, customers(name, email, phone, address)").order("created_at", { ascending: false }).limit(15);
        if (searchName) {
          const { data: mc } = await supabase.from("customers").select("id").ilike("name", "%" + searchName + "%");
          if (mc?.length) query = query.in("customer_id", mc.map((c: any) => c.id));
        }
        const { data } = await query;
        rows = data || [];
      } else {
        let query = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(15);
        if (searchName && table === "customers") query = query.ilike("name", "%" + searchName + "%");
        const { data } = await query;
        rows = data || [];
      }

      if (rows.length) {
        const summary = rows.map((r: any, i: number) => {
          const cn = r.customers?.name || "No customer";
          if (table === "customers") return (i+1) + ". " + (r.name || "?") + " | " + (r.phone || "") + " | " + (r.email || "") + " | " + (r.address || "");
          if (table === "quotes") {
            const items = (r.line_items || []).map((li: any) => li.description).filter(Boolean).join(", ");
            return (i+1) + ". " + r.quote_number + " | " + cn + " | $" + (r.total || 0) + " | " + (r.status || "draft") + " | " + (items || "no items") + (r.service_address ? " | " + r.service_address : "");
          }
          if (table === "invoices") return (i+1) + ". " + (r.invoice_number || "") + " | " + cn + " | $" + (r.total || 0) + " | " + (r.status || "") + " | paid: $" + (r.amount_paid || 0);
          if (table === "jobs") return (i+1) + ". " + (r.service_type || "") + " | " + (r.status || "") + " | $" + (r.amount || 0);
          return "";
        }).join("\n");
        contextNote += "\n\n## LIVE DATA — " + (searchName ? table.toUpperCase() + " for " + searchName : table.toUpperCase()) + ":\n" + summary + "\n\nPresent this clearly to the user.";
      } else {
        contextNote += "\n\n## LIVE DATA — " + table.toUpperCase() + (searchName ? " for " + searchName : "") + ": No records found.";
      }
    }

    // Pre-detect if this is an action request (create/update) with embedded data
    // If the user pastes a big JSON or detailed update, handle it server-side
    const hasJson = lastUserMsg.includes('"line_items"') || lastUserMsg.includes('"about_your_project"') || lastUserMsg.includes('"sections"');
    if (hasJson && (lm.includes('update') || lm.includes('edit') || lm.includes('apply') || lm.includes('change'))) {
      // Try to parse the user's message as a direct action
      try {
        const jsonMatch = lastUserMsg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const qNum = parsed.estimate_number || parsed.quote_number;
          if (qNum) {
            const { data: existing } = await supabase.from("quotes").select("id").eq("quote_number", qNum).single();
            if (existing) {
              const updates: any = { updated_at: new Date().toISOString() };

              if (parsed.service_address) updates.service_address = parsed.service_address;
              if (parsed.about_your_project) updates.ai_project_notes = parsed.about_your_project;
              if (parsed.scope_summary) updates.scope_summary = parsed.scope_summary;
              if (parsed.closing_statement) updates.closing_statement = parsed.closing_statement;
              if (parsed.notes) updates.notes = parsed.notes;
              if (parsed.exclusions) updates.exclusions = typeof parsed.exclusions === 'string' ? parsed.exclusions : JSON.stringify(parsed.exclusions);
              if (parsed.warranty) updates.warranty = parsed.warranty;
              if (parsed.start_date) updates.start_date = parsed.start_date;
              if (parsed.completion_date) updates.completion_date = parsed.completion_date;

              // Handle sections → flat line items
              if (parsed.sections && Array.isArray(parsed.sections)) {
                const allItems: any[] = [];
                for (const section of parsed.sections) {
                  for (const li of (section.line_items || [])) {
                    allItems.push({
                      id: "ai_" + Math.random().toString(36).slice(2, 8),
                      description: li.description || "",
                      quantity: li.quantity || 1,
                      unit: li.unit || "flat",
                      unit_price: li.rate || li.unit_price || 0,
                      amount: li.amount || (li.quantity || 1) * (li.rate || li.unit_price || 0),
                      section: section.label || undefined,
                    });
                  }
                }
                if (allItems.length > 0) {
                  updates.line_items = allItems;
                  updates.subtotal = allItems.reduce((s: number, i: any) => s + i.amount, 0);
                  updates.total = updates.subtotal;
                }
              } else if (parsed.line_items && Array.isArray(parsed.line_items)) {
                const items = parsed.line_items.map((li: any) => ({
                  id: "ai_" + Math.random().toString(36).slice(2, 8),
                  description: li.description || "",
                  quantity: li.quantity || 1,
                  unit: li.unit || "flat",
                  unit_price: li.rate || li.unit_price || 0,
                  amount: li.amount || (li.quantity || 1) * (li.rate || li.unit_price || 0),
                }));
                updates.line_items = items;
                updates.subtotal = items.reduce((s: number, i: any) => s + i.amount, 0);
                updates.total = updates.subtotal;
              }

              if (parsed.totals?.deposit_required) {
                updates.payment_terms = {
                  type: "deposit_balance",
                  deposit_amount: parsed.totals.deposit_required,
                  deposit_percentage: Math.round((parsed.totals.deposit_required / (updates.total || parsed.totals.total || 1)) * 100),
                  schedule: [
                    { label: "Deposit", amount: parsed.totals.deposit_required, status: "pending" },
                    { label: "Balance Due on Completion", amount: parsed.totals.balance_due_on_completion || (updates.total - parsed.totals.deposit_required), status: "pending" },
                  ],
                };
              }

              const { error } = await supabase.from("quotes").update(updates).eq("id", existing.id);
              const resultMsg = error
                ? "Failed to update " + qNum + ": " + error.message
                : "Quote " + qNum + " updated successfully with all your changes — service address, project notes, line items, closing statement, and payment terms all applied.";

              return NextResponse.json({ role: "assistant", content: "**" + resultMsg + "**\n\nYou can view the updated estimate in the Quotes tab." });
            }
          }
        }
      } catch (parseErr) {
        // Not valid JSON or couldn't process — fall through to normal AI call
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
        max_tokens: 4000,
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
              temperature: 0.7, max_tokens: 4000,
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

        if (action.type === "query" && action.data) {
          const table = action.data.table || "customers";
          const limit = Math.min(action.data.limit || 10, 25);
          const allowed = ["customers", "quotes", "invoices", "jobs"];
          if (allowed.includes(table)) {
            const { data: rows, error } = await supabase
              .from(table)
              .select("*")
              .order("created_at", { ascending: false })
              .limit(limit);
            if (error) {
              action.result = "Query failed: " + error.message;
            } else {
              action.queryResults = rows;
              action.result = rows?.length + " " + table + " found";
              // Inject results into content so AI can summarize
              const summary = (rows || []).map((r: any, i: number) => {
                if (table === "customers") return (i+1) + ". " + (r.name || "Unknown") + " — " + (r.phone || "no phone") + " — " + (r.email || "no email");
                if (table === "quotes") return (i+1) + ". " + (r.quote_number || "") + " — $" + (r.total || 0) + " — " + (r.status || "");
                if (table === "invoices") return (i+1) + ". " + (r.invoice_number || "") + " — $" + (r.total || 0) + " — " + (r.status || "");
                if (table === "jobs") return (i+1) + ". " + (r.service_type || "") + " — " + (r.status || "") + " — $" + (r.amount || 0);
                return JSON.stringify(r);
              }).join("\n");
              content += "\n\nHere are the results:\n" + summary;
            }
          } else {
            action.result = "Cannot query table: " + table;
          }
        }

        if (action.type === "create_customer" && action.data) {
          const insertData: any = {
            name: action.data.name || (action.data.first_name + " " + (action.data.last_name || "")).trim(),
            customer_type: action.data.customer_type || "residential",
          };
          if (action.data.email) insertData.email = action.data.email;
          if (action.data.phone) insertData.phone = action.data.phone;
          if (action.data.address) insertData.address = action.data.address;

          const { data: newCust, error } = await supabase
            .from("customers")
            .insert(insertData)
            .select()
            .single();

          if (error) {
            console.error("[ai-chat] create_customer error:", error);
            action.result = "Failed to create customer: " + error.message;
          } else {
            action.result = "Customer created: " + (newCust?.name || "");
            action.created_id = newCust?.id;
          }
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
            service_address: action.data.service_address || null,
            scope_summary: action.data.scope_summary || null,
            exclusions: action.data.exclusions || null,
            warranty: action.data.warranty || "All workmanship guaranteed for 30 days from completion.",
            closing_statement: action.data.closing_statement || null,
            start_date: action.data.start_date || null,
            completion_date: action.data.completion_date || null,
          }).select().single();

          if (error) action.result = "Failed: " + error.message;
          else action.result = "Quote " + quoteNumber + " created — $" + total.toFixed(2) + " total";
          action.created_id = newQuote?.id;
        }

        if (action.type === "update_quote" && action.data) {
          const qNum = action.data.quote_number;
          if (qNum) {
            const { data: existing } = await supabase
              .from("quotes")
              .select("id, subtotal, tax_rate, total, line_items, terms_conditions, payment_terms")
              .eq("quote_number", qNum)
              .single();

            if (existing) {
              const updates: any = { updated_at: new Date().toISOString() };
              const u = action.data.updates || action.data;

              // Text fields
              const textFields = ["service_address", "scope_summary", "exclusions", "warranty",
                "closing_statement", "ai_project_notes", "notes", "start_date", "completion_date"];
              for (const f of textFields) {
                if (u[f] !== undefined) updates[f] = u[f] || null;
              }

              // Number fields
              if (u.tax_rate !== undefined) updates.tax_rate = Number(u.tax_rate) || 0;

              // Boolean fields
              if (u.show_financing !== undefined) updates.show_financing = !!u.show_financing;
              if (u.is_commercial !== undefined) updates.is_commercial = !!u.is_commercial;

              // Date fields
              if (u.expiration_date !== undefined) updates.expiration_date = u.expiration_date || null;
              if (u.due_date !== undefined) updates.due_date = u.due_date || null;

              // Terms conditions (array of IDs)
              if (u.terms_conditions !== undefined) {
                updates.terms_conditions = Array.isArray(u.terms_conditions) ? u.terms_conditions : null;
              }

              // Payment terms (object)
              if (u.payment_terms !== undefined) {
                updates.payment_terms = u.payment_terms || null;
              }

              // Add individual line items (append to existing)
              if (u.add_items && Array.isArray(u.add_items)) {
                const currentItems = existing.line_items || [];
                const newItems = u.add_items.map((li: any) => ({
                  id: "ai_" + Math.random().toString(36).slice(2, 8),
                  description: li.description || "",
                  quantity: li.quantity || 1,
                  unit: li.unit || "flat",
                  unit_price: li.unit_price || li.rate || 0,
                  amount: li.amount || (li.quantity || 1) * (li.unit_price || li.rate || 0),
                  section: li.section || undefined,
                }));
                updates.line_items = [...currentItems, ...newItems];
                const subtotal = updates.line_items.reduce((s: number, li: any) => s + (li.amount || 0), 0);
                updates.subtotal = subtotal;
                const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : (existing.tax_rate || 0);
                updates.tax_amount = subtotal * (taxRate / 100);
                updates.total = subtotal + updates.tax_amount;
              }

              // Remove line items by description match
              if (u.remove_items && Array.isArray(u.remove_items)) {
                const currentItems = updates.line_items || existing.line_items || [];
                const removeDescs = u.remove_items.map((r: string) => r.toLowerCase());
                updates.line_items = currentItems.filter((li: any) =>
                  !removeDescs.some((rd: string) => (li.description || "").toLowerCase().includes(rd))
                );
                const subtotal = updates.line_items.reduce((s: number, li: any) => s + (li.amount || 0), 0);
                updates.subtotal = subtotal;
                const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : (existing.tax_rate || 0);
                updates.tax_amount = subtotal * (taxRate / 100);
                updates.total = subtotal + updates.tax_amount;
              }

              // Toggle terms on/off
              if (u.add_terms && Array.isArray(u.add_terms)) {
                const current = existing.terms_conditions || [];
                updates.terms_conditions = [...new Set([...current, ...u.add_terms])];
              }
              if (u.remove_terms && Array.isArray(u.remove_terms)) {
                const current = updates.terms_conditions || existing.terms_conditions || [];
                updates.terms_conditions = current.filter((id: string) => !u.remove_terms.includes(id));
              }

              // Line items (replace all)
              if (u.line_items && Array.isArray(u.line_items)) {
                const lineItems = u.line_items.map((li: any) => ({
                  id: li.id || ("ai_" + Math.random().toString(36).slice(2, 8)),
                  description: li.description || "",
                  quantity: li.quantity || 1,
                  unit: li.unit || "flat",
                  unit_price: li.unit_price || li.rate || 0,
                  amount: li.amount || (li.quantity || 1) * (li.unit_price || li.rate || 0),
                  section: li.section || undefined,
                }));
                updates.line_items = lineItems;
                const subtotal = lineItems.reduce((s: number, li: any) => s + li.amount, 0);
                updates.subtotal = subtotal;
                const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : (existing.tax_rate || 0);
                updates.tax_amount = subtotal * (taxRate / 100);
                updates.total = subtotal + updates.tax_amount;
              }

              // Recalc totals if tax_rate changed but no new line items
              if (u.tax_rate !== undefined && !u.line_items) {
                const subtotal = existing.subtotal || 0;
                updates.tax_amount = subtotal * (Number(u.tax_rate) / 100);
                updates.total = subtotal + updates.tax_amount;
              }

              const { error } = await supabase
                .from("quotes")
                .update(updates)
                .eq("id", existing.id);

              if (error) {
                action.result = "Failed to update: " + error.message;
              } else {
                const changedFields = Object.keys(updates).filter(k => k !== "updated_at");
                action.result = "Quote " + qNum + " updated — changed: " + changedFields.join(", ");
              }
            } else {
              action.result = "Quote " + qNum + " not found";
            }
          }
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
