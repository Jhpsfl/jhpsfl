/**
 * build-yelp-agent.js
 * Run this once from C:\websites\jhps to scaffold all yelp-agent files
 * Usage: node build-yelp-agent.js
 */

const fs = require("fs");
const path = require("path");

const BASE = "C:/websites/yelp-agent";

function write(filename, content) {
  const fullPath = path.join(BASE, filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trimStart(), "utf8");
  console.log("wrote:", fullPath);
}

// ─── package.json ────────────────────────────────────────────────────────────
write("package.json", `
{
  "name": "yelp-agent",
  "version": "1.0.0",
  "description": "JHPS AI Yelp Leads Conversation Agent",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "login": "node index.js --login",
    "setup-db": "node setup-db.js"
  },
  "dependencies": {
    "puppeteer-core": "^24.37.5",
    "@google/genai": "^1.0.0",
    "dotenv": "^17.3.1"
  }
}
`);

// ─── .env ────────────────────────────────────────────────────────────────────
write(".env", `
# Yelp login credentials
YELP_EMAIL=FRLawnCareFL@gmail.com
YELP_PASSWORD=

# Gemini API key - get free at aistudio.google.com
GEMINI_API_KEY=

# Supabase
SUPABASE_URL=https://kxacgaevdoujpawovtbt.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YWNnYWV2ZG91anBhd292dGJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5Nzg2MywiZXhwIjoyMDg3MzczODYzfQ.FHmZeEn_G3ZpvprMKn2a-CQ8PcZPmX2CfHHTfuuRhFo

# Agent behavior
POLL_INTERVAL_MS=60000
AI_TRIGGER_DELAY_MS=480000
AI_FOLLOWUP_DELAY_MS=150000
MAX_AI_EXCHANGES=3
`);

// ─── logger.js ───────────────────────────────────────────────────────────────
write("logger.js", `
const fs = require("fs");
const path = require("path");
const LOG_FILE = path.join(__dirname, "agent.log");

function log(msg, level = "INFO") {
  const ts = new Date().toISOString();
  const line = \`[\${ts}] [\${level}] \${msg}\`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\\n");
}

function logError(msg) { log(msg, "ERROR"); }
function logWarn(msg)  { log(msg, "WARN");  }

module.exports = { log, logError, logWarn };
`);

// ─── conversation-manager.js ─────────────────────────────────────────────────
write("conversation-manager.js", `
require("dotenv").config();
const { log, logError } = require("./logger");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sbFetch(endpoint, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": \`Bearer \${SUPABASE_KEY}\`,
      "Prefer": method === "POST" ? "return=representation" : ""
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(\`\${SUPABASE_URL}/rest/v1/\${endpoint}\`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(\`Supabase \${method} /\${endpoint} (\${resp.status}): \${text}\`);
  }
  return method === "DELETE" || method === "PATCH" ? null : resp.json();
}

async function findConversation(yelpThreadId) {
  const data = await sbFetch(\`yelp_conversations?yelp_thread_id=eq.\${encodeURIComponent(yelpThreadId)}&limit=1\`);
  return data && data.length > 0 ? data[0] : null;
}

async function createConversation(conv) {
  const rows = await sbFetch("yelp_conversations", "POST", conv);
  return rows[0];
}

async function updateConversation(id, updates) {
  await sbFetch(\`yelp_conversations?id=eq.\${id}\`, "PATCH", updates);
}

async function appendMessage(id, role, text) {
  const rows = await sbFetch(\`yelp_conversations?id=eq.\${id}&select=messages,ai_exchange_count\`);
  const conv = rows[0];
  const messages = conv?.messages || [];
  messages.push({ role, text, ts: new Date().toISOString() });
  const updates = { messages };
  if (role === "customer") updates.last_customer_message_at = new Date().toISOString();
  if (role === "ai") updates.ai_exchange_count = (conv?.ai_exchange_count || 0) + 1;
  await updateConversation(id, updates);
  return messages;
}

async function getActiveConversations() {
  return sbFetch("yelp_conversations?status=eq.ai_active&order=created_at.desc");
}

async function markNeedsAttention(id) {
  await updateConversation(id, { status: "needs_attention" });
  log(\`Thread \${id} flagged as needs_attention\`);
}

module.exports = {
  findConversation, createConversation, updateConversation,
  appendMessage, getActiveConversations, markNeedsAttention
};
`);

