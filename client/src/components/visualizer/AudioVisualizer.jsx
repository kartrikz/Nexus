import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Mic, MicOff, Volume2, VolumeX, Settings2,
  Sparkles, Radio, Play, Square
} from 'lucide-react';

export default function AudioVisualizer({ aiState = 'idle' }) {
  const canvasRef = useRef(null);
  const [visualMode, setVisualMode] = useState('orb'); // 'orb' | 'bars' | 'radial' | 'wave'
  const [isMicActive, setIsMicActive] = useState(false);
  const [simulatedState, setSimulatedState] = useState(aiState);
  const [micError, setMicError] = useState(null);
  const [sensitivity, setSensitivity] = useState(1.5);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Synchronize simulated state with external aiState
  useEffect(() => {
    setSimulatedState(aiState);
  }, [aiState]);

  // Start / Stop Microphone Stream
  const toggleMicrophone = async () => {
    if (isMicActive) {
      stopMicrophone();
      return;
    }

    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setIsMicActive(true);
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err.message);
      setMicError('Microphone not available or permission denied. Running in synthetic audio simulation mode.');
      setIsMicActive(false);
    }
  };

  const stopMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsMicActive(false);
  };

  useEffect(() => {
    return () => {
      stopMicrophone();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let phase = 0;

    const render = () => {
      phase += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Extract real audio frequency data if mic is active, otherwise generate synthetic wave
      const dataArray = new Uint8Array(128);
      if (isMicActive && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        // Synthetic audio data based on AI state
        let activityLevel = 0.15;
        if (simulatedState === 'listening') activityLevel = 0.55;
        if (simulatedState === 'thinking') activityLevel = 0.35;
        if (simulatedState === 'speaking') activityLevel = 0.85;

        for (let i = 0; i < 128; i++) {
          const sine = Math.sin(phase * 3 + i * 0.15) * 0.5 + 0.5;
          const noise = (Math.sin(phase * 7 + i * 0.3) * 0.5 + 0.5) * activityLevel;
          dataArray[i] = Math.min(255, (sine * 60 + noise * 160) * sensitivity);
        }
      }

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avgVolume = sum / dataArray.length;

      // Color scheme based on simulated state
      let primaryColor = '#8B5CF6'; // purple default
      let secondaryColor = '#EC4899'; // pink
      if (simulatedState === 'listening') {
        primaryColor = '#10B981'; // green
        secondaryColor = '#3B82F6'; // blue
      } else if (simulatedState === 'thinking') {
        primaryColor = '#F59E0B'; // amber
        secondaryColor = '#8B5CF6'; // purple
      } else if (simulatedState === 'speaking') {
        primaryColor = '#38BDF8'; // cyan
        secondaryColor = '#A855F7'; // violet
      }

      // RENDER MODE 1: QUANTUM ORB
      if (visualMode === 'orb') {
        const baseRadius = Math.min(width, height) * 0.18 + (avgVolume * 0.45);

        // Ambient outer glow
        const glowGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 2);
        glowGrad.addColorStop(0, `${primaryColor}40`);
        glowGrad.addColorStop(0.5, `${secondaryColor}20`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Multi-layered pulsing rings
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          const ringRad = baseRadius + r * 16;
          for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const freqIdx = Math.floor((i / 64) * 32);
            const freqVal = (dataArray[freqIdx] / 255) * 35;
            const dist = ringRad + Math.sin(angle * 6 + phase * (r + 1)) * freqVal;
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = r === 0 ? primaryColor : secondaryColor;
          ctx.lineWidth = 2.5 - r * 0.6;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 15;
          ctx.stroke();
        }

        // Center orb core
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.8);
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.4, primaryColor);
        coreGrad.addColorStop(1, `${secondaryColor}80`);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }

      // RENDER MODE 2: NEON FREQUENCY BARS
      else if (visualMode === 'bars') {
        const numBars = 48;
        const barWidth = (width / numBars) * 0.65;
        const spacing = (width / numBars) * 0.35;

        for (let i = 0; i < numBars; i++) {
          const val = (dataArray[i % 64] / 255);
          const barHeight = Math.max(4, val * (height * 0.7) * sensitivity);
          const x = i * (barWidth + spacing) + spacing;
          const y = centerY - barHeight / 2;

          const barGrad = ctx.createLinearGradient(x, y, x, y + barHeight);
          barGrad.addColorStop(0, primaryColor);
          barGrad.addColorStop(0.5, secondaryColor);
          barGrad.addColorStop(1, primaryColor);

          ctx.fillStyle = barGrad;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 4);
          ctx.fill();
        }
      }

      // RENDER MODE 3: RADIAL CYBER RING
      else if (visualMode === 'radial') {
        const radius = Math.min(width, height) * 0.22;
        const numPoints = 72;

        ctx.save();
        ctx.translate(centerX, centerY);

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const val = (dataArray[i % 48] / 255);
          const barLength = 10 + val * 90 * sensitivity;

          const x1 = Math.cos(angle) * radius;
          const y1 = Math.sin(angle) * radius;
          const x2 = Math.cos(angle) * (radius + barLength);
          const y2 = Math.sin(angle) * (radius + barLength);

          ctx.strokeStyle = i % 2 === 0 ? primaryColor : secondaryColor;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // RENDER MODE 4: DIGITAL VOICE WAVE
      else if (visualMode === 'wave') {
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;

        for (let w = 0; w < 3; w++) {
          ctx.beginPath();
          ctx.strokeStyle = w === 0 ? primaryColor : w === 1 ? secondaryColor : '#38BDF8';
          ctx.shadowColor = ctx.strokeStyle;

          for (let x = 0; x < width; x += 4) {
            const normalizedX = x / width;
            const freqIdx = Math.floor(normalizedX * 32);
            const val = (dataArray[freqIdx] / 255) * 70 * sensitivity;
            const waveY = centerY + Math.sin(normalizedX * 12 + phase * 2 + w) * val * Math.sin(normalizedX * Math.PI);

            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [visualMode, isMicActive, simulatedState, sensitivity]);

  return (
    <div style={{
      flex: 1,
      height: '100%',
      overflowY: 'auto',
      padding: '32px',
      background: 'var(--bg-app)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        maxWidth: '1000px',
        width: '100%',
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
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Activity size={24} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Real-Time Audio Visualizer
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Dynamic frequency spectrum rendering synced with speech recognition and speech synthesis.
              </p>
            </div>
          </div>

          {/* Mic Toggle Button */}
          <button
            className={`btn ${isMicActive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleMicrophone}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isMicActive ? <Mic size={16} /> : <MicOff size={16} />}
            <span>{isMicActive ? 'Live Mic Active' : 'Enable Live Mic'}</span>
          </button>
        </div>

        {micError && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#FBBF24',
            fontSize: '13px'
          }}>
            {micError}
          </div>
        )}

        {/* Visualizer Canvas Card */}
        <div className="glass-panel" style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-glass)',
          background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, rgba(10, 10, 15, 0.95) 75%)'
        }}>
          <canvas
            ref={canvasRef}
            width={850}
            height={420}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* Status Badge Overlaid */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: 'var(--radius-full)',
              background: simulatedState === 'speaking' ? '#38BDF8' : simulatedState === 'listening' ? '#10B981' : simulatedState === 'thinking' ? '#F59E0B' : '#8B5CF6',
              boxShadow: '0 0 8px currentColor'
            }} />
            <span style={{ textTransform: 'capitalize' }}>Status: {simulatedState}</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="glass-panel" style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Mode Picker */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Visualization Style
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'orb', label: 'Quantum Orb' },
                { id: 'bars', label: 'Neon Bars' },
                { id: 'radial', label: 'Cyber Ring' },
                { id: 'wave', label: 'Fluid Wave' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setVisualMode(m.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: visualMode === m.id ? 600 : 400,
                    background: visualMode === m.id ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    color: visualMode === m.id ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-glass)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI State Simulator Toggle */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Simulate Assistant Voice State
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['idle', 'listening', 'thinking', 'speaking'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSimulatedState(st)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    textTransform: 'capitalize',
                    background: simulatedState === st ? 'rgba(139, 92, 246, 0.25)' : 'var(--bg-surface)',
                    border: `1px solid ${simulatedState === st ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                    color: simulatedState === st ? '#FFFFFF' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity Slider */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Frequency Sensitivity: {sensitivity.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              style={{ width: '140px', accentColor: 'var(--accent-primary)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
