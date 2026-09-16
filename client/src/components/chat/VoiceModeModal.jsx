import React, { useState, useEffect, useRef } from 'react';
import { voiceService } from '../../services/voiceService';
import {
  Mic, MicOff, Volume2, VolumeX, X, Radio,
  Sparkles, MessageSquare, AlertCircle, Monitor
} from 'lucide-react';

export default function VoiceModeModal({ isOpen, onClose, onSendMessage, isGenerating, streamedText, currentToolStatus }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastAsstReply, setLastAsstReply] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const canvasRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Canvas visualizer loop
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;
    let animId;

    const draw = () => {
      phase += 0.05;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      let radius = 70;
      let color = '#8B5CF6';

      if (isSpeaking) {
        radius = 90 + Math.sin(phase * 4) * 15;
        color = '#38BDF8';
      } else if (isListening) {
        radius = 80 + Math.sin(phase * 3) * 10;
        color = '#10B981';
      } else if (isGenerating) {
        radius = 75 + Math.sin(phase * 5) * 8;
        color = '#F59E0B';
      }

      // Outer glow
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.8);
      grad.addColorStop(0, `${color}60`);
      grad.addColorStop(0.6, `${color}20`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Core Orb
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen, isListening, isSpeaking, isGenerating]);

  // Start continuous listening when modal opens
  useEffect(() => {
    if (isOpen) {
      startListeningLoop();
    } else {
      stopListeningLoop();
      voiceService.stopSpeaking();
    }
  }, [isOpen]);

  // When AI finishes generating response, speak it aloud
  useEffect(() => {
    if (!isGenerating && streamedText && streamedText !== lastAsstReply) {
      setLastAsstReply(streamedText);
      setIsSpeaking(true);
      voiceService.speak(streamedText, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          // Re-arm microphone after AI finishes speaking
          startListeningLoop();
        },
        onError: () => setIsSpeaking(false)
      });
    }
  }, [isGenerating, streamedText]);

  const startListeningLoop = () => {
    if (!voiceService.isSTTSupported()) {
      setVoiceError('Speech recognition is not supported in this browser. You can test voice mode using text.');
      return;
    }

    voiceService.stopSpeaking();
    setTranscript('');
    setVoiceError(null);

    const started = voiceService.startListening({
      onResult: ({ final, interim, raw }) => {
        setTranscript(raw);

        // Reset silence timer
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // If user pauses for 1.6 seconds after speaking, automatically send to assistant
        if (raw.trim().length > 2) {
          silenceTimerRef.current = setTimeout(() => {
            voiceService.stopListening();
            setIsListening(false);
            onSendMessage(raw.trim());
          }, 1600);
        }
      },
      onError: (err) => {
        console.warn('Voice STT error:', err);
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    if (started) setIsListening(true);
  };

  const stopListeningLoop = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    voiceService.stopListening();
    setIsListening(false);
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopListeningLoop();
    } else {
      startListeningLoop();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 5, 10, 0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '36px 24px',
      zIndex: 1000
    }}>
      {/* Top Header */}
      <div style={{
        width: '100%',
        maxWidth: '700px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: 'var(--radius-full)',
            background: isSpeaking ? '#38BDF8' : isListening ? '#10B981' : '#F59E0B',
            boxShadow: '0 0 10px currentColor'
          }} />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            NexusMind Continuous Voice Mode
          </span>
        </div>

        <button
          className="btn-icon"
          onClick={() => {
            stopListeningLoop();
            voiceService.stopSpeaking();
            onClose();
          }}
          style={{ width: '36px', height: '36px' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Central Visualizer & Transcription */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '24px',
        maxWidth: '560px'
      }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          style={{ width: '260px', height: '260px' }}
        />

        <div style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>
          {isSpeaking
            ? 'NexusMind is speaking...'
            : isGenerating
            ? (currentToolStatus ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#C4B5FD' }}>
                  <Monitor size={18} color="#A78BFA" />
                  <span>
                    🖥 Computer Action: {currentToolStatus.args?.application || currentToolStatus.args?.url || currentToolStatus.args?.filePath || currentToolStatus.tool}
                  </span>
                </div>
              ) : 'Thinking and computing answer...')
            : isListening
            ? 'Listening... Speak naturally'
            : 'Microphone paused'}
        </div>

        {/* Live speech preview */}
        {transcript && (
          <div style={{
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: '15px',
            color: '#FFFFFF',
            lineHeight: '1.5'
          }}>
            "{transcript}"
          </div>
        )}

        {voiceError && (
          <div style={{ fontSize: '13px', color: '#FBBF24', maxWidth: '400px' }}>
            {voiceError}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          className={`btn ${isListening ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleToggleMic}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            padding: 0,
            justifyContent: 'center',
            boxShadow: isListening ? 'var(--accent-glow)' : 'none'
          }}
          title={isListening ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isListening ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        {isSpeaking && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              voiceService.stopSpeaking();
              setIsSpeaking(false);
              startListeningLoop();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          >
            <VolumeX size={18} />
            <span>Interrupt Voice</span>
          </button>
        )}
      </div>
    </div>
  );
}
