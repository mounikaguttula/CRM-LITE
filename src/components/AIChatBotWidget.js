import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getAuthToken } from '../utils/authStorage';
import {
  Sparkles,
  X,
  TrendingUp,
  UserCheck,
  Flame,
  Calendar,
  ChevronRight,
  Loader2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────
const PROXY_URL    = process.env.REACT_APP_PROXY_URL    || 'http://localhost:3001';
const MCP_BASE_URL = process.env.REACT_APP_MCP_SERVER_URL || 'http://localhost:3030';

// Cache the MCP access_token in module scope so we don't exchange on every message.
// The token is per-session and re-fetched on 401 or expiry.
let _mcpTokenCache = null; // { access_token, expires_at (ms) }

/* ─── Smiling Robot SVG Icon ──────────────────────────────────────────────── */
function BotIcon({ size = 34, color = '#ffffff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="3" width="2" height="4" rx="1" fill={color} />
      <circle cx="16" cy="2.5" r="2" fill={color} />
      <rect x="3" y="13.5" width="2.5" height="5" rx="1.2" fill={color} />
      <rect x="26.5" y="13.5" width="2.5" height="5" rx="1.2" fill={color} />
      <rect x="5.5" y="7.5" width="21" height="17" rx="7.5" fill={color} />
      <circle cx="11.5" cy="14.5" r="2.2" fill="#5b21b6" />
      <circle cx="20.5" cy="14.5" r="2.2" fill="#5b21b6" />
      <circle cx="12.2" cy="13.8" r="0.75" fill="#ffffff" />
      <circle cx="21.2" cy="13.8" r="0.75" fill="#ffffff" />
      <path d="M12.5 18.8C12.5 18.8 13.8 20.3 16 20.3C18.2 20.3 19.5 18.8 19.5 18.8" stroke="#5b21b6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Markdown renderer — lightweight, no library dependency ─────────────── */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} style={{ background: '#1e1b4b', color: '#c7d2fe', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', overflowX: 'auto', margin: '8px 0', lineHeight: 1.6 }}>
          {lang && <span style={{ color: '#818cf8', fontSize: '0.7rem', display: 'block', marginBottom: 4 }}>{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2].replace(/\*\*(.*?)\*\*/g, '$1');
      const sizes = { 1: '1rem', 2: '0.94rem', 3: '0.88rem' };
      nodes.push(
        <div key={i} style={{ fontWeight: 800, fontSize: sizes[level] || '0.9rem', color: '#1e1b4b', margin: '10px 0 4px' }}>
          {content}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list block
    if (/^[\-\*•]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[\-\*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[\-\*•]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} style={{ paddingLeft: 16, margin: '4px 0', listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3, fontSize: '0.83rem', color: '#334155' }}>
              <span style={{ color: '#7c3aed', fontWeight: 700, flexShrink: 0 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
        num++;
      }
      nodes.push(
        <ol key={i} style={{ paddingLeft: 18, margin: '4px 0' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 3, fontSize: '0.83rem', color: '#334155' }}
              dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
          ))}
        </ol>
      );
      continue;
    }

    // Table (simple pipe table)
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const [header, , ...rows] = tableLines;
      const headers = header.split('|').map(h => h.trim()).filter(Boolean);
      nodes.push(
        <div key={i} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>{headers.map((h, idx) => <th key={idx} style={{ padding: '4px 8px', background: '#f0f0ff', borderBottom: '2px solid #e0e7ff', textAlign: 'left', fontWeight: 700, color: '#4338ca' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ridx) => (
                <tr key={ridx} style={{ background: ridx % 2 ? '#fafafa' : '#fff' }}>
                  {row.split('|').map(c => c.trim()).filter(Boolean).map((cell, cidx) => (
                    <td key={cidx} style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}
                      dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />);
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <p key={i} style={{ margin: 0, marginBottom: 2, fontSize: '0.83rem', color: '#334155', lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
    );
    i++;
  }

  return nodes;
}

// Inline markdown: bold, italic, inline code, emoji passthrough
function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#1e293b">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#ede9fe;color:#6d28d9;border-radius:3px;padding:1px 4px;font-size:0.8em">$1</code>');
}

/* ─── Token exchange — gets an MCP OAuth token from the CRM JWT ──────────── */
async function getMcpToken(forceRefresh = false) {
  // Return cached token if still valid (with 60s buffer)
  if (!forceRefresh && _mcpTokenCache?.access_token) {
    const bufferMs = 60 * 1000;
    if (_mcpTokenCache.expires_at > Date.now() + bufferMs) {
      return _mcpTokenCache.access_token;
    }
  }

  const crmJwt = getAuthToken();
  if (!crmJwt) throw new Error('Not authenticated. Please log in.');

  const res = await fetch(`${MCP_BASE_URL}/api/token-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${crmJwt}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Token exchange failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + 55 * 60 * 1000; // 55 min default

  _mcpTokenCache = { access_token: data.access_token, expires_at: expiresAt };
  return data.access_token;
}

/* ─── Proxy chat call ─────────────────────────────────────────────────────── */
async function callProxy({ messages, userEmail, retryOnAuth = true }) {
  let accessToken;
  try {
    accessToken = await getMcpToken();
  } catch (err) {
    throw new Error(`Authentication error: ${err.message}`);
  }

  const res = await fetch(`${PROXY_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, access_token: accessToken, userEmail }),
  });

  // If the proxy returns 401, our MCP token may have expired — re-exchange once
  if (res.status === 401 && retryOnAuth) {
    _mcpTokenCache = null;
    return callProxy({ messages, userEmail, retryOnAuth: false });
  }

  const data = await res.json().catch(() => ({ error: 'Invalid response from AI proxy' }));

  if (!res.ok) {
    throw new Error(data.error || `Proxy error (HTTP ${res.status})`);
  }

  if (!data.reply) throw new Error('AI returned an empty response.');
  return data.reply;
}

/* ─── Main Widget Component ──────────────────────────────────────────────── */
export default function AIChatBotWidget() {
  const { currentUser } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  // messages[] uses { id, role: 'user'|'assistant', content } — matches Claude's format
  const [messages, setMessages]     = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState(null);
  const messagesEndRef = useRef(null);

  const userEmail = currentUser?.email || null;
  const userName  = currentUser?.name  || currentUser?.email?.split('@')[0] || 'Admin';

  const QUICK_PROMPTS = [
    { id: 'revenue', label: "This month's revenue",  emoji: '📈', icon: TrendingUp },
    { id: 'leads',   label: 'Active leads',           emoji: '👤', icon: UserCheck },
    { id: 'deals',   label: 'Top deals',              emoji: '🔥', icon: Flame     },
    { id: 'tasks',   label: 'My tasks',               emoji: '📅', icon: Calendar  },
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      scrollToBottom();
    }
  }, [isOpen, messages, scrollToBottom]);

  const toggleWidget = () => setIsOpen(prev => !prev);

  /* ── Send a message ─────────────────────────────────────────────────────── */
  const handleSend = useCallback(async (promptText) => {
    const text = (promptText || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg = { id: Date.now(), role: 'user', content: text };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    if (!promptText) setInputValue('');
    setIsLoading(true);
    setError(null);

    // Build the Claude-format messages array (role + content only)
    const claudeMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const reply = await callProxy({ messages: claudeMessages, userEmail });
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: reply };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, userEmail]);

  /* ── Retry the last failed request ─────────────────────────────────────── */
  const handleRetry = useCallback(() => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    // Remove any trailing assistant messages (there shouldn't be any after a failure)
    setMessages(prev => prev.filter(m => m.id !== lastUserMsg.id));
    setError(null);
    handleSend(lastUserMsg.content);
  }, [messages, handleSend]);

  /* ── Clear conversation ──────────────────────────────────────────────────── */
  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999999, fontFamily: 'var(--font-main, sans-serif)' }}>
      <style>{`
        @keyframes floatBubble1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.8} 50%{transform:translate(-3px,-4px) scale(1.18);opacity:1} }
        @keyframes floatBubble2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.85} 50%{transform:translate(3px,-3px) scale(1.15);opacity:1} }
        @keyframes floatBubble3 { 0%,100%{transform:translate(0,0) scale(1);opacity:.7} 50%{transform:translate(4px,3px) scale(1.2);opacity:1} }
        @keyframes floatBubble4 { 0%,100%{transform:translate(0,0) scale(1);opacity:.8} 50%{transform:translate(-4px,3px) scale(1.15);opacity:1} }
        @keyframes floatBubble5 { 0%,100%{transform:translate(0,0) scale(1);opacity:.85} 50%{transform:translate(3px,4px) scale(1.15);opacity:1} }
        @keyframes floatBubble6 { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 50%{transform:translate(-2px,3px) scale(1.25);opacity:1} }
        @keyframes auraPulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.06);opacity:1} }
        @keyframes chatPopUp { from{opacity:0;transform:translateY(20px) scale(.94)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .ai-prompt-chip {
          display:inline-flex;align-items:center;gap:7px;padding:8px 14px;
          border-radius:18px;border:1px solid #e0e7ff;background:#ffffff;
          color:#334155;font-size:0.82rem;font-weight:600;cursor:pointer;
          transition:all .2s cubic-bezier(.16,1,.3,1);box-shadow:0 2px 6px rgba(99,102,241,.05);
        }
        .ai-prompt-chip:hover {
          border-color:#818cf8;background:#f5f3ff;color:#4f46e5;
          transform:translateY(-2px);box-shadow:0 4px 12px rgba(99,102,241,.15);
        }
      `}</style>

      {/* ── Floating Chat Card ─────────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position:'absolute', bottom:84, right:0, width:370, maxHeight:580,
          background:'#ffffff', borderRadius:24,
          boxShadow:'0 20px 50px -10px rgba(124,58,237,.25),0 10px 25px -5px rgba(0,0,0,.08)',
          border:'1px solid rgba(224,231,255,.8)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          animation:'chatPopUp 0.3s cubic-bezier(.16,1,.3,1) both',
        }}>

          {/* Header */}
          <div style={{
            padding:'18px 20px 14px',
            background:'linear-gradient(135deg,#fcfaff 0%,#f5f3ff 50%,#eef2ff 100%)',
            borderBottom:'1px solid #eef2ff', position:'relative',
          }}>
            <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:6 }}>
              {messages.length > 0 && (
                <button id="ai-chat-clear-btn" onClick={handleClear} title="Clear conversation history"
                  style={{ border:'none', background:'rgba(255,255,255,.8)', color:'#64748b', cursor:'pointer',
                    borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 2px 6px rgba(0,0,0,.06)', transition:'all .15s ease' }}>
                  <RotateCcw size={13} />
                </button>
              )}
              <button id="ai-chat-close-btn" onClick={toggleWidget}
                style={{ border:'none', background:'rgba(255,255,255,.8)', color:'#64748b', cursor:'pointer',
                  borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 6px rgba(0,0,0,.06)', transition:'all .15s ease' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{
                width:42, height:42, borderRadius:14,
                background:'linear-gradient(135deg,#8b5cf6,#ec4899)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#ffffff', boxShadow:'0 6px 16px rgba(139,92,246,.35)', flexShrink:0,
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:800, color:'#1e1b4b', display:'flex', alignItems:'center', gap:6 }}>
                  Hi {userName}! <span style={{ fontSize:'1.1rem' }}>👋</span>
                </h3>
                <p style={{ margin:'3px 0 0', fontSize:'0.84rem', color:'#475569', lineHeight:1.35, fontWeight:500 }}>
                  I'm your AI assistant.<br />How can I help you today?
                </p>
              </div>
            </div>
          </div>

          {/* Message Body */}
          <div id="ai-chat-messages" style={{
            padding:'14px 16px', flex:1, overflowY:'auto', maxHeight:340,
            display:'flex', flexDirection:'column', gap:12, background:'#ffffff',
          }}>
            {/* Quick prompts — shown when no messages yet */}
            {messages.length === 0 && !isLoading && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  <button id="ai-quick-revenue" onClick={() => handleSend(QUICK_PROMPTS[0].label)} className="ai-prompt-chip">
                    <span>{QUICK_PROMPTS[0].emoji}</span> {QUICK_PROMPTS[0].label}
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  <button id="ai-quick-leads" onClick={() => handleSend(QUICK_PROMPTS[1].label)} className="ai-prompt-chip">
                    <span>{QUICK_PROMPTS[1].emoji}</span> {QUICK_PROMPTS[1].label}
                  </button>
                  <button id="ai-quick-deals" onClick={() => handleSend(QUICK_PROMPTS[2].label)} className="ai-prompt-chip">
                    <span>{QUICK_PROMPTS[2].emoji}</span> {QUICK_PROMPTS[2].label}
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  <button id="ai-quick-tasks" onClick={() => handleSend(QUICK_PROMPTS[3].label)} className="ai-prompt-chip">
                    <span>{QUICK_PROMPTS[3].emoji}</span> {QUICK_PROMPTS[3].label}
                  </button>
                </div>
              </div>
            )}

            {/* Message history */}
            {messages.map(msg => (
              <div key={msg.id} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'88%',
                  padding:'10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f8fafc',
                  color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  fontSize:'0.83rem',
                  lineHeight:1.5,
                  fontWeight:500,
                  boxShadow: msg.role === 'user' ? '0 4px 12px rgba(99,102,241,.25)' : 'none',
                }}>
                  {msg.role === 'user'
                    ? msg.content
                    : <div>{renderMarkdown(msg.content)}</div>
                  }
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  padding:'10px 14px', borderRadius:'16px 16px 16px 2px',
                  background:'#f8fafc', border:'1px solid #e2e8f0',
                  display:'flex', alignItems:'center', gap:8, color:'#8b5cf6', fontSize:'0.8rem', fontWeight:600,
                }}>
                  <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }} />
                  Claude is thinking…
                </div>
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <div style={{
                padding:'10px 14px', borderRadius:12,
                background:'#fff1f2', border:'1px solid #fecdd3',
                display:'flex', flexDirection:'column', gap:8,
              }}>
                <div style={{ display:'flex', gap:6, alignItems:'flex-start', color:'#e11d48', fontSize:'0.8rem', fontWeight:600 }}>
                  <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }} />
                  <span>{error}</span>
                </div>
                <button id="ai-chat-retry-btn" onClick={handleRetry}
                  style={{
                    alignSelf:'flex-start', display:'flex', alignItems:'center', gap:5,
                    padding:'5px 12px', borderRadius:20,
                    border:'1px solid #fecdd3', background:'#fff', color:'#e11d48',
                    fontSize:'0.76rem', fontWeight:700, cursor:'pointer',
                    transition:'all .15s ease',
                  }}>
                  <RotateCcw size={11} /> Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div style={{ padding:'10px 14px 14px', background:'#ffffff', borderTop:'1px solid #f1f5f9' }}>
            <form
              onSubmit={e => { e.preventDefault(); handleSend(); }}
              style={{
                display:'flex', alignItems:'center',
                background:'#f8fafc', borderRadius:24,
                padding:'4px 6px 4px 16px',
                border:'1.5px solid #e2e8f0',
                transition:'all .2s ease',
              }}
            >
              <input
                id="ai-chat-input"
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={isLoading ? 'Waiting for Claude…' : 'Ask me anything…'}
                disabled={isLoading}
                style={{
                  flex:1, border:'none', background:'transparent', outline:'none',
                  fontSize:'0.86rem', color:'#1e293b', fontWeight:500,
                  opacity: isLoading ? 0.6 : 1,
                }}
              />
              <button
                id="ai-chat-send-btn"
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                style={{
                  width:34, height:34, borderRadius:'50%', border:'none', flexShrink:0,
                  background: (inputValue.trim() && !isLoading) ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#cbd5e1',
                  color:'#ffffff', display:'flex', alignItems:'center', justifyContent:'center',
                  cursor: (inputValue.trim() && !isLoading) ? 'pointer' : 'not-allowed',
                  boxShadow: (inputValue.trim() && !isLoading) ? '0 4px 12px rgba(124,58,237,.4)' : 'none',
                  transition:'all .2s ease',
                }}
              >
                {isLoading
                  ? <Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />
                  : <ChevronRight size={18} strokeWidth={2.5} />
                }
              </button>
            </form>
            <p style={{ margin:'6px 0 0 4px', fontSize:'0.68rem', color:'#94a3b8', fontWeight:500 }}>
              Powered by Claude AI • Data from your live CRM
            </p>
          </div>

          {/* Bubble tail */}
          <div style={{
            position:'absolute', bottom:-8, right:32, width:16, height:16,
            background:'#ffffff', transform:'rotate(45deg)',
            borderRight:'1px solid rgba(224,231,255,.8)',
            borderBottom:'1px solid rgba(224,231,255,.8)',
          }} />
        </div>
      )}

      {/* ── Floating Trigger Button ──────────────────────────────────────── */}
      <div style={{ position:'relative', display:'inline-block' }}>
        {/* Aura glow */}
        <div style={{
          position:'absolute', top:-24, left:-24, right:-24, bottom:-24, borderRadius:'50%',
          background:'radial-gradient(circle,rgba(168,85,247,.3) 0%,rgba(96,165,250,.18) 55%,transparent 75%)',
          filter:'blur(10px)', opacity:0.85,
          animation:'auraPulse 4s ease-in-out infinite', pointerEvents:'none',
        }} />

        {/* Floating dots */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          {[
            { style:{ top:2,   left:-14,  width:7, height:7, background:'#a855f7', boxShadow:'0 0 8px #a855f7', animation:'floatBubble1 3.5s ease-in-out infinite'        }},
            { style:{ top:22,  left:-20,  width:6, height:6, background:'#60a5fa', boxShadow:'0 0 6px #60a5fa', animation:'floatBubble2 4s ease-in-out infinite 0.4s'     }},
            { style:{ top:-12, right:10,  width:7, height:7, background:'#fb7185', boxShadow:'0 0 8px #fb7185', animation:'floatBubble3 4.2s ease-in-out infinite 0.8s'   }},
            { style:{ top:14,  right:-18, width:6, height:6, background:'#f97316', boxShadow:'0 0 6px #f97316', animation:'floatBubble4 3.8s ease-in-out infinite 0.2s'   }},
            { style:{ bottom:10, right:-12, width:5, height:5, background:'#c084fc', boxShadow:'0 0 5px #c084fc', animation:'floatBubble5 4.5s ease-in-out infinite 1s'   }},
            { style:{ bottom:-6, left:4,   width:4, height:4, background:'#38bdf8', boxShadow:'0 0 5px #38bdf8', animation:'floatBubble6 3.2s ease-in-out infinite 0.6s'  }},
          ].map((dot, i) => (
            <span key={i} style={{ position:'absolute', borderRadius:'50%', ...dot.style }} />
          ))}
        </div>

        {/* Main button */}
        <button
          id="ai-chat-toggle-btn"
          onClick={toggleWidget}
          style={{
            position:'relative', width:58, height:58, borderRadius:'50%', border:'none',
            background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#c084fc 100%)',
            boxShadow:'0 8px 24px rgba(124,58,237,.45),0 0 0 5px rgba(255,255,255,.65)',
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
            transition:'transform .25s cubic-bezier(.16,1,.3,1)',
            transform: isOpen ? 'scale(.92) rotate(90deg)' : 'scale(1)',
          }}
          title="Open AI Assistant"
        >
          {isOpen ? <X size={24} color="#ffffff" strokeWidth={2.5} /> : <BotIcon size={32} color="#ffffff" />}

          {/* Unread badge */}
          {hasUnread && !isOpen && (
            <span style={{
              position:'absolute', top:1, right:1, width:14, height:14,
              borderRadius:'50%', background:'#f43f5e', border:'2.5px solid #ffffff',
              boxShadow:'0 2px 8px rgba(244,63,94,.7)',
            }} />
          )}
        </button>
      </div>
    </div>
  );
}
