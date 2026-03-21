'use client';

import { useState, useRef, useEffect } from 'react';
// JHPS version - no usePathname needed (single page app)
// Inline SVG icons (JHPS doesn't use lucide-react)
const IconX = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconSend = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const IconLoader = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
);
const IconSparkles = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
const IconMinimize = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChatBubble() {
  const pathname = '/admin';
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('jhps_ai_chat');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Thinking...');
  const [aiModel, setAiModel] = useState<'claude' | 'groq'>('groq');
  const [lastModel, setLastModel] = useState('');
  const [unread, setUnread] = useState(0);

  // Persist chat to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem('jhps_ai_chat', JSON.stringify(messages.slice(-50))); } catch {}
    }
  }, [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setUnread(0);
    }
  }, [open, minimized]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Detect what kind of request this is for status display
    const lm = text.toLowerCase();
    if (lm.includes('search') || lm.includes('look up') || lm.includes('find')) setLoadingStatus('Searching...');
    else if (lm.includes('create') || lm.includes('make') || lm.includes('new')) setLoadingStatus('Creating...');
    else if (lm.includes('update') || lm.includes('edit') || lm.includes('change') || lm.includes('modify')) setLoadingStatus('Updating...');
    else if (lm.includes('list') || lm.includes('show') || lm.includes('how many')) setLoadingStatus('Loading data...');
    else setLoadingStatus('Thinking...');

    try {
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          currentTab: pathname,
          useModel: aiModel,
        }),
      });

      const data = await res.json();

      // Check if response was cut off (incomplete action block)
      let content = data.content || data.error || 'Sorry, something went wrong.';
      if (content.includes('```action') && !content.includes('```\n') && !content.endsWith('```')) {
        // Response was truncated — the action block is incomplete
        // Show what we got and add a note
        content = content.replace(/```action[\s\S]*$/, '').trim();
        if (!content) content = 'Working on that — the request was too large for one response. Try breaking it into smaller pieces, or just provide the key changes.';
      }

      const reply: Message = {
        role: 'assistant',
        content,
      };
      setMessages(prev => [...prev, reply]);
      if (data.model) setLastModel(data.model);
      if (minimized || !open) setUnread(prev => prev + 1);

      // Handle actions
      if (data.action) {
        if (data.action.type === 'navigate' && data.action.data?.tab) {
          window.dispatchEvent(new CustomEvent('ai-navigate', { detail: data.action.data.tab }));
        }
        if (data.action.type === 'create_quote' && data.action.created_id) {
          // Navigate to quotes tab and refresh
          window.dispatchEvent(new CustomEvent('ai-navigate', { detail: 'quotes' }));
          window.dispatchEvent(new CustomEvent('ai-refresh'));
        }
        if (data.action.type === 'create_invoice' && data.action.created_id) {
          window.dispatchEvent(new CustomEvent('ai-navigate', { detail: 'invoices' }));
          window.dispatchEvent(new CustomEvent('ai-refresh'));
        }
        if (data.action.type === 'create_customer' && data.action.created_id) {
          window.dispatchEvent(new CustomEvent('ai-navigate', { detail: 'customers' }));
          window.dispatchEvent(new CustomEvent('ai-refresh'));
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Try again.' }]);
    }

    setLoading(false);
  };

  // Simple markdown rendering (bold, bullets)
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Bullet points
      if (processed.startsWith('- ') || processed.startsWith('• ')) {
        processed = `<span class="text-[#22c55e] mr-1">•</span>${processed.slice(2)}`;
        return <div key={i} className="flex items-start gap-0 pl-2 py-0.5" dangerouslySetInnerHTML={{ __html: processed }} />;
      }
      if (!processed.trim()) return <div key={i} className="h-2" />;
      return <div key={i} className="py-0.5" dangerouslySetInnerHTML={{ __html: processed }} />;
    });
  };

  // Always show on admin page

  // Pull-out tab on right edge (closed or minimized)
  if (!open || minimized) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className="fixed z-[9999] flex items-center justify-center shadow-2xl transition-all active:scale-95 hover:translate-x-[-4px]"
        style={{
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          width: '32px',
          height: '80px',
          borderRadius: '12px 0 0 12px',
          background: 'linear-gradient(180deg, #22c55e, #16a34a)',
          boxShadow: '-2px 0 12px rgba(0,0,0,0.3)',
          writingMode: 'vertical-rl' as const,
          textOrientation: 'mixed' as const,
        }}
      >
        <IconSparkles size={16} className="text-black" style={{ transform: 'rotate(90deg)', marginBottom: '4px' }} />
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#000', letterSpacing: '1px' }}>AI</span>
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  }

  // Full chat panel
  return (
    <div className="fixed inset-3 sm:inset-4 sm:left-auto sm:w-[480px] sm:top-4 sm:bottom-20 z-[9999] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(201,168,76,0.1)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0 bg-[#0f0f0f]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <IconSparkles size={16} className="text-black" />
          </div>
          <div>
            <span className="text-[16px] font-semibold text-white block leading-tight">JHPS Assistant</span>
            <span className="text-[12px] text-green-400">Online</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAiModel(prev => prev === 'claude' ? 'groq' : 'claude')}
            className="px-2 py-1 rounded text-[11px] font-semibold transition-colors"
            style={{
              background: aiModel === 'claude' ? 'rgba(210,160,60,0.15)' : 'rgba(34,197,94,0.15)',
              color: aiModel === 'claude' ? '#d2a03c' : '#22c55e',
              border: '1px solid ' + (aiModel === 'claude' ? 'rgba(210,160,60,0.3)' : 'rgba(34,197,94,0.3)'),
            }}
            title="Switch AI model"
          >
            {aiModel === 'claude' ? 'Claude' : 'Groq'}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); try { localStorage.removeItem('jhps_ai_chat'); } catch {} }}
              className="px-2 py-1 text-[11px] text-white/20 hover:text-white/50 transition-colors"
              title="Clear chat"
            >
              Clear
            </button>
          )}
          <button onClick={() => setMinimized(true)} className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <IconMinimize size={16} />
          </button>
          <button onClick={() => setOpen(false)} className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <IconX size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <IconSparkles size={32} className="text-[#22c55e]/30 mx-auto mb-3" />
            <p className="text-[16px] text-white/50 mb-1">How can I help?</p>
            <p className="text-[14px] text-white/25 mb-4">Ask about the app, construction codes, conversions, or your projects</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                'How do I create an invoice?',
                'What services do we offer?',
                'FL lawn care schedule',
                'How to manage Yelp leads?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="px-3 py-2 text-[13px] bg-white/5 text-white/40 rounded-lg hover:bg-white/10 hover:text-white/60 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#22c55e]/15 text-white rounded-br-md'
                : 'bg-[#111] border border-white/5 text-white/80 rounded-bl-md'
            }`}>
              {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#111] border border-white/5 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
              <IconLoader size={16} className="animate-spin text-[#22c55e]" />
              <span className="text-[15px] text-white/40">{loadingStatus}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/10 flex-shrink-0 bg-[#0f0f0f]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask anything..."
            className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] placeholder-white/25 focus:outline-none focus:border-[#22c55e]/50 transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-3.5 py-2.5 bg-[#22c55e] text-black rounded-xl hover:bg-[#22c55e]/90 transition-colors disabled:opacity-30 flex-shrink-0"
          >
            <IconSend size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
