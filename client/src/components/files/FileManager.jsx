import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import {
  FolderArchive, UploadCloud, FileText, FileCode, FileSpreadsheet,
  Trash2, Eye, Download, Check, AlertCircle, RefreshCw, X, Send
} from 'lucide-react';

export default function FileManager({ activeConversationId, onAttachToChat }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.getFiles();
      setFiles(res.files || []);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const showNotification = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    setIsUploading(true);
    try {
      const res = await api.uploadFile(file, activeConversationId);
      showNotification(`"${file.name}" uploaded and indexed successfully.`);
      loadFiles();
    } catch (err) {
      showNotification(err.message || 'File upload failed.', true);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" from your document library?`)) return;
    try {
      await api.deleteFile(id);
      showNotification(`File deleted.`);
      if (previewFile?.id === id) setPreviewFile(null);
      loadFiles();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleInspect = async (file) => {
    try {
      const details = await api.getFile(file.id);
      setPreviewFile(details.file);
    } catch (err) {
      setPreviewFile(file);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (name = '', mime = '') => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText color="#EF4444" size={22} />;
    if (['doc', 'docx'].includes(ext)) return <FileText color="#3B82F6" size={22} />;
    if (['csv', 'xlsx', 'xls', 'json'].includes(ext)) return <FileSpreadsheet color="#10B981" size={22} />;
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css'].includes(ext)) return <FileCode color="#F59E0B" size={22} />;
    return <FileText color="var(--accent-primary)" size={22} />;
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
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3B82F6'
            }}>
              <FolderArchive size={24} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Document & File Intelligence
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Ingest PDFs, Word documents, text, and code for autonomous agent search and citation.
              </p>
            </div>
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

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '36px 20px',
            borderRadius: 'var(--radius-lg)',
            border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
            background: dragOver ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleUpload(e.target.files)}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.md,.json,.csv,.js,.py,.html"
          />

          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            marginBottom: '14px'
          }}>
            {isUploading ? (
              <RefreshCw size={26} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <UploadCloud size={26} />
            )}
          </div>

          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
            {isUploading ? 'Extracting and indexing text...' : 'Click or Drag files to upload'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Supports PDF, DOCX, TXT, Markdown, CSV, JSON, and source code files up to 25MB
          </div>
        </div>

        {/* File List Grid */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
            Indexed Documents ({files.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <div>Loading documents...</div>
            </div>
          ) : files.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
              <FileText size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No documents indexed yet.</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px'
            }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      {getFileIcon(file.original_name, file.mime_type)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {file.original_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatBytes(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {file.summary && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      maxHeight: '52px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {file.summary}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <button
                      className="btn-icon"
                      onClick={() => handleInspect(file)}
                      title="Inspect extracted text"
                      style={{ width: '28px', height: '28px' }}
                    >
                      <Eye size={14} />
                    </button>

                    {onAttachToChat && (
                      <button
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onClick={() => onAttachToChat(file)}
                      >
                        <Send size={12} />
                        <span>Chat With File</span>
                      </button>
                    )}

                    <button
                      className="btn-icon"
                      style={{ width: '28px', height: '28px', color: '#F87171' }}
                      onClick={() => handleDelete(file.id, file.original_name)}
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Text Preview Modal / Drawer */}
        {previewFile && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 100
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getFileIcon(previewFile.original_name, previewFile.mime_type)}
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{previewFile.original_name}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatBytes(previewFile.size_bytes)} • Extracted Text
                    </span>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setPreviewFile(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{
                padding: '20px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.6',
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.3)',
                whiteSpace: 'pre-wrap',
                flex: 1
              }}>
                {previewFile.extracted_text || 'No extracted text available for this file.'}
              </div>

              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button className="btn btn-secondary" onClick={() => setPreviewFile(null)}>
                  Close
                </button>
                {onAttachToChat && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      onAttachToChat(previewFile);
                      setPreviewFile(null);
                    }}
                  >
                    Send to Active Chat
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
