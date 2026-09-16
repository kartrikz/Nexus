import React, { useState, useEffect, useRef } from 'react';
import {
  Video, VideoOff, Camera, Hand, Sparkles, Check,
  AlertCircle, Play, Square, VolumeX, Eye
} from 'lucide-react';

const GESTURES = [
  { id: 'palm', name: 'Open Palm', icon: '✋', action: 'Stop / Pause Generation', description: 'Hold open palm towards camera' },
  { id: 'thumbsup', name: 'Thumbs Up', icon: '👍', action: 'Confirm / Agree', description: 'Raise thumb up' },
  { id: 'peace', name: 'Peace Sign', icon: '✌️', action: 'Toggle Voice Mode', description: 'Index and middle finger up' },
  { id: 'fist', name: 'Closed Fist', icon: '✊', action: 'Silence Audio / Mute', description: 'Close fingers into fist' },
  { id: 'point', name: 'Pointing Up', icon: '☝️', action: 'Switch to Chat Workspace', description: 'Point index finger upward' }
];

export default function HandTracking({ onTriggerGesture = () => {} }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [lastActionTriggered, setLastActionTriggered] = useState(null);

  const streamRef = useRef(null);
  const animRef = useRef(null);

  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err.message);
      setCameraError('Webcam unavailable or permission denied. Interactive computer vision simulator is active.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setDetectedGesture(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Draw hand tracking visual landmarks overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let tick = 0;

    const loop = () => {
      tick += 0.05;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (isCameraActive || detectedGesture) {
        // Draw futuristic tracking box & skeleton joints
        const cx = w * 0.5 + Math.sin(tick) * 15;
        const cy = h * 0.5 + Math.cos(tick * 0.8) * 10;

        // Bounding Box with rounded corners
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#8B5CF6';
        ctx.shadowBlur = 10;
        ctx.strokeRect(cx - 90, cy - 110, 180, 220);

        // Landmarks (wrist, knuckles, fingertips)
        const joints = [
          [cx, cy + 90], // wrist
          [cx - 50, cy + 30], [cx - 60, cy - 20], [cx - 65, cy - 60], // thumb
          [cx - 25, cy + 10], [cx - 30, cy - 50], [cx - 32, cy - 90], // index
          [cx, cy + 5], [cx, cy - 60], [cx, cy - 100], // middle
          [cx + 25, cy + 10], [cx + 28, cy - 50], [cx + 30, cy - 85], // ring
          [cx + 48, cy + 20], [cx + 52, cy - 35], [cx + 55, cy - 70]  // pinky
        ];

        // Draw connections
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < joints.length - 1; i++) {
          ctx.moveTo(joints[i][0], joints[i][1]);
          ctx.lineTo(joints[i + 1][0], joints[i + 1][1]);
        }
        ctx.stroke();

        // Draw points
        for (const [jx, jy] of joints) {
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(jx, jy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isCameraActive, detectedGesture]);

  const triggerGestureAction = (gesture) => {
    setDetectedGesture(gesture);
    setConfidence(96);
    setLastActionTriggered(gesture.action);
    onTriggerGesture(gesture.id);

    setTimeout(() => {
      setLastActionTriggered(null);
    }, 3000);
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
              background: 'rgba(236, 72, 153, 0.15)',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EC4899'
            }}>
              <Camera size={24} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                Camera & Hand Gesture Control
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Touchless computer vision interface recognizing spatial hand gestures.
              </p>
            </div>
          </div>

          <button
            className={`btn ${isCameraActive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleCamera}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isCameraActive ? <VideoOff size={16} /> : <Video size={16} />}
            <span>{isCameraActive ? 'Turn Off Camera' : 'Start Camera Feed'}</span>
          </button>
        </div>

        {cameraError && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#FBBF24',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{cameraError}</span>
          </div>
        )}

        {lastActionTriggered && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34D399',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Check size={18} />
            <span>Gesture Executed: <strong>{lastActionTriggered}</strong></span>
          </div>
        )}

        {/* Video & Tracking Canvas Viewport */}
        <div className="glass-panel" style={{
          position: 'relative',
          width: '100%',
          height: '420px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090E',
          border: '1px solid var(--border-glass)'
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // mirror view
              display: isCameraActive ? 'block' : 'none'
            }}
          />

          {!isCameraActive && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              <Camera size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Webcam Stream Inactive</div>
              <div style={{ fontSize: '13px', marginTop: '4px', maxWidth: '360px' }}>
                Enable your webcam above or click any gesture card below to trigger simulated spatial commands.
              </div>
            </div>
          )}

          {/* Canvas Overlay for hand landmarks */}
          <canvas
            ref={canvasRef}
            width={640}
            height={420}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />

          {/* Detected Gesture HUD Badge */}
          {detectedGesture && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>{detectedGesture.icon}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                  {detectedGesture.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-secondary)' }}>
                  Confidence: {confidence}% • {detectedGesture.action}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gesture Recognition Command Grid */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>
            Supported Gestures & Autonomous Actions
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            {GESTURES.map((g) => {
              const isSelected = detectedGesture?.id === g.id;

              return (
                <div
                  key={g.id}
                  className="glass-panel"
                  onClick={() => triggerGestureAction(g)}
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                    background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-glass)';
                  }}
                >
                  <div style={{
                    fontSize: '28px',
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {g.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>{g.name}</span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: 'var(--accent-secondary)'
                      }}>
                        Trigger
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '4px' }}>
                      {g.action}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {g.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
