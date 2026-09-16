import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Brain, Plus, Search, Trash2, Edit3, Check, X,
  Tag, Star, Shield, Filter, RefreshCw, AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Memories', color: 'var(--accent-primary)' },
  { id: 'preference', label: 'Preferences', color: '#8B5CF6' },
  { id: 'fact', label: 'Facts', color: '#3B82F6' },
  { id: 'instruction', label: 'Instructions', color: '#10B981' },
  { id: 'context', label: 'Context', color: '#F59E0B' }
];

export default function MemoryVault() {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('fact');
  const [newImportance, setNewImportance] = useState(3);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('fact');
  const [editImportance, setEditImportance] = useState(3);
  const [feedback, setFeedback] = useState(null);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const catParam = activeCategory === 'all' ? null : activeCategory;
      const res = await api.getMemories(catParam, searchQuery || null);
      setMemories(res.memories || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, [activeCategory, searchQuery]);

  const showNotification = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    try {
      await api.createMemory(newContent.trim(), newCategory, newImportance);
      setNewContent('');
      setIsAdding(false);
      showNotification('Memory stored in NexusMind Vault.');
      loadMemories();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleStartEdit = (m) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category);
    setEditImportance(m.importance || 3);
  };

  const handleSaveEdit = async (id) => {
    if (!editContent.trim()) return;
    try {
      await api.updateMemory(id, {
        content: editContent.trim(),
        category: editCategory,
        importance: editImportance
      });
      setEditingId(null);
      showNotification('Memory updated.');
      loadMemories();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to forget this memory?')) return;
    try {
      await api.deleteMemory(id);
      showNotification('Memory deleted.');
      loadMemories();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to wipe all stored memories in your vault?')) return;
    try {
      await api.clearMemories();
      showNotification('Memory Vault wiped clean.');
      loadMemories();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '32px',
      background: 'var(--bg-app)',
      color: 'var(--text-primary)'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}>
                <Brain size={24} />
              </div>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '24px',
                  fontWeight: 700,
                  margin: 0
                }}>
                  Persistent Memory Vault
                </h1>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Autonomous long-term recall powering personalized reasoning across conversations.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setIsAdding(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} />
              <span>Add Memory</span>
            </button>
            {memories.length > 0 && (
              <button
                className="btn"
                onClick={handleClearAll}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#EF4444'
                }}
                title="Wipe entire memory vault"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: feedback.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${feedback.isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            color: feedback.isError ? '#F87171' : '#34D399',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px'
          }}>
            <AlertCircle size={16} />
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Add Memory Drawer / Modal */}
        {isAdding && (
          <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            background: 'rgba(139, 92, 246, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Create New Memory</h3>
              <button className="btn-icon" onClick={() => setIsAdding(false)}>
                <X size={16} />
              </button>
            </div>

            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. User prefers concise answers with Python code examples; User's primary programming language is TypeScript."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
              autoFocus
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  className="input-field"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ minWidth: '150px' }}
                >
                  <option value="preference">Preference</option>
                  <option value="fact">Fact</option>
                  <option value="instruction">Instruction</option>
                  <option value="context">Context</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Importance Rating ({newImportance} / 5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={newImportance}
                  onChange={(e) => setNewImportance(Number(e.target.value))}
                  style={{ width: '160px', accentColor: 'var(--accent-primary)' }}
                />
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setIsAdding(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreate}>
                  Save Memory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Category Filter Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-surface)',
                    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                    color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px' }}
            />
          </div>
        </div>

        {/* Memories Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <div>Accessing Memory Vault...</div>
          </div>
        ) : memories.length === 0 ? (
          <div className="glass-panel" style={{
            padding: '60px 24px',
            textAlign: 'center',
            borderRadius: 'var(--radius-lg)'
          }}>
            <Brain size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>
              {searchQuery ? 'No matching memories found' : 'Memory Vault is Empty'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px' }}>
              Tell NexusMind in chat: <em>"Remember that my timezone is Tokyo"</em> or add manual entries here to persist context indefinitely!
            </p>
            <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
              <Plus size={16} />
              <span>Create First Memory</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px'
          }}>
            {memories.map((m) => {
              const isEditing = editingId === m.id;
              const catColor = CATEGORIES.find(c => c.id === m.category)?.color || 'var(--accent-primary)';

              return (
                <div
                  key={m.id}
                  className="glass-panel"
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    border: '1px solid var(--border-glass)',
                    transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border-glass)';
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        className="input-field"
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          className="input-field"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="preference">Preference</option>
                          <option value="fact">Fact</option>
                          <option value="instruction">Instruction</option>
                          <option value="context">Context</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          className="input-field"
                          value={editImportance}
                          onChange={(e) => setEditImportance(Number(e.target.value))}
                          style={{ width: '60px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => handleSaveEdit(m.id)}>
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '10px'
                        }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: `${catColor}20`,
                            color: catColor,
                            border: `1px solid ${catColor}40`
                          }}>
                            {m.category}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                fill={i < (m.importance || 3) ? '#F59E0B' : 'none'}
                                color={i < (m.importance || 3) ? '#F59E0B' : 'var(--text-muted)'}
                              />
                            ))}
                          </div>
                        </div>

                        <p style={{
                          margin: 0,
                          fontSize: '14px',
                          lineHeight: '1.5',
                          color: 'var(--text-primary)',
                          wordBreak: 'break-word'
                        }}>
                          {m.content}
                        </p>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                      }}>
                        <span>Source: {m.source || 'chat'}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-icon"
                            style={{ width: '26px', height: '26px' }}
                            onClick={() => handleStartEdit(m)}
                            title="Edit memory"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: '26px', height: '26px', color: '#F87171' }}
                            onClick={() => handleDelete(m.id)}
                            title="Delete memory"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
