export const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && (window.location.port === '3001' || !window.location.port) ? '/api' : 'http://localhost:3001/api');

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('nexus_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('nexus_token', token);
    } else {
      localStorage.removeItem('nexus_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers
    };

    // If sending FormData, delete Content-Type to let browser set boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const config = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const error = new Error(data.error || `HTTP error ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth endpoints
  async register(email, username, password) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password })
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Conversations
  async getConversations() {
    return this.request('/conversations');
  }

  async createConversation(title = 'New Chat', model = 'gpt-4o-mini') {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, model })
    });
  }

  async getConversation(id) {
    return this.request(`/conversations/${id}`);
  }

  async updateConversation(id, updates) {
    return this.request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteConversation(id) {
    return this.request(`/conversations/${id}`, {
      method: 'DELETE'
    });
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSetting(key, value) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
  }

  // Memory Vault
  async getMemories(category = null, search = null) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/memories${qs}`);
  }

  async createMemory(content, category = 'fact', importance = 3) {
    return this.request('/memories', {
      method: 'POST',
      body: JSON.stringify({ content, category, importance })
    });
  }

  async updateMemory(id, updates) {
    return this.request(`/memories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteMemory(id) {
    return this.request(`/memories/${id}`, {
      method: 'DELETE'
    });
  }

  async clearMemories() {
    return this.request('/memories', {
      method: 'DELETE'
    });
  }

  // Files & Documents
  async uploadFile(file, conversationId = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversationId', conversationId);
    }
    return this.request('/files/upload', {
      method: 'POST',
      body: formData
    });
  }

  async getFiles(conversationId = null) {
    const qs = conversationId ? `?conversationId=${conversationId}` : '';
    return this.request(`/files${qs}`);
  }

  async getFile(id) {
    return this.request(`/files/${id}`);
  }

  async deleteFile(id) {
    return this.request(`/files/${id}`, {
      method: 'DELETE'
    });
  }
}

export const api = new ApiClient();
