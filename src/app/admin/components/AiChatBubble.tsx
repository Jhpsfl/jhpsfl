'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Inline SVG icons (JHPS doesn't use lucide-react)
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconSend = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const IconLoader = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
);
const IconSparkles = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
const IconMinimize = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
);
const IconHistory = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
);
const IconPlus = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconTrash = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const IconMove = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
);
const IconChat = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);

interface Message { role: 'user' | 'assistant'; content: string; }
interface Conversation { id: string; title: string; summary: string | null; token_estimate: number; compacted: boolean; created_at: string; updated_at: string; }

type DisplayMode = 'full' | 'minimized' | 'floating';

const TAB_PROMPTS: Record<string, string[]> = {
  overview: ['How are we doing this month?', 'Show recent quotes', 'Any overdue invoices?', 'Dashboard stats'],
  customers: ['Search for a customer', 'Create a new customer', 'Show commercial customers', 'Who signed up recently?'],
  quotes: ['Create a new quote', 'Show all draft quotes', 'Find accepted quotes', 'Quotes expiring soon?'],
  invoices: ['Show unpaid invoices', 'Create an invoice', 'Any overdue invoices?', 'Record a payment'],
  jobs: ['Show active jobs', 'Completed jobs this week?', 'Create a job', 'Show scheduled jobs'],
  payments: ['Show recent payments', 'Revenue this month?', 'Find payments by customer', 'Cash payments today'],
  subscriptions: ['Active subscriptions', 'Paused subscriptions?', 'Create a subscription', 'Billing due soon?'],
  yelp_leads: ['Show new Yelp leads', 'Any needs attention?', 'Reply to a lead', 'All Yelp conversations'],
  video_leads: ['New video leads', 'Unreviewed leads?', 'Send a quote to a lead', 'Recent submissions'],
  messages: ['Show unread emails', 'Search emails', 'Compose an email', 'Show sent messages'],
  analytics: ['Revenue breakdown', 'Quote conversion rate', 'Customer growth', 'How are we doing?'],
};
const FLOATING_PROMPTS = ['New quote', 'Search customers', 'Dashboard stats'];

