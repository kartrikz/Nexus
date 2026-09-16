import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { api, API_BASE } from './services/api';
import Sidebar from './components/sidebar/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import AuthModal from './components/auth/AuthModal';
import MemoryVault from './components/memory/MemoryVault';
import FileManager from './components/files/FileManager';
import AudioVisualizer from './components/visualizer/AudioVisualizer';
import HandTracking from './components/camera/HandTracking';
import SettingsModal from './components/settings/SettingsModal';
import VoiceModeModal from './components/chat/VoiceModeModal';

function MainApp() {
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'memory' | 'files' | 'visualizer' | 'camera'
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [currentToolStatus, setCurrentToolStatus] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Load conversations once user is logged in
  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
      if (data.conversations?.length > 0 && !activeId) {
        setActiveId(data.conversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Load messages when activeId changes
  useEffect(() => {
    if (!activeId || !user) return;
    const fetchConv = async () => {
      try {
        const data = await api.getConversation(activeId);
        setActiveConv(data.conversation);
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Failed to load conversation details:', err);
      }
    };
    fetchConv();
  }, [activeId, user]);

  const handleNewConversation = async () => {
    try {
      const data = await api.createConversation('New Chat', 'gemini-2.5-flash');
      setConversations(prev => [data.conversation, ...prev]);
      setActiveId(data.conversation.id);
      setMessages([]);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create new conversation:', err);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      const remaining = conversations.filter(c => c.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
        if (remaining.length === 0) setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleRenameConversation = async (id, title) => {
    try {
      const data = await api.updateConversation(id, { title });
      setConversations(prev => prev.map(c => c.id === id ? data.conversation : c));
      if (activeId === id) {
        setActiveConv(data.conversation);
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isGenerating) return;

    let convId = activeId;
    if (!convId) {
      try {
        const newConv = await api.createConversation(text.slice(0, 30), 'gemini-2.5-flash');
        setConversations(prev => [newConv.conversation, ...prev]);
        setActiveId(newConv.conversation.id);
        convId = newConv.conversation.id;
      } catch (err) {
        console.error('Error creating conversation for message:', err);
        return;
      }
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setStreamedText('');
    setCurrentToolStatus(null);

    // Call streaming chat API endpoint
    try {
      const token = localStorage.getItem('nexus_token');
      const response = await fetch(`${API_BASE}/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content: text }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let toolCallsList = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === 'token') {
                fullContent += event.token;
                setStreamedText(fullContent);
              } else if (event.type === 'tool_start') {
                setCurrentToolStatus({ tool: event.tool, args: event.args });
              } else if (event.type === 'tool_end') {
                setCurrentToolStatus(null);
                toolCallsList.push({ name: event.tool, result: event.result });
              } else if (event.type === 'message') {
                setMessages(prev => [
                  ...prev,
                  {
                    id: event.messageId || `asst-${Date.now()}`,
                    role: 'assistant',
                    content: event.content || fullContent,
                    tool_calls: event.tool_calls || toolCallsList,
                    tool_results: event.tool_results,
                    created_at: new Date().toISOString()
                  }
                ]);
              }
            } catch (pErr) {
              // Non-JSON chunk
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming message error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Sorry, an error occurred while generating a response: ${err.message}`,
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setIsGenerating(false);
      setStreamedText('');
      setCurrentToolStatus(null);
      loadConversations();
    }
  };

  const handleStopGeneration = () => {
    setIsGenerating(false);
  };

  // Spatial gesture action handler
  const handleTriggerGesture = (gestureId) => {
    if (gestureId === 'palm') {
      handleStopGeneration();
    } else if (gestureId === 'thumbsup') {
      handleSendMessage('Yes, proceed with the plan.');
    } else if (gestureId === 'peace') {
      setIsVoiceModalOpen(true);
    } else if (gestureId === 'fist') {
      // Mute audio
    } else if (gestureId === 'point') {
      setActiveTab('chat');
    }
  };

  // Attach file to active chat
  const handleAttachFileToChat = (file) => {
    setActiveTab('chat');
    const prompt = `I have attached document "${file.original_name}". Please analyze its contents:\n\n${file.extracted_text?.slice(0, 3000) || ''}`;
    handleSendMessage(prompt);
  };

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            borderRadius: 'var(--radius-full)',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '15px' }}>
            Initializing NexusMind...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal onClose={() => {}} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={setActiveId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex' }}>
        {activeTab === 'chat' && (
          <ChatWindow
            conversation={activeConv}
            messages={messages}
            isGenerating={isGenerating}
            streamedText={streamedText}
            currentToolStatus={currentToolStatus}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onOpenFileUpload={() => setActiveTab('files')}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryVault />
        )}

        {activeTab === 'files' && (
          <FileManager
            activeConversationId={activeId}
            onAttachToChat={handleAttachFileToChat}
          />
        )}

        {activeTab === 'visualizer' && (
          <AudioVisualizer
            aiState={isGenerating ? (currentToolStatus ? 'thinking' : 'speaking') : 'idle'}
          />
        )}

        {activeTab === 'camera' && (
          <HandTracking
            onTriggerGesture={handleTriggerGesture}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <VoiceModeModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendMessage={handleSendMessage}
        isGenerating={isGenerating}
        streamedText={streamedText}
        currentToolStatus={currentToolStatus}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
