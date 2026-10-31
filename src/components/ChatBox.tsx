import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { useAuth } from '@/context/AuthContext';

export const ChatBox: React.FC = () => {
  const { messages, sendChatMessage } = useRoom();
  const { user } = useAuth();
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    if (trimmed.length > 500) {
      setChatError('Message exceeds maximum limit of 500 characters.');
      return;
    }

    setChatError(null);
    setIsSending(true);

    try {
      const ok = await sendChatMessage(trimmed);
      if (ok) {
        setInputText('');
      }
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Messages are stored newest first in array or ASC; sort ASC for top-to-bottom chat
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '420px',
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
          Room Chat
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Private
        </span>
      </div>

      {/* Message List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          paddingRight: '0.3rem',
          marginBottom: '0.75rem',
        }}
      >
        {sortedMessages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            No messages yet. Say hello to your watching partner!
          </div>
        ) : (
          sortedMessages.map(msg => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.4rem',
                    marginBottom: '0.15rem',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isMe ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {msg.sender_name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                    {formatMessageTime(msg.created_at)}
                  </span>
                </div>

                <div
                  style={{
                    background: isMe ? 'var(--accent-dim)' : 'var(--bg-app)',
                    border: isMe ? '1px solid rgba(217, 119, 54, 0.3)' : '1px solid var(--border-subtle)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {chatError && (
        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          {chatError}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Send a private message..."
          maxLength={500}
          className="input-field"
          style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="btn btn-primary"
          style={{ padding: '0.5rem 0.75rem' }}
          title="Send Message"
          aria-label="Send Message"
        >
          <Send size={15} />
        </button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
          {inputText.length}/500
        </span>
      </div>
    </div>
  );
};
