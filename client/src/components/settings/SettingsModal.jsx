import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import {
  Settings, X, Key, Cpu, Volume2, Palette, Sliders,
  Check, AlertCircle, RefreshCw, Shield, Sparkles
} from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, toggleTheme } = useTheme();
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.getSettings();
        const s = res.settings || {};
        if (s.ai_provider) setProvider(s.ai_provider);
        if (s.ai_model) setModel(s.ai_model);
        if (s.gemini_api_key) setGeminiKey(s.gemini_api_key);
        if (s.claude_api_key) setClaudeKey(s.claude_api_key);
        if (s.openai_api_key) setOpenaiKey(s.openai_api_key);
        if (s.custom_instructions) setCustomInstructions(s.custom_instructions);
        if (s.auto_speak !== undefined) setAutoSpeak(Boolean(s.auto_speak));
        if (s.speech_rate !== undefined) setSpeechRate(Number(s.speech_rate));
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSetting('ai_provider', provider);
      await api.updateSetting('ai_model', model);
      await api.updateSetting('gemini_api_key', geminiKey);
      await api.updateSetting('claude_api_key', claudeKey);
      await api.updateSetting('openai_api_key', openaiKey);
      await api.updateSetting('custom_instructions', customInstructions);
      await api.updateSetting('auto_speak', autoSpeak);
      await api.updateSetting('speech_rate', speechRate);

      setFeedback({ msg: 'Settings saved successfully!', isError: false });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1200);
    } catch (err) {
      setFeedback({ msg: err.message || 'Failed to save settings.', isError: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Settings & AI Configuration</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Customize providers, API credentials, voice, and system directives.
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {feedback && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: feedback.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${feedback.isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              color: feedback.isError ? '#F87171' : '#34D399',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {feedback.isError ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Section 1: AI Provider & Model */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Cpu size={16} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Primary AI Provider</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              {/* Gemini */}
              <div
                onClick={() => {
                  setProvider('gemini');
                  setModel('gemini-2.5-flash');
                }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${provider === 'gemini' ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                  background: provider === 'gemini' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: provider === 'gemini' ? '#FFFFFF' : 'var(--text-primary)' }}>
                  Google Gemini
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Default native provider
                </div>
              </div>

              {/* Claude */}
              <div
                onClick={() => {
                  setProvider('claude');
                  setModel('claude-3-5-sonnet-20241022');
                }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${provider === 'claude' ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                  background: provider === 'claude' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: provider === 'claude' ? '#FFFFFF' : 'var(--text-primary)' }}>
                  Anthropic Claude
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Sonnet 3.5 & reasoning
                </div>
              </div>

              {/* OpenAI */}
              <div
                onClick={() => {
                  setProvider('openai');
                  setModel('gpt-4o-mini');
                }}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${provider === 'openai' ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                  background: provider === 'openai' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: provider === 'openai' ? '#FFFFFF' : 'var(--text-primary)' }}>
                  OpenAI GPT-4o
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  GPT-4o & mini models
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Active Model
              </label>
              <select
                className="input-field"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ width: '100%' }}
              >
                {provider === 'gemini' && (
                  <>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended, ultra-fast)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Deep reasoning)</option>
                  </>
                )}
                {provider === 'claude' && (
                  <>
                    <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (State-of-the-art coding & agentic)</option>
                    <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (High speed)</option>
                    <option value="claude-3-opus-20240229">claude-3-opus-20240229 (Complex analysis)</option>
                  </>
                )}
                {provider === 'openai' && (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Fast & cost-efficient)</option>
                    <option value="gpt-4o">gpt-4o (High capability)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {provider === 'gemini' ? 'Gemini API Key' : provider === 'claude' ? 'Anthropic API Key' : 'OpenAI API Key'} (Optional for offline demo)
              </label>
              <div style={{ position: 'relative' }}>
                <Key size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="input-field"
                  placeholder={provider === 'gemini' ? 'AIzaSy...' : provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                  value={provider === 'gemini' ? geminiKey : provider === 'claude' ? claudeKey : openaiKey}
                  onChange={(e) => {
                    if (provider === 'gemini') setGeminiKey(e.target.value);
                    else if (provider === 'claude') setClaudeKey(e.target.value);
                    else setOpenaiKey(e.target.value);
                  }}
                  style={{ width: '100%', paddingLeft: '34px' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Stored securely in your private SQLite database. Never shared or committed.
              </div>
            </div>
          </div>

          {/* Section 2: Custom Instructions & Persona */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sparkles size={16} color="var(--accent-secondary)" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Custom Agent Directives</h3>
            </div>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Always structure code with TypeScript, be direct and concise, avoid pleasantries."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Section 3: Voice & Speech */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Volume2 size={16} color="#10B981" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Voice Synthesizer</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Auto-Read Assistant Responses</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatically speak answers aloud using Web Speech TTS</div>
              </div>
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Speech Speed Rate</span>
                <span>{speechRate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
