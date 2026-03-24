/**
 * Rule-based spam filter — zero external API calls, runs instantly.
 * Returns { isSpam: boolean, score: number, reasons: string[] }
 * Score 0-100: 0 = definitely legit, 100 = definitely spam
 * Threshold: >= 60 = spam
 */

// ── Disposable / throwaway email domains ──
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'mailnesia.com', 'maildrop.cc', 'trashmail.com',
  'temp-mail.org', 'fakeinbox.com', 'mailcatch.com', 'mintemail.com',
  'mohmal.com', 'burnermail.io', 'discard.email', 'mailsac.com',
  'tmail.gg', 'tempail.com', 'tmpmail.net', 'tmpmail.org',
]);

// ── Known bulk sender / spam domains ──
const SPAM_DOMAINS = new Set([
  'marketing.', 'promo.', 'deals.', 'offers.', 'newsletter.',
  'bulk.', 'mass.', 'blast.', 'campaign.', 'broadcast.',
]);

// ── Spam phrases (subject + body) — weighted ──
const SPAM_PHRASES: [RegExp, number][] = [
  // High confidence spam
  [/\bcongratulations?\b.*\b(won|winner|prize|lottery|selected)\b/i, 25],
  [/\b(nigerian?|prince|inheritance|beneficiary)\b.*\b(million|thousand|usd|funds)\b/i, 30],
  [/\bunsubscribe\b/i, 5],
  [/\bclaim\s+(your|now|today|immediately)\b/i, 15],
  [/\b(viagra|cialis|pharmacy|pills|medication)\b/i, 25],
  [/\b(bitcoin|crypto|investment|forex)\s*(opportunity|profit|return|trading)\b/i, 20],
  [/\b(earn|make)\s*\$?\d+[k,]?\s*(per|a|every)\s*(day|week|month|hour)\b/i, 20],
  [/\bact\s*(now|fast|immediately|today|quick)\b/i, 8],
  [/\blimited\s*time\s*(offer|deal|only)\b/i, 10],
  [/\b(100%\s*free|completely\s*free|no\s*cost|zero\s*cost)\b/i, 10],
  [/\b(click\s*here|click\s*below|click\s*now)\b/i, 8],
  [/\b(dear\s*(sir|madam|friend|customer|user|beneficiary))\b/i, 15],
  [/\b(wire\s*transfer|western\s*union|money\s*gram|moneygram)\b/i, 20],
  [/\b(account\s*(suspended|locked|compromised|verify|confirm))\b/i, 15],
  [/\b(social\s*security|ssn|tax\s*id)\s*(number|verify|confirm)\b/i, 20],
  [/\b(password|login|credential)s?\s*(expire|reset|verify|confirm|update)\b/i, 12],
  [/\bseo\s*(service|rank|optimization|expert|agency)\b/i, 15],
  [/\bweb\s*(design|development|traffic)\s*(service|agency|offer|package)\b/i, 12],
  [/\b(backlink|link\s*building|guest\s*post|domain\s*authority)\b/i, 15],
  [/\b(bulk\s*email|email\s*list|email\s*marketing\s*service)\b/i, 18],
  [/\b(lose\s*weight|weight\s*loss|diet\s*pill|fat\s*burn)\b/i, 20],
  [/\b(enlargement|enhancement)\b/i, 20],
  [/\b(casino|gambling|poker|slot|jackpot)\b/i, 18],
  [/\b(loan|debt\s*relief|mortgage|refinance)\s*(offer|approval|pre-?approved)\b/i, 12],
  [/\b(work\s*from\s*home|home\s*based\s*business|be\s*your\s*own\s*boss)\b/i, 15],
  [/\bdouble\s*your\s*(money|income|investment)\b/i, 20],
  [/\bguaranteed\s*(income|results|return|profit)\b/i, 15],
  [/\bno\s*(experience|skill)\s*(needed|required|necessary)\b/i, 12],
  [/\bmillion\s*(dollar|usd|euro)\b/i, 15],
  [/\b(free\s*gift|free\s*money|free\s*iphone|free\s*laptop)\b/i, 20],
  [/\bthis\s*is\s*not\s*spam\b/i, 15],
];

// ── Suspicious link patterns ──
const SUSPICIOUS_LINK_PATTERNS = [
  /https?:\/\/bit\.ly\//i,
  /https?:\/\/tinyurl\.com\//i,
  /https?:\/\/t\.co\//i,
  /https?:\/\/goo\.gl\//i,
  /https?:\/\/rb\.gy\//i,
  /https?:\/\/is\.gd\//i,
  /https?:\/\/ow\.ly\//i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, // IP address URLs
];

