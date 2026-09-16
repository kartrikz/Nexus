# 🧠 NexusMind — Next-Gen Autonomous AI Assistant

> **NexusMind** is an advanced AI assistant featuring a modular multi-provider AI architecture (Google Gemini default, Anthropic Claude, OpenAI), autonomous multi-step tool execution, long-term memory vault, real-time voice conversations (STT/TTS), touchless spatial hand gesture tracking, interactive audio spectrum visualizers, and secure document ingestion.

---

## 🌟 Key Features

1. **Modular AI Provider Architecture**
   - **Gemini 2.5 Flash** as default native provider with streaming and tool calling.
   - Abstract `BaseAIProvider` interface enabling zero-refactor switching to **Anthropic Claude** (Claude 3.5 Sonnet) or **OpenAI** (GPT-4o).
   - Autonomous multi-turn reasoning simulator fallback for zero-key local development and offline testing.

2. **Autonomous AI Agent & Tool Registry**
   - Autonomous multi-step tool execution loop (`MAX_TOOL_ITERATIONS = 5`).
   - Integrated tools:
     - 🧮 **Calculator**: Safe mathematical expression evaluation with scientific functions and percentages.
     - 🕒 **DateTime**: Live global timezone lookup, offsets, and calendar calculation.
     - 🌦️ **Weather**: Live atmospheric reporting and conditions lookup.
     - 🔍 **WebSearch**: Query synthesis with real-time fallback grounding.
     - 🧠 **Memory**: Read, write, and search persistent user memory notes.
     - 📄 **FileReader**: Analyze and extract text from uploaded documents.

3. **Persistent Memory Vault**
   - SQLite-backed memory store with categorization (`preference`, `fact`, `project`, `instruction`, `personal`).
   - Importance rating (1–5) and auto-memory ingestion ("*remember that ...*").
   - Integrated with system prompt context injection.

4. **Continuous Hands-Free Voice Mode**
   - Web Speech API integration for continuous Speech-to-Text (STT) with silence detection auto-dispatch.
   - Text-to-Speech (TTS) response playback with customizable speech rate and voice selection.
   - Dedicated voice conversation modal with pulsing glowing orb canvas visualizer and barge-in interrupt capability.

5. **Audio Spectrum Visualizer**
   - Real-time Web Audio API `AudioContext` & `AnalyserNode` FFT frequency analysis.
   - 4 dynamic rendering styles:
     - **Quantum Orb**: Multi-layered pulsing holographic sphere with particle glow.
     - **Neon Bars**: Symmetrical cyber frequency equalizer bars.
     - **Cyber Ring**: Radial HUD frequency array.
     - **Fluid Wave**: Tri-color sine waveform.
   - Synthetic state simulator (Idle, Listening, Thinking, Speaking) with sensitivity control.

6. **Camera & Spatial Hand Gesture Control**
   - Touchless webcam interface with real-time mirrored canvas overlay.
   - Skeletal joint and landmark tracking HUD.
   - Recognized gestures & actions:
     - ✋ **Open Palm**: Stop / pause active AI response generation.
     - 👍 **Thumbs Up**: Quick confirm / agree with plan.
     - ✌️ **Peace Sign**: Open continuous voice conversation mode.
     - ✊ **Closed Fist**: Mute / silence audio.
     - ☝️ **Pointing Up**: Quick switch to chat workspace.

7. **Document & File Analysis**
   - Drag-and-drop file upload with multipart parsing.
   - Supports `.txt`, `.md`, `.json`, `.csv`, `.pdf`, etc.
   - Direct attachment to active conversation with automated text extraction.

8. **Safe Windows Laptop Control**
   - **Explicit Allowlisted Tools**:
     - `open_application`: Launch approved Windows applications (Chrome, VS Code, Notepad, Calculator, File Explorer, Task Manager, Snipping Tool, Edge) without arbitrary shell access.
     - `open_url`: Safely opens validated `http:` and `https:` URLs in default browser; blocks `file://`, `javascript:`, `data:` schemes.
     - `open_file` & `open_folder`: Opens local files and directories with default system viewers.
     - `screenshot`: Desktop screen capture saved safely as PNG.
     - `list_allowed_applications`: Lists allowed apps and their availability on the host.
   - **Centralized Permission & Safety Layer**:
     - **SAFE**: Auto-executes allowlisted actions.
     - **CONFIRMATION REQUIRED**: `delete_file`, `move_file`, `rename_file`, `shutdown`, `restart`. The UI prompts the user with an interactive `[Allow] [Cancel]` confirmation card before executing destructive actions.
     - **BLOCKED**: Arbitrary command execution (`execute_command`, `run_shell`, `powershell`, `cmd`), credentials, passwords, `.env` files, browser session cookies, and Windows credential stores (`SAM`, `SYSTEM`).
   - **Zero Hardcoded Usernames**: Resolves paths dynamically via `%LOCALAPPDATA%`, `%ProgramFiles%`, `os.homedir()`.
   - **Process Verification**: Verifies valid PID and catches immediate spawn errors before confirming success.
   - **Voice & UI Integration**: Rich streaming status (`🖥 Computer Action: Opening Chrome...` / `✓ Chrome opened successfully`) and support for voice commands (e.g. *"NexusMind, open Chrome"*).

9. **Security & Production Hardening**
   - Secure password hashing using `bcrypt` (12 rounds).
   - JWT authentication via `Bearer` token and `httpOnly` cookies.
   - Parameterized SQLite queries preventing SQL injection.
   - Helmet security headers and CORS protection.
   - API rate limiting (`express-rate-limit`).
   - Unified error handling without sensitive stack trace leaks.