// ─── ai-responder.js ─────────────────────────────────────────────────────────
write("ai-responder.js", `
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const { log } = require("./logger");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = \`You are a friendly assistant for Jenkins Home & Property Solutions (JHPS), a Central Florida property maintenance company (lawn care, pressure washing, junk removal, land clearing).

PERSONALITY: Warm, enthusiastic, conversational. NOT corporate. 2-3 sentences max per reply.

RULES:
1. NEVER commit to a specific time or date. Owner must confirm.
   OK: "We just need to check our schedule and confirm shortly!"
   NEVER: "We can be there at 2pm" or "See you tomorrow at 10"

2. If they suggest a specific time: "That could work great! We just need a moment to verify our crew schedule and will confirm ASAP."

3. If they say anytime or a general day: "Perfect, we have flexibility! Just need a few minutes to lock in the exact time with our crew."

4. Pricing questions: "We like to see the property first to give you an accurate quote - no surprises. We will go over everything on site."

5. After 3+ exchanges OR if customer seems frustrated/urgent: Add [NEEDS_ATTENTION] at the very end of your message.

6. Sign off as: - The JHPS Team

Keep it natural. Like a reliable local contractor texting back.\`;

async function generateReply(conversation, newCustomerMessage) {
  const contents = [];
  for (const msg of (conversation.messages || [])) {
    contents.push({
      role: msg.role === "customer" ? "user" : "model",
      parts: [{ text: msg.text }]
    });
  }
  contents.push({ role: "user", parts: [{ text: newCustomerMessage }] });

  log(\`Generating AI reply for conversation \${conversation.id}, \${contents.length} messages in context\`);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 200 }
  });

  const text = response.text().trim();
  const needsAttention = text.includes("[NEEDS_ATTENTION]") || (conversation.ai_exchange_count || 0) >= parseInt(process.env.MAX_AI_EXCHANGES || "3");
  const cleanText = text.replace("[NEEDS_ATTENTION]", "").trim();

  log(\`AI reply generated (\${cleanText.length} chars, needsAttention=\${needsAttention})\`);
  return { reply: cleanText, needsAttention };
}

async function generateFirstReply(lead) {
  const prompt = \`New Yelp lead:
Customer: \${lead.customer_name}
Services: \${(lead.services || []).join(", ") || "general maintenance"}
Location: \${lead.zip_code || "Central Florida"}
Urgency: \${lead.urgency || "not specified"}
Their message: "\${lead.first_message}"

Write a warm first response acknowledging their specific services and asking when they are available.\`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.7, maxOutputTokens: 200 }
  });

  return { reply: response.text().trim(), needsAttention: false };
}

module.exports = { generateReply, generateFirstReply };
`);

