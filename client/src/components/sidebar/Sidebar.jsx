import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Sparkles, Plus, MessageSquare, Trash2, Edit2, Check, X,
  Sun, Moon, Brain, FolderArchive, Activity, Video, Settings,
  LogOut, ChevronLeft, ChevronRight, Pin
} from 'lucide-react';

export default function Sidebar({
  conversations = [],
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  activeTab,
  setActiveTab,
  onOpenSettings
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <aside
      className="glass-panel"
      style={{
        width: collapsed ? '72px' : '290px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-smooth)',
        borderRight: '1px solid var(--border-glass)',
        position: 'relative',
        zIndex: 50,
        flexShrink: 0
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: '18px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--accent-glow)',
            flexShrink: 0
          }}>
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          {!collapsed && (
            <div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: '700',
                fontSize: '17px',
                letterSpacing: '-0.3px',
                color: 'var(--text-primary)'
              }}>
                NexusMind
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--accent-secondary)',
                fontWeight: 600,
                letterSpacing: '0.4px'
              }}>
                PERSONAL AI
              </div>
            </div>
          )}
        </div>

        <button
          className="btn-icon"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ width: '28px', height: '28px' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div style={{ padding: '14px 14px 6px' }}>
        <button
          className="btn btn-primary"
          onClick={onNewConversation}
          style={{
            width: '100%',
            padding: collapsed ? '10px 0' : '10px 14px',
            justifyContent: 'center'
          }}
          title="Start a new chat (Ctrl+N)"
        >
          <Plus size={18} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Nav Tabs for Modules */}
      {!collapsed && (
        <div style={{ padding: '8px 14px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '3px',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)'
          }}>
            <button
              className="btn-icon"
              style={{
                width: '100%',
                height: '32px',
                background: activeTab === 'chat' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: activeTab === 'chat' ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('chat')}
              title="Chat Workspace"
            >
              <MessageSquare size={16} />
            </button>
            <button
              className="btn-icon"
              style={{
                width: '100%',
                height: '32px',
                background: activeTab === 'memory' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: activeTab === 'memory' ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('memory')}
              title="Memory Vault"
            >
              <Brain size={16} />
            </button>
            <button
              className="btn-icon"
              style={{
                width: '100%',
                height: '32px',
                background: activeTab === 'files' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: activeTab === 'files' ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('files')}
              title="Documents & Files"
            >
              <FolderArchive size={16} />
            </button>
            <button
              className="btn-icon"
              style={{
                width: '100%',
                height: '32px',
                background: activeTab === 'visualizer' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: activeTab === 'visualizer' ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('visualizer')}
              title="Audio Visualizer"
            >
              <Activity size={16} />
            </button>
            <button
              className="btn-icon"
              style={{
                width: '100%',
                height: '32px',
                background: activeTab === 'camera' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: activeTab === 'camera' ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
              onClick={() => setActiveTab('camera')}
              title="Gesture Camera"
            >
              <Video size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Conversation List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {!collapsed && (
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: 'var(--text-muted)',
            padding: '6px 8px 4px'
          }}>
            Conversations
          </div>
        )}

        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          const isEditing = editingId === conv.id;

          return (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'space-between',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid transparent',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                position: 'relative',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <MessageSquare size={16} style={{ flexShrink: 0, color: isActive ? 'var(--accent-primary)' : 'inherit' }} />
                
                {!collapsed && (
                  isEditing ? (
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '2px 6px', height: '26px', fontSize: '13px' }}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(conv.id, e);
                        if (e.key === 'Escape') handleCancelRename(e);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400
                    }}>
                      {conv.title || 'Untitled Chat'}
                    </span>
                  )
                )}
              </div>

              {/* Action Buttons on Hover */}
              {!collapsed && !isEditing && (
                <div style={{ display: 'flex', gap: '2px', opacity: isActive ? 1 : 0.6 }}>
                  <button
                    className="btn-icon"
                    style={{ width: '24px', height: '24px' }}
                    onClick={(e) => handleStartRename(conv, e)}
                    title="Rename conversation"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: '24px', height: '24px', color: '#F87171' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              {!collapsed && isEditing && (
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    className="btn-icon"
                    style={{ width: '24px', height: '24px', color: '#10B981' }}
                    onClick={(e) => handleSaveRename(conv.id, e)}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: '24px', height: '24px', color: '#EF4444' }}
                    onClick={handleCancelRename}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer / User Profile & Controls */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between'
        }}>
          {!collapsed && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0
              }}>
                {user.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user.username || 'User'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="btn-icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="btn-icon"
              onClick={onOpenSettings}
              title="Settings & AI Providers"
            >
              <Settings size={17} />
            </button>
            <button
              className="btn-icon"
              onClick={logout}
              title="Logout"
              style={{ color: '#F87171' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
