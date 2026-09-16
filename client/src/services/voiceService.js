/**
 * NexusMind Voice Service
 * Web Speech API integration for high-fidelity STT (Speech-to-Text) and TTS (Text-to-Speech)
 */

class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;

    this.initRecognition();
  }

  isSTTSupported() {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  isTTSSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  initRecognition() {
    if (!this.isSTTSupported()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
  }

  startListening({ onResult = () => {}, onError = () => {}, onEnd = () => {} } = {}) {
    if (!this.isSTTSupported()) {
      onError(new Error('Speech recognition is not supported in this browser.'));
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        onResult({
          final: finalTranscript.trim(),
          interim: interimTranscript.trim(),
          raw: (finalTranscript || interimTranscript).trim()
        });
      };

      this.recognition.onerror = (event) => {
        // 'no-speech' is non-fatal in continuous listening mode
        if (event.error !== 'no-speech') {
          onError(event);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err) {
      this.isListening = false;
      onError(err);
      return false;
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }

  getVoices() {
    if (!this.isTTSSupported()) return [];
    return this.synth.getVoices();
  }

  speak(text, { voice = null, rate = 1.0, pitch = 1.0, onStart = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
    if (!this.isTTSSupported() || !text) return;

    this.stopSpeaking();

    // Strip markdown formatting for cleaner speech output
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#~>\[\]]/g, '')
      .replace(/\(https?:\/\/[^\)]+\)/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate || this.rate;
    utterance.pitch = pitch || this.pitch;

    const voices = this.getVoices();
    if (voice) {
      utterance.voice = voice;
    } else if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else if (voices.length > 0) {
      // Pick a natural English voice if possible
      const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David')));
      utterance.voice = preferred || voices[0];
    }

    utterance.onstart = onStart;
    utterance.onend = onEnd;
    utterance.onerror = onError;

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.isTTSSupported()) {
      this.synth.cancel();
    }
  }
}

export const voiceService = new VoiceService();