// ─── yelp-scraper.js ──────────────────────────────────────────────────────────
write("yelp-scraper.js", `
require("dotenv").config();
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const { log, logError } = require("./logger");

const CHROME_PATH = "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe";
const COOKIES_FILE = path.join(__dirname, "yelp-cookies.json");
const YELP_INBOX_URL = "https://biz.yelp.com/inbox";
const YELP_LOGIN_URL = "https://biz.yelp.com/login";

async function saveCookies(page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  log(\`Saved \${cookies.length} Yelp cookies\`);
}

async function loadCookies(page) {
  if (!fs.existsSync(COOKIES_FILE)) return false;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf8"));
    if (!cookies.length) return false;
    await page.setCookie(...cookies);
    log(\`Loaded \${cookies.length} Yelp cookies\`);
    return true;
  } catch (e) {
    logError(\`Failed to load cookies: \${e.message}\`);
    return false;
  }
}

async function launchBrowser(headless = true) {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: headless ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
           "--disable-blink-features=AutomationControlled", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 }
  });
}

async function doManualLogin() {
  log("Opening visible browser for manual Yelp login...");
  const browser = await launchBrowser(false);
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  await page.goto(YELP_LOGIN_URL, { waitUntil: "networkidle2" });
  log(">>> Browser open. Log into Yelp for Business manually. <<<");
  log(">>> Press ENTER here when you see your inbox. <<<");
  await new Promise(resolve => { process.stdin.resume(); process.stdin.once("data", resolve); });
  await saveCookies(page);
  log("Cookies saved! Future runs will be headless.");
  await browser.close();
}

// Parse leads from Yelp inbox page
async function scrapeInbox(page) {
  await page.goto(YELP_INBOX_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForTimeout(3000);

  const url = page.url();
  if (url.includes("/login") || url.includes("/signin")) {
    log("SESSION EXPIRED - cookies need refresh");
    return null; // Signal re-login needed
  }

  // Extract conversation threads from the inbox
  const threads = await page.evaluate(() => {
    const results = [];
    
    // Yelp inbox renders conversation items - grab them all
    const items = document.querySelectorAll('[class*="conversation"], [class*="thread"], [data-lead-id], [class*="inbox-item"], li[class*="message"]');
    
    items.forEach(item => {
      const text = item.innerText || "";
      const href = item.querySelector("a")?.href || "";
      const leadId = item.getAttribute("data-lead-id") || 
                     href.match(/lead[_-]?id[=\/]([\\w-]+)/i)?.[1] ||
                     href.match(/\\/inbox\\/([\\w-]+)/)?.[1] || null;
      
      if (!leadId || results.find(r => r.thread_id === leadId)) return;
      
      const isUnread = item.getAttribute("data-read") === "false" ||
                       item.className.includes("unread") ||
                       !!item.querySelector('[class*="unread"], [class*="new-message"]');

      const name = item.querySelector('[class*="name"], [class*="customer"], strong')?.innerText?.trim() || "Unknown";
      const preview = item.querySelector('[class*="preview"], [class*="message-text"], p')?.innerText?.trim() || text.slice(0, 200);
      
      results.push({ thread_id: leadId, customer_name: name, preview, is_unread: isUnread, href });
    });
    
    return results;
  });

  log(\`Found \${threads.length} threads in Yelp inbox\`);
  return threads;
}

// Open a specific thread and get all messages + project details
async function scrapeThread(page, threadId, threadHref) {
  const url = threadHref && threadHref.startsWith("http") ? threadHref : \`\${YELP_INBOX_URL}/\${threadId}\`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const messages = [];
    
    // Get all messages in the thread
    const msgEls = document.querySelectorAll('[class*="message-bubble"], [class*="chat-message"], [class*="MessageBubble"]');
    msgEls.forEach(el => {
      const isFromBusiness = el.className.includes("business") || el.className.includes("outgoing") || el.className.includes("sent");
      messages.push({
        role: isFromBusiness ? "business" : "customer",
        text: el.innerText?.trim() || ""
      });
    });

    // Get project details from the lead info panel
    const pageText = document.body.innerText;
    
    // Extract services, urgency, zip from structured Yelp lead data
    const serviceMatch = pageText.match(/(?:services?|looking for|need)[:\\s]+([^\\n]+)/i);
    const zipMatch = pageText.match(/\\b(3[2-4]\\d{3})\\b/); // Florida zip codes
    const urgencyMatch = pageText.match(/(?:when|timing)[:\\s]+([^\\n]+)/i);
    
    return {
      messages,
      services: serviceMatch ? [serviceMatch[1].trim()] : [],
      zip_code: zipMatch ? zipMatch[1] : null,
      urgency: urgencyMatch ? urgencyMatch[1].trim() : null,
      raw_text: pageText.slice(0, 2000)
    };
  });
}

// Send a reply in the Yelp inbox thread
async function sendReply(page, threadId, threadHref, replyText) {
  const url = threadHref && threadHref.startsWith("http") ? threadHref : \`\${YELP_INBOX_URL}/\${threadId}\`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Find the reply textarea
  const textarea = await page.$('textarea[placeholder*="message"], textarea[placeholder*="reply"], textarea[placeholder*="Response"], textarea[name*="message"], div[contenteditable="true"]');
  
  if (!textarea) {
    logError(\`Could not find reply textarea for thread \${threadId}\`);
    return false;
  }

  await textarea.click();
  await page.waitForTimeout(500);
  await textarea.type(replyText, { delay: 20 });
  await page.waitForTimeout(500);

  // Find and click the send button
  const sendBtn = await page.$('button[type="submit"], button[aria-label*="Send"], button[class*="send"]');
  if (!sendBtn) {
    logError(\`Could not find send button for thread \${threadId}\`);
    return false;
  }

  await sendBtn.click();
  await page.waitForTimeout(2000);
  log(\`Reply sent to thread \${threadId}\`);
  return true;
}

module.exports = { launchBrowser, loadCookies, saveCookies, doManualLogin, scrapeInbox, scrapeThread, sendReply };
`);

