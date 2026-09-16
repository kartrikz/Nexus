import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import {
  Sparkles, Calculator, Brain, Globe, Clock,
  Cpu, Layers, MessageSquareDashed
} from 'lucide-react';

export default function ChatWindow({
  conversation,
  messages = [],
  isGenerating = false,
  streamedText = '',
  currentToolStatus = null,
  onSendMessage,
  onStopGeneration,
  onOpenVoice,
  onOpenFileUpload
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedText, currentToolStatus]);

  const starterPrompts = [
    {
      icon: <Calculator size={18} color="#8B5CF6" />,
      title: 'Math & Calculation',
      prompt: "What's 18.5% of $4,850, and if I invest it at 8% annual return, what will it be in 10 years?"
    },
    {
      icon: <Brain size={18} color="#06B6D4" />,
      title: 'Memory Vault Test',
      prompt: 'Remember that my name is Alex, I love building full-stack AI tools, and my preferred language is TypeScript.'
    },
    {
      icon: <Clock size={18} color="#10B981" />,
      title: 'Time & Real-world Tools',
      prompt: 'What is the current exact date and time, and what time will it be in Tokyo in 6 hours?'
    },
    {
      icon: <Sparkles size={18} color="#F59E0B" />,
      title: 'Creative Reasoning',
      prompt: 'Design an ultra-modern modular architecture for an autonomous AI desktop assistant.'
    }
  ];

  return (
    <div style={{
      flex: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'transparent',
      position: 'relative'
    }}>
      {/* Chat Window Header */}
      <div
        className="glass-panel"
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid var(--border-glass)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{
            fontSize: '17px',
            fontWeight: 700,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)'
          }}>
            {conversation?.title || 'NexusMind Workspace'}
          </h1>
          <span className="badge badge-purple">
            <Cpu size={12} />
            {conversation?.model || 'gpt-4o-mini'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--status-success)',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            <span>Memory Active</span>
          </div>
        </div>
      </div>

      {/* Message Stream Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {messages.length === 0 && !isGenerating ? (
          /* Empty State */
          <div style={{
            margin: 'auto',
            maxWidth: '680px',
            padding: '40px 20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'var(--accent-gradient)',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--accent-glow)'
            }}>
              <Sparkles size={32} color="#FFFFFF" />
            </div>

            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '10px',
              background: 'linear-gradient(135deg, #FFFFFF 30%, #C4B5FD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              What can NexusMind assist with?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
              Your assistant possesses memory, tool automation, live voice synthesizers, and document ingestion.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              textAlign: 'left'
            }}>
              {starterPrompts.map((p, idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onSendMessage(p.prompt)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {p.icon}
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{p.title}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {p.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Render Messages */
          <>
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onSendMessage={onSendMessage}
              />
            ))}

            {/* In-progress streaming response */}
            {isGenerating && (
              <MessageBubble
                message={{
                  id: 'streaming-temp',
                  role: 'assistant',
                  content: streamedText,
                  tool_status: currentToolStatus,
                  created_at: new Date().toISOString()
                }}
                onSendMessage={onSendMessage}
              />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Bottom Chat Input */}
      <ChatInput
        onSendMessage={onSendMessage}
        disabled={false}
        isGenerating={isGenerating}
        onStopGeneration={onStopGeneration}
        onOpenVoice={onOpenVoice}
        onOpenFileUpload={onOpenFileUpload}
      />
    </div>
  );
}