---

## 🏗️ Architecture

```
                    ┌────────────────────────┐
                    │  NexusMind Web Client  │
                    │  (React 19 + Vite)     │
                    └───────────┬────────────┘
                                │  REST / SSE Stream
                                ▼
                    ┌────────────────────────┐
                    │    Express API Server  │
                    └───────────┬────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
        ┌────────────────┐            ┌────────────────┐
        │ SQLite Storage │            │    AI Agent    │
        │ (Users, Chats, │            └────────┬───────┘
        │  Memory, Files)│                     │
        └────────────────┘                     ▼
                                    ┌──────────────────────┐
                                    │  AI Provider Base    │
                                    │      Interface       │
                                    └──────────┬───────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         ▼                     ▼                     ▼
                ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
                │     Gemini     │    │     Claude     │    │     OpenAI     │
                │    Provider    │    │    Provider    │    │    Provider    │
                │   (Default)    │    │ (Anthropic API)│    │   (GPT-4o)     │
                └────────────────┘    └────────────────┘    └────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on Node.js 22 LTS)
- npm 9+

### Installation

Clone or open the repository and install all dependencies:

```bash
npm run install:all
```

This installs root, backend (`server`), and frontend (`client`) packages.

### Environment Configuration

Create or edit `.env` in the root directory (or `server/.env`):

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=nexusmind_ultra_secure_jwt_secret_key_2026_dev
CLIENT_URL=http://localhost:5173

# AI Provider Configuration ('gemini' | 'claude' | 'openai')
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Claude Provider Configuration
CLAUDE_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: OpenAI Provider Configuration
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key_here
```

> **Note:** If no API keys are provided, NexusMind seamlessly uses its built-in autonomous simulator to demonstrate all features, tools, and streaming workflows without requiring external credentials.

---

## 💻 Running the Application

### 1. Dual Development Mode (Recommended for Development)
Runs the Express backend on port 3001 and Vite client dev server with HMR on port 5173:

```bash
npm run dev
```

Open: **http://localhost:5173**

### 2. Full Unified Production Mode
Builds the client bundle and serves both the API and frontend application from the Express server on port 3001:

```bash
npm run build
npm start
```

Open: **http://localhost:3001**

---

## 🧪 Running Automated Tests

Run the full end-to-end test suite (all backend integration tests + frontend production compilation):

```bash
npm test
```

Or run backend and frontend tests independently:

```bash
# Backend unit & integration tests (55 tests across 7 suites)
npm run test:server

# Frontend build & static verification
npm run test:client
```

---

## 🔄 Switching AI Providers (Gemini → Claude → OpenAI)

NexusMind is designed with a strictly decoupled provider layer:

1. **Via UI Settings**:
   - Open NexusMind, click the **Settings** gear in the sidebar.
   - Click **Anthropic Claude** or **OpenAI GPT-4o**.
   - Select your preferred model and paste your API key.
   - Click **Save Changes**. The agent immediately switches providers without a server restart.

2. **Via Environment Variables**:
   - Set `AI_PROVIDER=claude` in `.env`.
   - Set `ANTHROPIC_API_KEY=sk-ant-...` in `.env`.
   - Restart the server.

---

## 📁 Repository Structure

```
nexusmind/
├── client/                     # Frontend React 19 Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # Login, Register & Demo Access modal
│   │   │   ├── camera/         # Touchless Hand Tracking & Gesture Control
│   │   │   ├── chat/           # Chat Window, Streaming Bubbles, Voice Modal
│   │   │   ├── files/          # Drag-and-drop File Manager & Document Viewer
│   │   │   ├── memory/         # Long-term Memory Vault CRUD & Categories
│   │   │   ├── settings/       # AI Provider, Model, & System Prompt Settings
│   │   │   ├── sidebar/        # Navigation, History, & Collapse Toggle
│   │   │   └── visualizer/     # 4-style Real-time Audio Visualizer
│   │   ├── context/            # AuthContext & ThemeContext
│   │   ├── services/           # API Client & Voice Synthesis/Recognition
│   │   ├── App.jsx             # Main Application Routing & State
│   │   └── index.css           # Modern Cyberpunk Design System
│   └── package.json
├── server/                     # Express Backend Application
│   ├── src/
│   │   ├── ai/
│   │   │   ├── providers/      # BaseAIProvider, Gemini, Claude, OpenAI
│   │   │   ├── tools/          # Calculator, DateTime, Weather, WebSearch, Memory, FileReader
│   │   │   ├── agent.js        # Multi-step Autonomous AI Agent Loop
│   │   │   └── systemPrompt.js # Dynamic Prompt Builder with Memories
│   │   ├── db/                 # SQLite Connection & Database Schema
│   │   ├── middleware/         # JWT Auth, Rate Limiter, Error Handler, Validation
│   │   ├── routes/             # Auth, Chat, Memory, Files, Settings Routes
│   │   └── services/           # File Ingestion & Memory Services
│   ├── tests/                  # Automated Test Suites
│   ├── server.js               # Server Entrypoint
│   └── package.json
├── scripts/
│   └── dev.js                  # Cross-platform Dev Runner
├── package.json                # Root Workspace Scripts
└── README.md                   # System Documentation
```

---

## 🛡️ License

MIT License. Designed and crafted with original implementation for next-generation personal AI interaction.