// ── Whitelisted domains (never spam) ──
const WHITELIST_DOMAINS = new Set([
  'yelp.com', 'messaging.yelp.com',
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'jhpsfl.com',
  'resend.com',
  'squareup.com', 'square.com',
  'clerk.com', 'clerk.dev',
  'stripe.com',
  'google.com', 'google.com.au',
  'apple.com',
  'vercel.com',
  'github.com',
  'supabase.com', 'supabase.io',
]);

export function checkSpam(params: {
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
}): { isSpam: boolean; score: number; reasons: string[] } {
  const { from_email, subject, body_text, body_html } = params;
  let score = 0;
  const reasons: string[] = [];

  const domain = from_email.split('@')[1]?.toLowerCase() || '';
  const text = `${subject} ${body_text || ''} ${body_html?.replace(/<[^>]+>/g, '') || ''}`.toLowerCase();

  // ── Whitelist check — skip everything if trusted domain ──
  for (const wd of WHITELIST_DOMAINS) {
    if (domain === wd || domain.endsWith('.' + wd)) {
      return { isSpam: false, score: 0, reasons: ['whitelisted domain'] };
    }
  }

  // ── Existing thread check is handled by caller ──

  // ── Disposable email domain ──
  if (DISPOSABLE_DOMAINS.has(domain)) {
    score += 30;
    reasons.push('disposable email domain');
  }

  // ── Spam subdomain pattern ──
  for (const prefix of SPAM_DOMAINS) {
    if (domain.startsWith(prefix)) {
      score += 15;
      reasons.push(`spam subdomain: ${prefix}`);
      break;
    }
  }

  // ── Phrase matching ──
  for (const [pattern, weight] of SPAM_PHRASES) {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(`spam phrase: ${pattern.source.substring(0, 40)}`);
      if (score >= 60) break; // Early exit
    }
  }

  // ── Suspicious links ──
  const html = body_html || '';
  let suspiciousLinks = 0;
  for (const pat of SUSPICIOUS_LINK_PATTERNS) {
    if (pat.test(html) || pat.test(body_text || '')) {
      suspiciousLinks++;
    }
  }
  if (suspiciousLinks > 0) {
    score += suspiciousLinks * 8;
    reasons.push(`${suspiciousLinks} suspicious link(s)`);
  }

  // ── Too many links (>10 in body) ──
  const linkCount = (html.match(/https?:\/\//gi) || []).length;
  if (linkCount > 10) {
    score += 10;
    reasons.push(`excessive links (${linkCount})`);
  }

  // ── ALL CAPS subject ──
  if (subject.length > 10 && subject === subject.toUpperCase() && /[A-Z]/.test(subject)) {
    score += 12;
    reasons.push('ALL CAPS subject');
  }

  // ── Empty body with attachment (phishing pattern) ──
  if (!body_text?.trim() && !body_html?.trim()) {
    score += 10;
    reasons.push('empty body');
  }

  // ── No-reply sender to a business inbox (usually automated/marketing) ──
  if (from_email.includes('noreply') || from_email.includes('no-reply') || from_email.includes('donotreply')) {
    score += 5;
    reasons.push('no-reply sender');
  }

  // ── Multiple exclamation/question marks in subject ──
  const exclCount = (subject.match(/[!?]/g) || []).length;
  if (exclCount >= 3) {
    score += 8;
    reasons.push(`excessive punctuation in subject (${exclCount})`);
  }

  // ── Dollar signs / money amounts in subject ──
  if (/\$\d/.test(subject) && !/invoice|receipt|payment|estimate|quote/i.test(subject)) {
    score += 10;
    reasons.push('money amount in subject (non-business)');
  }

  // Cap at 100
  score = Math.min(100, score);

  return { isSpam: score >= 60, score, reasons };
}

/**
 * Optional Groq AI spam check for borderline emails (score 30-59).
 * Returns true if Groq thinks it's spam. Falls back to false on error.
 */
export async function groqSpamCheck(params: {
  from_email: string;
  subject: string;
  body_preview: string;
}): Promise<boolean> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return false;

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 10,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You are a spam email classifier. Reply with only "SPAM" or "HAM". Nothing else.' },
          { role: 'user', content: `From: ${params.from_email}\nSubject: ${params.subject}\n\n${params.body_preview.substring(0, 500)}` },
        ],
      }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content?.trim()?.toUpperCase() || '';
    return answer === 'SPAM';
  } catch {
    return false;
  }
}
