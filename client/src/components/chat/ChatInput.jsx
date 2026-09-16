import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Sparkles, StopCircle } from 'lucide-react';

export default function ChatInput({
  onSendMessage,
  disabled = false,
  isGenerating = false,
  onStopGeneration,
  onOpenVoice,
  onOpenFileUpload
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div style={{
      maxWidth: '880px',
      margin: '0 auto',
      width: '100%',
      padding: '0 20px 20px'
    }}>
      <div
        className="glass-card"
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-md)',
          background: 'var(--bg-glass-card)'
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask NexusMind anything, calculate, search, or record a memory..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isGenerating}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontSize: '14.5px',
            lineHeight: '1.5',
            resize: 'none',
            maxHeight: '180px',
            padding: '4px 6px'
          }}
        />

        {/* Action bar inside input box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-glass)',
          paddingTop: '8px'
        }}>
          {/* Left tools: Attachment, Voice Dictation, Voice Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={onOpenFileUpload}
              title="Attach Document / File (PDF, DOCX, TXT, CSV, JSON)"
              disabled={disabled || isGenerating}
            >
              <Paperclip size={17} />
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={onOpenVoice}
              title="Open Continuous Voice Conversation Mode"
              style={{ color: 'var(--accent-secondary)' }}
            >
              <Mic size={17} />
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              Gemini + Persistent Memory + Autonomous Tools
            </span>
          </div>

          {/* Right tool: Send or Stop button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isGenerating ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onStopGeneration}
                style={{ padding: '6px 14px', fontSize: '13px', color: '#EF4444' }}
              >
                <StopCircle size={15} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!text.trim() || disabled}
                style={{
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  boxShadow: text.trim() ? 'var(--accent-glow)' : 'none'
                }}
              >
                <span>Send</span>
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '6px',
        fontSize: '11px',
        color: 'var(--text-muted)'
      }}>
        Press <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-glass)' }}>Enter</kbd> to send, <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-glass)' }}>Shift+Enter</kbd> for newline
      </div>
    </div>
  );
}