// ─── setup-db.js ─────────────────────────────────────────────────────────────
write("setup-db.js", `
require("dotenv").config();
const { log, logError } = require("./logger");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function runSQL(sql) {
  const resp = await fetch("https://api.supabase.com/v1/projects/kxacgaevdoujpawovtbt/database/query", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${SUPABASE_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  log("Setting up yelp_conversations table...");

  await runSQL(\`
    CREATE TABLE IF NOT EXISTS yelp_conversations (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      yelp_thread_id text UNIQUE NOT NULL,
      customer_name text,
      services text[] DEFAULT '{}',
      zip_code text,
      urgency text,
      first_message text,
      status text DEFAULT 'ai_active',
      ai_exchange_count int DEFAULT 0,
      messages jsonb DEFAULT '[]',
      thread_href text,
      last_customer_message_at timestamptz,
      last_ai_reply_at timestamptz,
      taken_over_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
  \`);
  log("Table created (or already exists)");

  await runSQL(\`ALTER TABLE yelp_conversations ENABLE ROW LEVEL SECURITY;\`);

  await runSQL(\`
    DO $$ BEGIN
      CREATE POLICY "service_role_all" ON yelp_conversations FOR ALL USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  \`);
  log("RLS + policy set");

  log("DB setup complete!");
}

main().catch(e => { logError(e.message); process.exit(1); });
`);

