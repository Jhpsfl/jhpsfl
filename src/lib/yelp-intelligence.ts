/**
 * yelp-intelligence.ts - Lead scoring, stage, temperature helpers
 * Client-side version (mirrors server-side intelligence.js on Oracle agent)
 */

export interface YelpMessage {
  role: 'customer' | 'ai' | 'admin' | 'system';
  text: string;
  ts: string;
}

export interface YelpConversation {
  id: string;
  customer_name: string | null;
  services: string[] | null;
  messages: YelpMessage[];
  lead_score?: number;
  lead_temperature?: string;
  conversation_stage?: string;
  sentiment?: string;
  last_customer_message_at?: string | null;
  first_message?: string;
  [key: string]: unknown;
}

export function temperatureColor(temp: string | undefined): string {
  switch (temp) {
    case 'hot': return '#ef4444';
    case 'warm': return '#f97316';
    case 'cold': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function temperatureEmoji(temp: string | undefined): string {
  switch (temp) {
    case 'hot': return '🔥';
    case 'warm': return '☀️';
    case 'cold': return '🧊';
    default: return '';
  }
}

export function stageLabel(stage: string | undefined): string {
  switch (stage) {
    case 'new': return 'New';
    case 'engaged': return 'Engaged';
    case 'scheduling': return 'Scheduling';
    case 'quoted': return 'Quoted';
    case 'won': return 'Won';
    case 'lost': return 'Lost';
    case 'stale': return 'Stale';
    default: return stage || 'New';
  }
}

export function sentimentColor(sentiment: string | undefined): string {
  switch (sentiment) {
    case 'positive': return '#22c55e';
    case 'frustrated': return '#f97316';
    case 'urgent': return '#ef4444';
    default: return '#6b7280';
  }
}

export function scoreBar(score: number): string {
  const filled = Math.round((score / 100) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function formatSilentTime(lastMsgAt: string | null | undefined): string {
  if (!lastMsgAt) return '';
  const ms = Date.now() - new Date(lastMsgAt).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return 'Active';
  if (hours < 24) return `Silent ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Silent ${days}d`;
}