export default function AiChatBubble({ activeTab = 'overview' }: { activeTab?: string }) {
  const [open, setOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Thinking...');
  const [aiModel, setAiModel] = useState<'claude' | 'groq'>('claude');
  const [unread, setUnread] = useState(0);

  // Chat history
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tokenEstimate, setTokenEstimate] = useState(0);

  // Floating drag
  const [floatPos, setFloatPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      try { const s = sessionStorage.getItem('jhps-ai-float'); if (s) return JSON.parse(s); } catch {}
    }
    return { x: -1, y: -1 };
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (floatPos.x === -1 && typeof window !== 'undefined')
      setFloatPos({ x: window.innerWidth - 320, y: window.innerHeight - 480 });
  }, [floatPos]);
  useEffect(() => {
    if (floatPos.x >= 0 && typeof window !== 'undefined')
      sessionStorage.setItem('jhps-ai-float', JSON.stringify(floatPos));
  }, [floatPos]);

  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [messages, loading]);
  useEffect(() => { if (open && displayMode !== 'minimized') { setTimeout(() => inputRef.current?.focus(), 200); setUnread(0); } }, [open, displayMode]);

  // ── Conversation management ──
  const fetchConversations = useCallback(async () => {
    try { const res = await fetch('/api/admin/ai-conversations'); if (res.ok) { const d = await res.json(); setConversations(d.conversations || []); } } catch {}
  }, []);
  useEffect(() => { if (open) fetchConversations(); }, [open, fetchConversations]);

  const startNewChat = async () => {
    setMessages([]); setTokenEstimate(0);
    try {
      const res = await fetch('/api/admin/ai-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', title: 'New Chat' }) });
      if (res.ok) { const d = await res.json(); setActiveConvId(d.conversation.id); fetchConversations(); }
    } catch {}
    setShowHistory(false);
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch('/api/admin/ai-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load', id }) });
      if (res.ok) { const d = await res.json(); setMessages(d.conversation.messages || []); setActiveConvId(id); setTokenEstimate(d.conversation.token_estimate || 0); }
    } catch {}
    setShowHistory(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await fetch('/api/admin/ai-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }); } catch {}
    if (activeConvId === id) { setMessages([]); setActiveConvId(null); }
    fetchConversations();
  };

  // ── Send message ──
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await fetch('/api/admin/ai-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', title: text.slice(0, 60) }) });
        if (res.ok) { const d = await res.json(); convId = d.conversation.id; setActiveConvId(convId); fetchConversations(); }
      } catch {}
    }

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const lm = text.toLowerCase();
    if (lm.includes('send') || lm.includes('email') || lm.includes('reply')) setLoadingStatus('Sending...');
    else if (lm.includes('search') || lm.includes('look up') || lm.includes('find')) setLoadingStatus('Searching...');
    else if (lm.includes('create') || lm.includes('make') || lm.includes('new') || lm.includes('quote') || lm.includes('invoice')) setLoadingStatus('Creating...');
    else if (lm.includes('update') || lm.includes('edit') || lm.includes('change')) setLoadingStatus('Updating...');
    else if (lm.includes('list') || lm.includes('show') || lm.includes('how many') || lm.includes('stats')) setLoadingStatus('Loading data...');
    else setLoadingStatus('Thinking...');

    try {
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), currentTab: activeTab, useModel: aiModel }),
      });
      const data = await res.json();
      const reply: Message = { role: 'assistant', content: data.content || data.error || 'Sorry, something went wrong.' };
      const finalMessages = [...newMessages, reply];
      setMessages(finalMessages);
      if (displayMode === 'minimized' || !open) setUnread(prev => prev + 1);

      const actionList = data.actions || (data.action ? [data.action] : []);
      for (const act of actionList) {
        if (act.tab) window.dispatchEvent(new CustomEvent('ai-navigate', { detail: act.tab }));
        if (act.created_id) window.dispatchEvent(new CustomEvent('ai-refresh'));
      }

      if (convId) {
        const title = newMessages.length <= 1 ? text.slice(0, 60) : undefined;
        try {
          await fetch('/api/admin/ai-conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: convId, messages: finalMessages, title }) })
            .then(r => r.json()).then(d => setTokenEstimate(d.token_estimate || 0));
          fetchConversations();
        } catch {}
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Try again.' }]);
    }
    setLoading(false);
  };

  // ── Drag handlers ──
  const onDragStart = (e: React.PointerEvent) => {
    if (displayMode !== 'floating') return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setFloatPos({
      x: Math.max(0, Math.min(window.innerWidth - 310, dragRef.current.origX + (e.clientX - dragRef.current.startX))),
      y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.origY + (e.clientY - dragRef.current.startY))),
    });
  };
  const onDragEnd = () => { dragRef.current = null; };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        processed = `<span style="color:#22c55e;margin-right:4px">&#8226;</span>${processed.slice(2)}`;
        return <div key={i} style={{ display: 'flex', alignItems: 'flex-start', paddingLeft: 8, paddingTop: 2, paddingBottom: 2 }} dangerouslySetInnerHTML={{ __html: processed }} />;
      }
      if (!processed.trim()) return <div key={i} style={{ height: 8 }} />;
      return <div key={i} style={{ paddingTop: 2, paddingBottom: 2 }} dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  const isFloating = displayMode === 'floating';

  // ── Minimized pill (right edge) ──
  if (!open || displayMode === 'minimized') {
    return (
      <button onClick={() => { setOpen(true); setDisplayMode('full'); }} style={{
        position: 'fixed', zIndex: 9999, top: '50%', right: 0, transform: 'translateY(-50%)',
        width: 32, height: 80, borderRadius: '12px 0 0 12px',
        background: 'linear-gradient(180deg, #22c55e, #16a34a)', boxShadow: '-2px 0 12px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer', padding: 0,
        writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const,
      }}>
        <span style={{ transform: 'rotate(90deg)', marginBottom: 4, display: 'inline-block', color: '#000' }}><IconSparkles size={16} /></span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#000', letterSpacing: 1 }}>AI</span>
        {unread > 0 && <span style={{ position: 'absolute', top: -4, left: -4, width: 16, height: 16, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
      </button>
    );
  }

  // ── History panel ──
  const HistoryPanel = () => (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#0a0a0a', display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Chat History</span>
        <button onClick={() => setShowHistory(false)} style={{ padding: 6, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}><IconX size={18} /></button>
      </div>
      <button onClick={startNewChat} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 12px 8px', padding: '10px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, color: '#22c55e', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        <IconPlus size={16} /> New Chat
      </button>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {conversations.length === 0
          ? <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14, paddingTop: 32 }}>No saved chats yet</p>
          : conversations.map(conv => (
            <button key={conv.id} onClick={() => loadConversation(conv.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
              textAlign: 'left', border: 'none', cursor: 'pointer', marginBottom: 4,
              background: activeConvId === conv.id ? 'rgba(34,197,94,0.1)' : 'transparent',
            }}>
              <span style={{ color: activeConvId === conv.id ? '#22c55e' : 'rgba(255,255,255,0.2)', flexShrink: 0 }}><IconChat size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: activeConvId === conv.id ? '#22c55e' : 'rgba(255,255,255,0.6)', fontWeight: activeConvId === conv.id ? 600 : 400 }}>{conv.title}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: '2px 0 0' }}>{new Date(conv.updated_at).toLocaleDateString()}</p>
              </div>
              <button onClick={(e) => deleteConversation(conv.id, e)} style={{ padding: 4, color: 'rgba(255,255,255,0.1)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><IconTrash size={14} /></button>
            </button>
          ))}
      </div>
    </div>
  );

  // ── Main panel ──
  const panelStyle: React.CSSProperties = isFloating ? {
    position: 'fixed', zIndex: 9999, width: 310, height: 420,
    left: floatPos.x, top: floatPos.y,
    background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.1)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  } : {
    position: 'fixed', zIndex: 9999,
    inset: 12,
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.1)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };

  // Side panel on wider screens
  if (!isFloating && typeof window !== 'undefined' && window.innerWidth >= 640) {
    Object.assign(panelStyle, { inset: undefined, top: 16, bottom: 80, right: 16, left: 'auto', width: 480 });
  }

  return (
    <div style={panelStyle}>
      {showHistory && <HistoryPanel />}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isFloating ? '8px 10px' : '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, background: '#0f0f0f',
        cursor: isFloating ? 'grab' : undefined, touchAction: isFloating ? 'none' : undefined,
      }}
        onPointerDown={isFloating ? onDragStart : undefined}
        onPointerMove={isFloating ? onDragMove : undefined}
        onPointerUp={isFloating ? onDragEnd : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }} style={{ padding: 6, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }} title="Chat history">
            <IconHistory size={isFloating ? 14 : 18} />
          </button>
          <div style={{ width: isFloating ? 24 : 32, height: isFloating ? 24 : 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <IconSparkles size={isFloating ? 12 : 16} />
          </div>
          <div>
            <span style={{ fontSize: isFloating ? 13 : 15, fontWeight: 600, color: '#fff', display: 'block', lineHeight: 1.2 }}>JHPS Assistant</span>
            {!isFloating && <span style={{ fontSize: 11, color: '#22c55e' }}>Online</span>}
          </div>
          {isFloating && <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}><IconMove size={12} /></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isFloating && (
            <button onClick={() => setAiModel(prev => prev === 'claude' ? 'groq' : 'claude')} style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: aiModel === 'claude' ? 'rgba(34,197,94,0.15)' : 'rgba(96,165,250,0.15)',
              color: aiModel === 'claude' ? '#22c55e' : '#60a5fa',
              border: `1px solid ${aiModel === 'claude' ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)'}`,
            }}>{aiModel === 'claude' ? 'Claude' : 'Groq'}</button>
          )}
          <button onClick={startNewChat} style={{ padding: 6, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }} title="New chat"><IconPlus size={isFloating ? 14 : 16} /></button>
          <button onClick={() => setDisplayMode(isFloating ? 'full' : 'floating')} style={{ padding: 6, color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }} title={isFloating ? 'Expand' : 'Float'}><IconMove size={isFloating ? 14 : 16} /></button>
          <button onClick={() => setDisplayMode('minimized')} style={{ padding: 6, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}><IconMinimize size={isFloating ? 14 : 16} /></button>
          <button onClick={() => setOpen(false)} style={{ padding: 6, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}><IconX size={isFloating ? 14 : 16} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: isFloating ? 8 : 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: isFloating ? 16 : 24 }}>
            <div style={{ color: 'rgba(34,197,94,0.3)', margin: '0 auto 8px', width: 'fit-content' }}><IconSparkles size={isFloating ? 24 : 32} /></div>
            <p style={{ fontSize: isFloating ? 14 : 16, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>How can I help?</p>
            <p style={{ fontSize: isFloating ? 12 : 14, color: 'rgba(255,255,255,0.25)', margin: '0 0 16px' }}>Ask about customers, quotes, invoices, or your business</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {(isFloating ? FLOATING_PROMPTS : (TAB_PROMPTS[activeTab] || TAB_PROMPTS.overview)).map(q => (
                <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{
                  padding: isFloating ? '6px 8px' : '8px 12px', fontSize: isFloating ? 12 : 13,
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderRadius: 8, border: 'none', cursor: 'pointer',
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: isFloating ? 6 : 10 }}>
            <div style={{
              maxWidth: isFloating ? '95%' : '90%', borderRadius: 16, padding: isFloating ? '8px 12px' : '10px 16px',
              fontSize: isFloating ? 13 : 15, lineHeight: 1.5,
              ...(msg.role === 'user'
                ? { background: 'rgba(34,197,94,0.15)', color: '#fff', borderBottomRightRadius: 6 }
                : { background: '#111', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', borderBottomLeftRadius: 6 }),
            }}>
              {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div style={{
              background: '#111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, borderBottomLeftRadius: 6,
              padding: isFloating ? '8px 12px' : '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: isFloating ? 13 : 15,
            }}>
              <span style={{ color: '#22c55e' }}><IconLoader size={isFloating ? 14 : 16} /></span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{loadingStatus}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: isFloating ? 8 : '10px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, background: '#0f0f0f', display: 'flex', gap: 8 }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask anything..." disabled={loading}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: isFloating ? '8px 12px' : '12px 16px', color: '#fff', fontSize: isFloating ? 13 : 15, outline: 'none' }}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
          background: '#22c55e', color: '#000', borderRadius: 12, border: 'none', cursor: 'pointer',
          padding: isFloating ? '8px 10px' : '10px 14px', opacity: loading || !input.trim() ? 0.3 : 1, flexShrink: 0,
        }}><IconSend size={isFloating ? 12 : 14} /></button>
      </div>
    </div>
  );
}
