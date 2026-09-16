import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot, User, Copy, Check, Terminal, Cpu, Clock, Volume2, VolumeX,
  Monitor, AlertTriangle, CheckCircle2, AlertCircle
} from 'lucide-react';
import { voiceService } from '../../services/voiceService';

const COMPUTER_TOOL_NAMES = [
  'open_application',
  'open_url',
  'open_file',
  'open_folder',
  'screenshot',
  'list_allowed_applications',
  'delete_file',
  'move_file',
  'rename_file'
];

export default function MessageBubble({ message, onSendMessage }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      voiceService.speak(message.content, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false)
      });
    }
  };

  const toolCalls = message.tool_calls;
  const toolResults = message.tool_results;
  const toolStatus = message.tool_status;

  // Helper to get matching result for a tool call
  const getToolResult = (tc, idx) => {
    if (tc.result) return tc.result;
    if (toolResults && Array.isArray(toolResults)) {
      const match = toolResults.find(r => r.name === tc.name) || toolResults[idx];
      return match?.result || match;
    }
    return null;
  };

  const getToolInProgressText = (status) => {
    if (!status) return null;
    if (typeof status === 'string') return status;
    const tool = status.tool || '';
    const args = status.args || {};
    if (tool === 'open_application') {
      return `Opening ${args.application || 'application'}...`;
    }
    if (tool === 'open_url') {
      return `Opening ${args.url || 'website'}...`;
    }
    if (tool === 'open_file') {
      return `Opening file ${args.filePath || ''}...`;
    }
    if (tool === 'open_folder') {
      return `Opening folder ${args.folderPath || ''}...`;
    }
    if (tool === 'screenshot') {
      return 'Capturing desktop screenshot...';
    }
    if (tool === 'delete_file') {
      return `Verifying deletion for ${args.filePath || ''}...`;
    }
    return `Executing ${tool}...`;
  };

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '16px 20px',
      maxWidth: '880px',
      margin: '0 auto',
      width: '100%',
      flexDirection: isUser ? 'row-reverse' : 'row'
    }}>
      {/* Avatar */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '12px',
        background: isUser ? 'var(--bg-surface-elevated)' : 'var(--accent-gradient)',
        border: isUser ? '1px solid var(--border-glass)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isUser ? 'none' : 'var(--accent-glow)',
        color: '#FFFFFF',
        flexShrink: 0
      }}>
        {isUser ? <User size={18} color="var(--text-secondary)" /> : <Bot size={20} />}
      </div>

      {/* Message Content Container */}
      <div style={{
        maxWidth: '82%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start'
      }}>
        {/* Active Streaming Tool Status */}
        {toolStatus && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C4B5FD', fontWeight: 600, fontSize: '12px' }}>
              <Monitor size={14} color="#A78BFA" />
              <span>🖥 Computer Action</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#A78BFA',
                animation: 'pulse 1s infinite'
              }} />
              <span>{getToolInProgressText(toolStatus)}</span>
            </div>
          </div>
        )}

        {/* Tool Execution Badges and Computer Action / Confirmation Cards */}
        {toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '10px',
            width: '100%'
          }}>
            {toolCalls.map((tc, idx) => {
              const toolName = tc.name || tc.tool;
              const result = getToolResult(tc, idx);
              const isComputerTool = COMPUTER_TOOL_NAMES.includes(toolName);

              // 1. Confirmation required card
              if (result && result.requiresConfirmation) {
                return (
                  <div
                    key={idx}
                    className="glass-panel"
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      maxWidth: '540px',
                      width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                      <AlertTriangle size={16} />
                      <span>⚠️ Confirmation required</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' }}>
                      NexusMind wants to {result.action === 'delete_file' ? 'delete' : result.action === 'move_file' ? 'move' : 'modify'}:
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        wordBreak: 'break-all',
                        color: '#FCD34D'
                      }}>
                        {result.target || tc.args?.filePath || ''}
                      </div>
                    </div>
                    {onSendMessage && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <button
                          className="btn"
                          style={{
                            padding: '4px 14px',
                            fontSize: '12px',
                            background: '#10B981',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)'
                          }}
                          onClick={() => onSendMessage(`Yes, proceed and allow ${result.action || toolName} for ${result.target || tc.args?.filePath || ''}`)}
                        >
                          Allow
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 14px',
                            fontSize: '12px',
                            borderRadius: 'var(--radius-sm)'
                          }}
                          onClick={() => onSendMessage(`No, cancel ${result.action || toolName}`)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // 2. Completed Computer Action card
              if (isComputerTool) {
                const isSuccess = result?.success;
                const isError = result?.error;

                return (
                  <div
                    key={idx}
                    style={{
                      background: isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(139, 92, 246, 0.08)',
                      border: isError ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(139, 92, 246, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '12.5px',
                      maxWidth: '540px',
                      width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#A78BFA', fontWeight: 600, fontSize: '12px' }}>
                      <Monitor size={14} />
                      <span>🖥 Computer Action</span>
                    </div>

                    {isSuccess ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: 500 }}>
                        <CheckCircle2 size={14} />
                        <span>✓ {result.message || `${toolName} executed successfully`}</span>
                      </div>
                    ) : isError ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444' }}>
                        <AlertCircle size={14} />
                        <span>{result.message || 'Action failed'}</span>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>
                        Executing {toolName}...
                      </div>
                    )}
                  </div>
                );
              }

              // 3. Regular tools (calculator, datetime, weather, etc.)
              return (
                <div
                  key={idx}
                  className="badge badge-purple"
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    textTransform: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    alignSelf: 'flex-start'
                  }}
                >
                  <Cpu size={14} />
                  <span>Tool: <strong>{toolName}</strong></span>
                </div>
              );
            })}
          </div>
        )}

        {/* Message Bubble Body */}
        <div
          className={isUser ? '' : 'glass-card'}
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: isUser ? 'var(--accent-gradient)' : 'var(--bg-glass-card)',
            color: isUser ? '#FFFFFF' : 'var(--text-primary)',
            border: isUser ? 'none' : '1px solid var(--border-glass)',
            boxShadow: isUser ? '0 4px 16px rgba(139, 92, 246, 0.25)' : 'var(--shadow-sm)',
            fontSize: '14.5px',
            lineHeight: '1.6',
            wordBreak: 'break-word',
            position: 'relative'
          }}
        >
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Bubble Meta & Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '6px',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          {message.created_at && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} />
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {!isUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="btn-ghost"
                onClick={handleCopy}
                title="Copy message"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                className="btn-ghost"
                onClick={handleToggleSpeak}
                title={isSpeaking ? 'Stop speaking' : 'Read aloud with voice'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  borderRadius: 'var(--radius-sm)',
                  color: isSpeaking ? 'var(--accent-primary)' : 'inherit'
                }}
              >
                {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                <span>{isSpeaking ? 'Stop' : 'Speak'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