// ─── index.js (main agent loop) ──────────────────────────────────────────────
write("index.js", `
/**
 * index.js - JHPS Yelp AI Agent
 * Polls Yelp inbox, detects new leads/messages, fires AI replies
 * Run: node index.js         (headless daemon)
 * Run: node index.js --login (one-time manual Yelp login)
 */

require("dotenv").config();
const { log, logError, logWarn } = require("./logger");
const {
  launchBrowser, loadCookies, saveCookies,
  doManualLogin, scrapeInbox, scrapeThread, sendReply
} = require("./yelp-scraper");
const {
  findConversation, createConversation,
  updateConversation, appendMessage,
  getActiveConversations, markNeedsAttention
} = require("./conversation-manager");
const { generateFirstReply, generateReply } = require("./ai-responder");

const POLL_INTERVAL    = parseInt(process.env.POLL_INTERVAL_MS    || "60000");
const AI_FIRST_DELAY   = parseInt(process.env.AI_TRIGGER_DELAY_MS || "480000"); // 8 min
const AI_REPLY_DELAY   = parseInt(process.env.AI_FOLLOWUP_DELAY_MS || "150000"); // 2.5 min

// Track pending AI timers so we can cancel them if owner takes over
const pendingTimers = new Map();

function cancelTimer(convId) {
  if (pendingTimers.has(convId)) {
    clearTimeout(pendingTimers.get(convId));
    pendingTimers.delete(convId);
    log(\`Cancelled AI timer for \${convId}\`);
  }
}

async function scheduleAIReply(browser, conv, isFirst = false) {
  cancelTimer(conv.id);
  const delay = isFirst ? AI_FIRST_DELAY : AI_REPLY_DELAY;

  log(\`Scheduling AI reply for \${conv.id} in \${delay / 1000}s (isFirst=\${isFirst})\`);

  const timer = setTimeout(async () => {
    pendingTimers.delete(conv.id);
    try {
      // Re-fetch current state - owner may have taken over
      const fresh = await findConversation(conv.yelp_thread_id);
      if (!fresh || fresh.status !== "ai_active") {
        log(\`Thread \${conv.yelp_thread_id} no longer active, skipping AI reply\`);
        return;
      }

      // Get the latest customer message
      const msgs = fresh.messages || [];
      const lastCustomerMsg = [...msgs].reverse().find(m => m.role === "customer");
      if (!lastCustomerMsg) return;

      // Generate reply
      const { reply, needsAttention } = isFirst
        ? await generateFirstReply(fresh)
        : await generateReply(fresh, lastCustomerMsg.text);

      // Send via Playwright
      const page = await browser.newPage();
      try {
        await loadCookies(page);
        const sent = await sendReply(page, fresh.yelp_thread_id, fresh.thread_href, reply);
        if (sent) {
          await appendMessage(fresh.id, "ai", reply);
          await updateConversation(fresh.id, { last_ai_reply_at: new Date().toISOString() });
          if (needsAttention) await markNeedsAttention(fresh.id);
          log(\`AI replied to \${fresh.customer_name} (thread \${fresh.yelp_thread_id})\`);
        }
      } finally {
        await page.close();
      }
    } catch (err) {
      logError(\`AI reply failed for \${conv.id}: \${err.message}\`);
    }
  }, delay);

  pendingTimers.set(conv.id, timer);
}

async function pollInbox(browser) {
  log("Polling Yelp inbox...");
  const page = await browser.newPage();

  try {
    await loadCookies(page);
    const threads = await scrapeInbox(page);

    if (threads === null) {
      logWarn("Session expired - need manual login. Run: node index.js --login");
      return;
    }

    for (const thread of threads) {
      // Check if we already know about this thread
      let conv = await findConversation(thread.thread_id);

      if (!conv) {
        // Brand new lead - scrape full details
        log(\`New thread detected: \${thread.thread_id} (\${thread.customer_name})\`);
        const details = await scrapeThread(page, thread.thread_id, thread.href);

        const firstCustomerMsg = details.messages.find(m => m.role === "customer");

        conv = await createConversation({
          yelp_thread_id: thread.thread_id,
          customer_name: thread.customer_name,
          services: details.services,
          zip_code: details.zip_code,
          urgency: details.urgency,
          first_message: firstCustomerMsg?.text || thread.preview,
          thread_href: thread.href,
          messages: details.messages.map(m => ({ ...m, ts: new Date().toISOString() })),
          status: "ai_active",
          last_customer_message_at: new Date().toISOString()
        });

        log(\`Created conversation \${conv.id} for \${thread.customer_name}\`);
        await scheduleAIReply(browser, conv, true);

      } else if (conv.status === "ai_active" && thread.is_unread) {
        // Existing active thread has new message from customer
        log(\`New customer message in thread \${thread.thread_id}\`);
        const details = await scrapeThread(page, thread.thread_id, thread.href);
        const msgs = details.messages;
        const lastCustomer = [...msgs].reverse().find(m => m.role === "customer");

        if (lastCustomer) {
          await appendMessage(conv.id, "customer", lastCustomer.text);
          await scheduleAIReply(browser, conv, false);
        }
      }
    }

    // Refresh cookies after successful poll
    await saveCookies(page);

  } catch (err) {
    logError(\`Poll failed: \${err.message}\`);
  } finally {
    await page.close();
  }
}

async function main() {
  // One-time login mode
  if (process.argv.includes("--login")) {
    await doManualLogin();
    log("Login complete. Run 'node index.js' to start the agent.");
    process.exit(0);
  }

  log("=== JHPS Yelp AI Agent Starting ===");
  log(\`Poll interval: \${POLL_INTERVAL / 1000}s | First AI reply: \${AI_FIRST_DELAY / 1000}s | Follow-up: \${AI_REPLY_DELAY / 1000}s\`);

  const browser = await launchBrowser(true);
  log("Headless browser launched");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log("Shutting down...");
    for (const timer of pendingTimers.values()) clearTimeout(timer);
    await browser.close();
    process.exit(0);
  });

  // Initial poll + start interval
  await pollInbox(browser);
  setInterval(() => pollInbox(browser), POLL_INTERVAL);

  log(\`Agent running. Polling every \${POLL_INTERVAL / 1000}s.\`);
}

main().catch(err => {
  logError(\`FATAL: \${err.message}\`);
  process.exit(1);
});
`);

// ─── start.bat (easy launch) ─────────────────────────────────────────────────
write("start.bat", `
@echo off
echo Starting JHPS Yelp AI Agent...
cd /d C:\\websites\\yelp-agent
node index.js
pause
`);

write("login.bat", `
@echo off
echo Opening Yelp login browser...
cd /d C:\\websites\\yelp-agent
node index.js --login
pause
`);

console.log("\nAll files written! Next steps:");
console.log("  cd C:\\websites\\yelp-agent");
console.log("  npm install");
console.log("  node setup-db.js");
console.log("  Fill in YELP_PASSWORD and GEMINI_API_KEY in .env");
console.log("  node index.js --login   (one-time Yelp login)");
console.log("  node index.js           (start the agent)");
