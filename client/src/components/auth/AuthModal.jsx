import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Mail, Lock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AuthModal({ onClose }) {
  const { login, register, authError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password || (isRegister && !username)) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      if (isRegister) {
        await register(email, username, password);
      } else {
        await login(email, password);
      }
      if (onClose) onClose();
    } catch (err) {
      setLocalError(err.message || 'Authentication error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5, 8, 18, 0.82)',
      backdropFilter: 'blur(16px)',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '36px 32px',
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 32px rgba(139, 92, 246, 0.2)'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 16px',
            borderRadius: '16px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)'
          }}>
            <Sparkles size={28} color="#FFFFFF" />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '26px',
            fontWeight: '700',
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #FFFFFF 30%, #A78BFA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '6px'
          }}>
            NexusMind
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {isRegister ? 'Create your personal AI assistant account' : 'Welcome back to your cognitive workspace'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: '24px',
          border: '1px solid var(--border-glass)'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setLocalError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: !isRegister ? 'var(--bg-surface-elevated)' : 'transparent',
              color: !isRegister ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setLocalError(''); }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: isRegister ? 'var(--bg-surface-elevated)' : 'transparent',
              color: isRegister ? '#FFFFFF' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {(localError || authError) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#FCA5A5',
            fontSize: '13px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Your Name / Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '40px' }}
                  placeholder="e.g. Alex Hunter"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '10px', height: '44px' }}
          >
            {submitting ? 'Please wait...' : (
              <>
                <span>{isRegister ? 'Register & Enter Workspace' : 'Sign In to Workspace'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '22px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: 'var(--text-muted)',
          fontSize: '12px'
        }}>
          <ShieldCheck size={14} color="#10B981" />
          <span>Local secure SQLite vault & encrypted credentials</span>
        </div>
      </div>
    </div>
  );
}
