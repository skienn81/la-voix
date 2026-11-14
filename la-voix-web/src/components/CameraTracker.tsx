import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, RefreshCw, CheckCircle2, Sliders, Sparkles } from 'lucide-react';
import { GestureStep, Language } from '../types';
import { HandLandmarkStabilizer } from '../utils/oneEuroFilter';
import { classifyHandLandmarks, GestureMatchResult } from '../utils/gestureClassifier';
import { HandPoseGuide } from './HandPoseGuide';

interface CameraTrackerProps {
  currentStep: GestureStep;
  language: Language;
  onMotionStateChange?: (isActive: boolean, energy: number) => void;
  onAutoAdvance?: () => void;
  onTokenMatched?: (step: GestureStep) => void;
}

const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [0, 17],
];

const TARGET_MATCH_THRESHOLD = 65; // User-friendly sensitivity
const LOCK_HOLD_MS = 320; // 0.32s hold to confirm naturally

// AudioContext for pleasant confirmation chime
let sharedAudioCtx: AudioContext | null = null;
const playAdvanceChirp = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();

    osc.type = 'sine';
    const now = sharedAudioCtx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    // AudioContext blocked
  }
};

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  currentStep,
  language,
  onMotionStateChange,
  onAutoAdvance,
  onTokenMatched,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // MediSign AI 1€ Filter & Zero-Lag Fast Motion Stabilizer
  const stabilizerRef = useRef<HandLandmarkStabilizer>(new HandLandmarkStabilizer());
  const lastMediaPipeTimestampRef = useRef<number>(0);

  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasHandInView, setHasHandInView] = useState<boolean>(false);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [lockProgress, setLockProgress] = useState<number>(0);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [lastMatchedGloss, setLastMatchedGloss] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [liveClassification, setLiveClassification] = useState<GestureMatchResult | null>(null);

  const matchStartTimeRef = useRef<number | null>(null);
  const lockCooldownUntilRef = useRef<number>(0);
  const lastProgressUpdateRef = useRef<number>(0);
  const lastReactUpdateRef = useRef<number>(performance.now());

  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;
  const onTokenMatchedRef = useRef(onTokenMatched);
  onTokenMatchedRef.current = onTokenMatched;

  // Stop camera stream safely
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize MediaPipe & Webcam
  const startCamera = useCallback(async () => {
    setCameraLoading(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        if (isMountedRef.current) {
          landmarkerRef.current = landmarker;
        } else {
          landmarker.close();
        }
      } catch (mpError) {
        console.warn('MediaPipe initialization notice:', mpError);
      }

      if (isMountedRef.current) {
        setIsSimulated(false);
      }
    } catch (err: any) {
      console.warn('Camera access denied or failed:', err);
      if (isMountedRef.current) {
        setCameraError(
          language === 'vi'
            ? 'Không mở được webcam. Vui lòng cấp quyền camera trong trình duyệt hoặc bật Chế độ Mô phỏng.'
            : 'Camera access denied. Please grant permission or enable Simulation mode.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setCameraLoading(false);
      }
    }
  }, [language]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCameraStream();
    };
  }, [startCamera, stopCameraStream]);

  // Toggle between Camera and Simulated AI Mode
  const toggleMode = () => {
    if (isSimulated) {
      startCamera();
    } else {
      stopCameraStream();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {
          // ignore
        }
        landmarkerRef.current = null;
      }
      setIsSimulated(true);
      setCameraError(null);
    }
  };

  // Generate procedural landmarks ONLY when user explicitly clicks "Chế độ Mô phỏng"
  const getProceduralLandmarks = (t: number, width: number, height: number, gloss: string) => {
    const cx = width * 0.5;
    const cy = height * 0.56;
    const baseScale = Math.min(width, height) * 0.36;

    const landmarks: { x: number; y: number }[] = [];

    let wristYOffset = Math.sin(t * 2) * 6;
    let wristXOffset = Math.cos(t * 1.5) * 5;
    let indexExtension = 1.0;
    let thumbAngle = 0.4;
    let fingerCurl = 0.2;
    let vibration = 0;

    if (gloss === 'Tôi') {
      indexExtension = 1.35;
      fingerCurl = 0.85;
      wristYOffset += Math.sin(t * 3) * 5;
    } else if (gloss === 'Đau') {
      vibration = Math.sin(t * 12) * 3.5;
      fingerCurl = 0.8;
      wristXOffset += Math.sin(t * 6) * 10;
    } else if (gloss === 'Bụng') {
      fingerCurl = 0.05;
      wristYOffset += 30 + Math.sin(t * 2.5) * 10;
    } else if (gloss === 'Hôm qua') {
      thumbAngle = 0.85;
      fingerCurl = 0.65;
      wristYOffset -= 25 + Math.cos(t * 2) * 8;
      wristXOffset += 20 + Math.sin(t * 2) * 8;
    } else if (gloss === 'Cần' || gloss === 'Giúp') {
      fingerCurl = 0.15;
      wristYOffset -= 15 + Math.sin(t * 2.2) * 12;
    } else if (gloss === 'Khai báo') {
      wristXOffset += Math.sin(t * 3.5) * 20;
      indexExtension = 1.1;
      thumbAngle = 0.25;
      fingerCurl = 0.75;
    }

    landmarks[0] = {
      x: cx + wristXOffset + vibration,
      y: cy + wristYOffset,
    };

    const fingerRays = [
      { mcpAngle: -0.65, len: 0.35, isThumb: true },
      { mcpAngle: -0.25, len: 0.55, isThumb: false },
      { mcpAngle: 0.0, len: 0.60, isThumb: false },
      { mcpAngle: 0.24, len: 0.53, isThumb: false },
      { mcpAngle: 0.46, len: 0.44, isThumb: false },
    ];

    fingerRays.forEach((f, fIdx) => {
      const baseIdx = fIdx * 4 + 1;
      const mcpDist = baseScale * (f.isThumb ? 0.32 : 0.42);
      const mcpX = landmarks[0].x + Math.sin(f.mcpAngle) * mcpDist;
      const mcpY = landmarks[0].y - Math.cos(f.mcpAngle) * mcpDist;

      landmarks[baseIdx] = { x: mcpX, y: mcpY };

      const segLen = (baseScale * f.len) / 3;
      let curX = mcpX;
      let curY = mcpY;

      for (let s = 1; s <= 3; s++) {
        const segIdx = baseIdx + s;
        let angle = f.mcpAngle;

        if (f.isThumb) {
          angle += thumbAngle;
        } else if (fIdx === 1) {
          angle += (1 - indexExtension) * 0.4;
        } else {
          angle += fingerCurl * 0.3 * s;
        }

        const effectiveSegLen = (fIdx === 1 && s === 3 ? segLen * indexExtension : segLen) * (1 - (fIdx > 1 ? fingerCurl * 0.2 : 0));
        curX += Math.sin(angle) * effectiveSegLen + vibration * 0.4;
        curY -= Math.cos(angle) * effectiveSegLen;

        landmarks[segIdx] = { x: curX, y: curY };
      }
    });

    return landmarks;
  };

  // Draw clean hand skeleton ONLY when real hand is in view
  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    userLandmarks: { x: number; y: number }[],
    width: number,
    height: number,
    isTargetLocked: boolean
  ) => {
    ctx.clearRect(0, 0, width, height);

    // CRITICAL: If no real hand, leave canvas 100% clean! Zero fake bones!
    if (!userLandmarks || userLandmarks.length < 21) {
      return;
    }

    const boneColor = isTargetLocked ? '#10b981' : '#34d399';
    const tipFill = isTargetLocked ? '#059669' : '#ff5500';

    ctx.lineWidth = 3;
    ctx.strokeStyle = boneColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = userLandmarks[startIdx];
      const p2 = userLandmarks[endIdx];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    userLandmarks.forEach((pt, idx) => {
      if (!pt) return;
      const isTip = [4, 8, 12, 16, 20].includes(idx);
      const isWrist = idx === 0;

      ctx.beginPath();
      if (isTip) {
        ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = tipFill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isWrist) {
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffaa00';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = boneColor;
        ctx.stroke();
      }
    });
  };

  // Main Tracking and Pose Matching Loop
  useEffect(() => {
    isMountedRef.current = true;
    let isRunning = true;

    const renderLoop = (now: number) => {
      if (!isRunning) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth || 640;
        canvas.height = canvas.clientHeight || 360;
      }

      const width = canvas.width;
      const height = canvas.height;
      const timeInSec = now * 0.001;

      // Extract Raw Landmarks
      let rawLandmarks: { x: number; y: number }[] = [];
      let handDetected = false;

      if (!isSimulated) {
        // Real Webcam Inference
        if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
          try {
            const safeTimestamp = Math.max(now, lastMediaPipeTimestampRef.current + 1);
            lastMediaPipeTimestampRef.current = safeTimestamp;

            const results = landmarkerRef.current.detectForVideo(videoRef.current, safeTimestamp);
            if (results.landmarks && results.landmarks.length > 0) {
              const raw = results.landmarks[0];
              rawLandmarks = raw.map((lm: any) => ({
                x: lm.x * width,
                y: lm.y * height,
              }));
              handDetected = true;
            }
          } catch (e) {
            // MediaPipe detection loop safe catch
          }
        }
      } else {
        // ONLY in explicit simulation mode:
        rawLandmarks = getProceduralLandmarks(timeInSec, width, height, currentStep.gloss);
        handDetected = true;
      }

      // Safe filtering and gesture classification
      let currentLandmarks: { x: number; y: number }[] = [];
      let calibratedMatch = 0;
      let isTargetMatched = false;
      let classification: GestureMatchResult | null = null;

      if (handDetected && rawLandmarks.length >= 21) {
        // Stabilize with 1€ Filter
        currentLandmarks = stabilizerRef.current.filter(rawLandmarks, now);

        // Classify anatomical gesture
        classification = classifyHandLandmarks(currentLandmarks, currentStep.gloss);
        calibratedMatch = classification.matchScore;
        isTargetMatched = classification.isMatched;
      }

      // Live Telemetry for DevTools inspection
      (window as any).__LAVOIX_TELEMETRY__ = {
        gloss: currentStep.gloss,
        handDetected,
        matchScore: calibratedMatch,
        isMatched: isTargetMatched,
        detectedPose: classification?.detectedPose || 'NO_HAND',
        fingerStates: classification?.fingerStates,
        debugText: classification?.debugText || 'Chưa thấy bàn tay',
        isSimulated,
        timestamp: Date.now(),
      };

      // Auto-Advance Lock Engine (ONLY triggers if a hand is ACTUALLY in view and matches!)
      if (handDetected && now > lockCooldownUntilRef.current) {
        if (isTargetMatched || calibratedMatch >= TARGET_MATCH_THRESHOLD) {
          if (!matchStartTimeRef.current) {
            matchStartTimeRef.current = now;
          }
          const duration = now - matchStartTimeRef.current;
          const progress = Math.min(1.0, duration / LOCK_HOLD_MS);

          if (now - lastProgressUpdateRef.current >= 40 || progress >= 1.0) {
            setLockProgress(progress);
            lastProgressUpdateRef.current = now;
          }

          if (duration >= LOCK_HOLD_MS) {
            playAdvanceChirp();

            setIsFlashing(true);
            setLastMatchedGloss(currentStep.gloss);
            setTimeout(() => {
              setIsFlashing(false);
            }, 350);

            if (onTokenMatchedRef.current) {
              onTokenMatchedRef.current(currentStep);
            }

            if (onAutoAdvanceRef.current) {
              onAutoAdvanceRef.current();
            }

            matchStartTimeRef.current = null;
            setLockProgress(0);
            lockCooldownUntilRef.current = now + 450;
          }
        } else {
          if (matchStartTimeRef.current !== null) {
            matchStartTimeRef.current = null;
            setLockProgress(0);
          }
        }
      } else {
        if (matchStartTimeRef.current !== null) {
          matchStartTimeRef.current = null;
          setLockProgress(0);
        }
      }

      // Throttled UI state updates
      if (now - lastReactUpdateRef.current >= 100) {
        setHasHandInView(handDetected);
        setMatchScore(calibratedMatch);
        setLiveClassification(classification);
        lastReactUpdateRef.current = now;
      }

      // Draw clean canvas
      drawCanvas(ctx, currentLandmarks, width, height, isTargetMatched);

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isSimulated, currentStep.gloss, onMotionStateChange]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCameraStream();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {
          // ignore
        }
        landmarkerRef.current = null;
      }
    };
  }, [stopCameraStream]);

  // Manual Force Match / Advance with Space
  const handleForceAdvance = () => {
    playAdvanceChirp();
    setIsFlashing(true);
    setLastMatchedGloss(currentStep.gloss);
    setTimeout(() => {
      setIsFlashing(false);
    }, 350);
    if (onTokenMatchedRef.current) {
      onTokenMatchedRef.current(currentStep);
    }
    if (onAutoAdvanceRef.current) {
      onAutoAdvanceRef.current();
    }
  };

  return (
    <div className="sensor-chassis">
      {/* Sensor Control Header (Clean, Minimal) */}
      <div className="sensor-header">
        <div className="sensor-title-box">
          <span
            className="sensor-indicator-light"
            style={{ background: hasHandInView ? 'var(--signal-green)' : '#9ca3af' }}
            aria-hidden="true"
          />
          <span className="sensor-label">
            {hasHandInView ? 'ĐÃ BẮT ĐƯỢC BÀN TAY' : 'CHỜ BÀN TAY KÝ HIỆU'}
          </span>
        </div>

        <div className="sensor-switch-group">
          <button
            type="button"
            className="btn-hardware"
            style={{ minHeight: '32px', fontSize: '10px' }}
            onClick={() => setShowDiagnostics((prev) => !prev)}
            title="Bật/Tắt chẩn đoán ngón tay"
          >
            <Sliders size={12} aria-hidden="true" />
            <span>{showDiagnostics ? 'Đóng Kỹ thuật' : 'Kỹ thuật'}</span>
          </button>

          <button
            type="button"
            className="btn-hardware"
            style={{ minHeight: '32px', fontSize: '10px' }}
            onClick={toggleMode}
            disabled={cameraLoading}
          >
            {cameraLoading ? (
              <RefreshCw className="animate-spin" size={12} aria-hidden="true" />
            ) : isSimulated ? (
              <Video size={12} aria-hidden="true" />
            ) : (
              <VideoOff size={12} aria-hidden="true" />
            )}
            <span>
              {isSimulated ? 'Bật Camera Thật' : 'Chế độ Mô phỏng'}
            </span>
          </button>
        </div>
      </div>

      {cameraError && (
        <div style={{ padding: '6px 10px', fontSize: '11px', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', borderRadius: '4px', marginBottom: '8px' }}>
          {cameraError}
        </div>
      )}

      {/* Optical Viewfinder Frame (Completely Clean View of User!) */}
      <div className={`viewfinder-frame ${isFlashing ? 'match-flash is-flashing' : ''}`}>
        <video
          ref={videoRef}
          className="viewfinder-video"
          playsInline
          muted
          style={{ display: isSimulated ? 'none' : 'block' }}
        />
        <canvas ref={canvasRef} className="viewfinder-canvas" />

        {/* Viewfinder Flash Overlay Glow ("nháy 1 cái") */}
        {isFlashing && <div className="viewfinder-flash-overlay" aria-hidden="true" />}

        {/* Viewfinder Reticle & HUD (Zero Clutter on Face!) */}
        <div className="viewfinder-reticle">
          <div className="reticle-top">
            <div className="reticle-badge" style={{ background: 'rgba(0,0,0,0.65)', border: 'none' }}>
              <span style={{ color: hasHandInView ? '#10b981' : '#9ca3af' }}>●</span>{' '}
              {isSimulated ? 'Chế độ Mô phỏng' : 'Webcam Trực tiếp'}
            </div>

            {hasHandInView && (
              <div
                className="reticle-badge"
                style={{
                  background: matchScore >= TARGET_MATCH_THRESHOLD ? 'rgba(5, 150, 105, 0.88)' : 'rgba(0,0,0,0.65)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                <span>Khớp: {matchScore}%</span>
                {lockProgress > 0 && <span> ({Math.round(lockProgress * 100)}%)</span>}
              </div>
            )}
          </div>

          {/* Flash Match Toast Banner ("nháy 1 cái") */}
          {isFlashing && (
            <div
              style={{
                alignSelf: 'center',
                padding: '10px 24px',
                borderRadius: '8px',
                background: 'rgba(5, 150, 105, 0.95)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                boxShadow: '0 4px 24px rgba(16, 185, 129, 0.7)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(6px)',
                border: '1px solid #34d399',
              }}
            >
              <CheckCircle2 size={20} className="text-white" />
              <span>ĐÃ KHỚP: [{lastMatchedGloss || currentStep.gloss}]</span>
            </div>
          )}

          {/* VISUAL SIGN POSE TUTOR (Hình mẫu cử chỉ tay - Kiểu Typing Tutor) */}
          <div style={{ position: 'absolute', top: '48px', right: '12px', zIndex: 12 }}>
            <HandPoseGuide
              gloss={currentStep.gloss}
              hasHandInView={hasHandInView}
              matchScore={matchScore}
              isMatched={liveClassification?.isMatched ?? false}
              language={language}
            />
          </div>

          {/* Bottom Card: Minimal Target Word & Advance Trigger */}
          <div className="reticle-bottom">
            <div className="kinetic-gloss-display" style={{ background: 'rgba(0,0,0,0.78)', border: 'none' }}>
              <span className="gloss-sub" style={{ color: '#cbd5e1' }}>KÝ HIỆU TIẾP THEO</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="gloss-main" style={{ fontSize: '22px' }}>{currentStep.gloss}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>({currentStep.handPoseDesc})</span>
              </div>

              {/* Lock Progress Countdown Bar */}
              {lockProgress > 0 && (
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${lockProgress * 100}%`,
                      height: '100%',
                      background: '#10b981',
                      transition: 'width 0.04s linear',
                    }}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-hardware"
              style={{ minHeight: '34px', background: 'rgba(0,0,0,0.75)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={handleForceAdvance}
              title="Khớp nhanh từ này (phím Space)"
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>Khớp nhanh [Space]</span>
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL TECHNICAL DIAGNOSTICS (COLLAPSIBLE, HIDDEN BY DEFAULT) */}
      {showDiagnostics && liveClassification && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'var(--card-inset)',
            border: '1px solid var(--hairline)',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--ink-secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px', fontSize: '10px' }}>
            <span style={{ color: liveClassification.fingerStates.thumbExtended ? 'var(--signal-green)' : 'var(--ink-muted)' }}>
              👍 Cái: {liveClassification.fingerStates.thumbExtended ? 'XÒE' : 'GẬP'}
            </span>
            <span style={{ color: liveClassification.fingerStates.indexExtended ? 'var(--signal-green)' : 'var(--ink-muted)' }}>
              ☝️ Trỏ: {liveClassification.fingerStates.indexExtended ? 'THẲNG' : 'CO'}
            </span>
            <span style={{ color: liveClassification.fingerStates.middleExtended ? 'var(--signal-green)' : 'var(--ink-muted)' }}>
              🖕 Giữa: {liveClassification.fingerStates.middleExtended ? 'THẲNG' : 'CO'}
            </span>
            <span style={{ color: liveClassification.fingerStates.ringExtended ? 'var(--signal-green)' : 'var(--ink-muted)' }}>
              💍 Áp út: {liveClassification.fingerStates.ringExtended ? 'THẲNG' : 'CO'}
            </span>
            <span style={{ color: liveClassification.fingerStates.pinkyExtended ? 'var(--signal-green)' : 'var(--ink-muted)' }}>
              🤙 Út: {liveClassification.fingerStates.pinkyExtended ? 'THẲNG' : 'CO'}
            </span>
          </div>

          <div style={{ color: liveClassification.isMatched ? 'var(--signal-green)' : 'var(--signal-orange)', fontWeight: 600 }}>
            {liveClassification.debugText}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraTracker;
