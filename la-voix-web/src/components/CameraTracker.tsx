import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff, RefreshCw, CheckCircle2, Sliders, Sparkles, ToggleLeft, ToggleRight, ThumbsUp, Play, Settings, RotateCcw } from 'lucide-react';
import { GestureStep, Language } from '../types';
import { HandLandmarkStabilizer } from '../utils/oneEuroFilter';
import { classifyHandLandmarks, GestureMatchResult, getTargetPoseName } from '../utils/gestureClassifier';
import { HandPoseGuide } from './HandPoseGuide';

export type SessionState = 'idle' | 'recording' | 'ready_to_finalize' | 'finalized';

interface CameraTrackerProps {
  currentStep: GestureStep;
  currentStepIndex?: number;
  sessionState?: SessionState;
  onSessionStart?: () => void;
  onFinalizeLike?: () => void;
  onResetSession?: () => void;
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

const LOCK_HOLD_MS = 750; // 0.75s intentional hold

// AudioContext for affirmative token match chime
let sharedAudioCtx: AudioContext | null = null;
const playAdvanceChirp = (type: 'word' | 'start' | 'final' = 'word') => {
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
    const now = sharedAudioCtx.currentTime;

    if (type === 'final') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.24);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    }
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
  } catch (e) {
    // AudioContext blocked
  }
};

export const CameraTracker: React.FC<CameraTrackerProps> = ({
  currentStep,
  currentStepIndex = 0,
  sessionState = 'recording',
  onSessionStart,
  onFinalizeLike,
  onResetSession,
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

  // MediSign AI 1€ Filter Stabilizer
  const stabilizerRef = useRef<HandLandmarkStabilizer>(new HandLandmarkStabilizer());
  const lastMediaPipeTimestampRef = useRef<number>(0);

  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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
  const hasTriggeredFinalizeRef = useRef<boolean>(false); // STRICT GUARD: Ensures speech is triggered ONLY ONCE!

  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;
  const onTokenMatchedRef = useRef(onTokenMatched);
  onTokenMatchedRef.current = onTokenMatched;
  const autoAdvanceEnabledRef = useRef(autoAdvanceEnabled);
  autoAdvanceEnabledRef.current = autoAdvanceEnabled;
  const onSessionStartRef = useRef(onSessionStart);
  onSessionStartRef.current = onSessionStart;
  const onFinalizeLikeRef = useRef(onFinalizeLike);
  onFinalizeLikeRef.current = onFinalizeLike;
  const onResetSessionRef = useRef(onResetSession);
  onResetSessionRef.current = onResetSession;

  // Reset finalize trigger lock only when starting a new session or recording
  useEffect(() => {
    if (sessionState === 'idle' || sessionState === 'recording') {
      hasTriggeredFinalizeRef.current = false;
    }
  }, [sessionState]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

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
          numHands: 1,
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

  useEffect(() => {
    startCamera();
    return () => {
      stopCameraStream();
    };
  }, [startCamera, stopCameraStream]);

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

    if (gloss === 'Tôi') {
      indexExtension = 1.35;
      fingerCurl = 0.85;
    } else if (gloss === 'Đau') {
      fingerCurl = 0.88;
    } else if (gloss === 'Bụng') {
      fingerCurl = 0.05;
    } else if (gloss === 'Hôm qua') {
      thumbAngle = 0.95;
      fingerCurl = 0.85;
    }

    landmarks[0] = {
      x: cx + wristXOffset,
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
        curX += Math.sin(angle) * effectiveSegLen;
        curY -= Math.cos(angle) * effectiveSegLen;

        landmarks[segIdx] = { x: curX, y: curY };
      }
    });

    return landmarks;
  };

  const drawCanvas = (
    ctx: CanvasRenderingContext2D,
    userLandmarks: { x: number; y: number }[],
    width: number,
    height: number,
    isTargetLocked: boolean
  ) => {
    ctx.clearRect(0, 0, width, height);

    if (!userLandmarks || userLandmarks.length < 21) {
      return;
    }

    const boneColor = isTargetLocked ? '#10b981' : '#38bdf8';
    const tipFill = isTargetLocked ? '#059669' : '#ff5500';

    ctx.lineWidth = 3.5;
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
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = tipFill;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else if (isWrist) {
        ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffaa00';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = boneColor;
        ctx.stroke();
      }
    });
  };

  // Main Tracking Loop with EXACT Cover-Fit Affine Mapping (Zero Drift!)
  useEffect(() => {
    isMountedRef.current = true;
    let isRunning = true;

    const renderLoop = (now: number) => {
      if (!isRunning) return;

      const video = videoRef.current;
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

      const cw = canvas.width;
      const ch = canvas.height;
      const timeInSec = now * 0.001;

      // Cover-Fit Affine Mapping
      let renderW = cw;
      let renderH = ch;
      let offsetX = 0;
      let offsetY = 0;

      if (video && video.videoWidth && video.videoHeight) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const videoRatio = vw / vh;
        const canvasRatio = cw / ch;

        if (canvasRatio > videoRatio) {
          renderW = cw;
          renderH = cw / videoRatio;
          offsetY = (ch - renderH) / 2;
        } else {
          renderH = ch;
          renderW = ch * videoRatio;
          offsetX = (cw - renderW) / 2;
        }
      }

      let rawLandmarks: { x: number; y: number }[] = [];
      let handDetected = false;

      // When session is finalized, freeze gesture tracking to avoid spam
      const isTrackingActive = sessionState !== 'finalized';

      if (isTrackingActive) {
        if (!isSimulated) {
          if (video && landmarkerRef.current && video.readyState >= 2) {
            try {
              const safeTimestamp = Math.max(now, lastMediaPipeTimestampRef.current + 1);
              lastMediaPipeTimestampRef.current = safeTimestamp;

              const results = landmarkerRef.current.detectForVideo(video, safeTimestamp);
              if (results.landmarks && results.landmarks.length > 0) {
                const raw = results.landmarks[0];
                const wristY = raw[0].y;
                if (wristY < 0.90) {
                  rawLandmarks = raw.map((lm: any) => ({
                    x: offsetX + lm.x * renderW,
                    y: offsetY + lm.y * renderH,
                  }));
                  handDetected = true;
                }
              }
            } catch (e) {
              // safe catch
            }
          }
        } else {
          rawLandmarks = getProceduralLandmarks(timeInSec, cw, ch, currentStep.gloss);
          handDetected = true;
        }
      }

      let currentLandmarks: { x: number; y: number }[] = [];
      let isTargetMatched = false;
      let matchScoreVal = 0;
      let classification: GestureMatchResult | null = null;

      if (handDetected && rawLandmarks.length >= 21) {
        currentLandmarks = stabilizerRef.current.filter(rawLandmarks, now);
        classification = classifyHandLandmarks(currentLandmarks, currentStep.gloss, sessionState);
        matchScoreVal = classification.matchScore;
        isTargetMatched = classification.isMatched;
      }

      // Auto-Advance Lock Engine (WITH ONCE-ONLY FINAL GUARD)
      if (handDetected && isTargetMatched && now > lockCooldownUntilRef.current) {
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
          if (sessionState === 'idle') {
            playAdvanceChirp('start');
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 400);
            if (onSessionStartRef.current) onSessionStartRef.current();
            matchStartTimeRef.current = null;
            setLockProgress(0);
            lockCooldownUntilRef.current = now + 900;
          } else if (sessionState === 'ready_to_finalize') {
            // STRICT ONCE-ONLY GUARD FOR THUMBS UP!
            if (!hasTriggeredFinalizeRef.current) {
              hasTriggeredFinalizeRef.current = true;
              playAdvanceChirp('final');
              setIsFlashing(true);
              setTimeout(() => setIsFlashing(false), 700);

              if (onFinalizeLikeRef.current) {
                onFinalizeLikeRef.current();
              }
            }
            matchStartTimeRef.current = null;
            setLockProgress(0);
            lockCooldownUntilRef.current = now + 999999; // Lock permanently until user resets!
          } else {
            playAdvanceChirp('word');
            setIsFlashing(true);
            setLastMatchedGloss(currentStep.gloss);
            setTimeout(() => setIsFlashing(false), 450);

            if (onTokenMatchedRef.current) onTokenMatchedRef.current(currentStep);
            if (autoAdvanceEnabledRef.current && onAutoAdvanceRef.current) {
              onAutoAdvanceRef.current();
            }
            matchStartTimeRef.current = null;
            setLockProgress(0);
            lockCooldownUntilRef.current = now + 900;
          }
        }
      } else {
        if (matchStartTimeRef.current !== null) {
          matchStartTimeRef.current = null;
          setLockProgress(0);
        }
      }

      if (now - lastReactUpdateRef.current >= 100) {
        setHasHandInView(handDetected);
        setMatchScore(matchScoreVal);
        setLiveClassification(classification);
        lastReactUpdateRef.current = now;
      }

      drawCanvas(ctx, currentLandmarks, cw, ch, isTargetMatched);

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
  }, [isSimulated, currentStep.gloss, sessionState, onMotionStateChange]);

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

  const handleForceAdvance = () => {
    if (sessionState === 'idle') {
      playAdvanceChirp('start');
      if (onSessionStartRef.current) onSessionStartRef.current();
    } else if (sessionState === 'ready_to_finalize') {
      if (!hasTriggeredFinalizeRef.current) {
        hasTriggeredFinalizeRef.current = true;
        playAdvanceChirp('final');
        if (onFinalizeLikeRef.current) onFinalizeLikeRef.current();
      }
    } else if (sessionState === 'finalized') {
      if (onResetSessionRef.current) onResetSessionRef.current();
    } else {
      playAdvanceChirp('word');
      setIsFlashing(true);
      setLastMatchedGloss(currentStep.gloss);
      setTimeout(() => setIsFlashing(false), 450);
      if (onTokenMatchedRef.current) onTokenMatchedRef.current(currentStep);
      if (onAutoAdvanceRef.current) onAutoAdvanceRef.current();
    }
  };

  return (
    <div className="sensor-chassis">
      {/* Sensor Minimal Header: ONLY Status Indicator & One Settings Cog */}
      <div className="sensor-header" style={{ position: 'relative' }}>
        <div className="sensor-title-box">
          <span
            className="sensor-indicator-light"
            style={{
              background: sessionState === 'finalized'
                ? '#10b981'
                : hasHandInView
                ? 'var(--signal-green)'
                : '#9ca3af',
            }}
            aria-hidden="true"
          />
          <span className="sensor-label">
            {sessionState === 'finalized'
              ? 'PHIÊN HOÀN TẤT (1 LẦN)'
              : hasHandInView
              ? 'ĐÃ BẮT BÀN TAY'
              : 'CHỜ BÀN TAY KÝ HIỆU'}
          </span>
        </div>

        {/* Unified Settings Gear Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`btn-hardware ${isSettingsOpen ? 'active' : ''}`}
            style={{ minHeight: '30px', padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            title="Cài đặt camera & nhận diện"
            aria-label="Settings"
          >
            <Settings size={13} className={isSettingsOpen ? 'rotate-90 transition-transform' : ''} />
            <span>Cài đặt</span>
          </button>

          {/* Clean Settings Popover Dropdown */}
          {isSettingsOpen && (
            <div
              style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                width: '210px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: '8px',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '2px 4px' }}>
                Tùy chọn ghi hình
              </div>

              {/* Auto-Advance toggle */}
              <button
                type="button"
                className="btn-hardware"
                style={{ width: '100%', justifyContent: 'space-between', minHeight: '30px', fontSize: '11px', background: autoAdvanceEnabled ? '#f0fdf4' : '#f8fafc' }}
                onClick={() => setAutoAdvanceEnabled((prev) => !prev)}
              >
                <span>Tự nhảy từ (0.75s)</span>
                {autoAdvanceEnabled ? (
                  <ToggleRight size={16} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={16} className="text-slate-400" />
                )}
              </button>

              {/* Technical Diagnostics */}
              <button
                type="button"
                className="btn-hardware"
                style={{ width: '100%', justifyContent: 'space-between', minHeight: '30px', fontSize: '11px' }}
                onClick={() => setShowDiagnostics((prev) => !prev)}
              >
                <span>Chẩn đoán ngón tay</span>
                <Sliders size={13} />
              </button>

              {/* Simulation Mode Toggle */}
              <button
                type="button"
                className="btn-hardware"
                style={{ width: '100%', justifyContent: 'space-between', minHeight: '30px', fontSize: '11px' }}
                onClick={toggleMode}
                disabled={cameraLoading}
              >
                <span>{isSimulated ? 'Bật Camera Thật' : 'Chế độ Mô phỏng'}</span>
                {isSimulated ? <Video size={13} /> : <VideoOff size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {cameraError && (
        <div style={{ padding: '6px 10px', fontSize: '11px', background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', borderRadius: '4px', marginBottom: '8px' }}>
          {cameraError}
        </div>
      )}

      {/* Optical Viewfinder Frame */}
      <div className={`viewfinder-frame ${isFlashing ? 'match-flash is-flashing' : ''}`}>
        <video
          ref={videoRef}
          className="viewfinder-video"
          playsInline
          muted
          style={{ display: isSimulated ? 'none' : 'block' }}
        />
        <canvas ref={canvasRef} className="viewfinder-canvas" />

        {isFlashing && <div className="viewfinder-flash-overlay" aria-hidden="true" />}

        {/* Viewfinder Reticle & HUD */}
        <div className="viewfinder-reticle">
          <div className="reticle-top">
            <div className="reticle-badge" style={{ background: 'rgba(0,0,0,0.68)', border: 'none' }}>
              <span style={{ color: hasHandInView ? '#10b981' : '#9ca3af' }}>●</span>{' '}
              {sessionState === 'finalized'
                ? 'ĐÃ PHÁT ÂM THANH CHO BÁC SĨ'
                : sessionState === 'ready_to_finalize'
                ? 'SẴN SÀNG CHỐT CÂU'
                : sessionState === 'idle'
                ? 'CHỜ KHỞI ĐỘNG CÂU'
                : `TỪ ${currentStepIndex + 1}/4`}
            </div>

            {hasHandInView && sessionState !== 'finalized' && (
              <div
                className="reticle-badge"
                style={{
                  background: liveClassification?.isMatched ? 'rgba(5, 150, 105, 0.92)' : 'rgba(0,0,0,0.68)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                <span>{liveClassification?.detectedPoseName || 'Đang quét...'}</span>
                {lockProgress > 0 && <span> ({Math.round(lockProgress * 100)}%)</span>}
              </div>
            )}
          </div>

          {/* Flash Match Toast Banner */}
          {isFlashing && (
            <div
              style={{
                alignSelf: 'center',
                padding: '12px 28px',
                borderRadius: '8px',
                background: 'rgba(5, 150, 105, 0.96)',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                boxShadow: '0 4px 28px rgba(16, 185, 129, 0.75)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backdropFilter: 'blur(6px)',
                border: '1.5px solid #34d399',
              }}
            >
              {sessionState === 'ready_to_finalize' ? (
                <>
                  <ThumbsUp size={22} className="text-white" />
                  <span>👍 ĐÃ THẢ LIKE! PHÁT TIẾNG RA LOA</span>
                </>
              ) : sessionState === 'idle' ? (
                <>
                  <Play size={22} className="text-white" />
                  <span>👋 ĐÃ BẮT ĐẦU PHIÊN NHẬP CÂU!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={22} className="text-white" />
                  <span>✓ ĐÃ KHỚP: [{lastMatchedGloss || currentStep.gloss}]</span>
                </>
              )}
            </div>
          )}

          {/* VISUAL SIGN POSE TUTOR */}
          {sessionState !== 'finalized' && (
            <div style={{ position: 'absolute', top: '48px', right: '12px', zIndex: 12 }}>
              <HandPoseGuide
                gloss={sessionState === 'idle' ? 'Bắt đầu' : sessionState === 'ready_to_finalize' ? 'Thả like' : currentStep.gloss}
                hasHandInView={hasHandInView}
                matchScore={matchScore}
                isMatched={liveClassification?.isMatched ?? false}
                detectedPoseName={liveClassification?.detectedPoseName}
                lockProgress={lockProgress}
                sessionState={sessionState}
                language={language}
              />
            </div>
          )}

          {/* Bottom Card: Current Target Word & Advance Trigger */}
          <div className="reticle-bottom">
            <div className="kinetic-gloss-display" style={{ background: 'rgba(0,0,0,0.84)', border: 'none' }}>
              <span className="gloss-sub" style={{ color: '#cbd5e1' }}>
                {sessionState === 'finalized'
                  ? 'KẾT QUẢ GIAO TIẾP'
                  : sessionState === 'ready_to_finalize'
                  ? 'GIAI ĐOẠN 5: CHỐT CÂU & PHÁT TIẾNG'
                  : sessionState === 'idle'
                  ? 'GIAI ĐOẠN 0: KHỞI ĐỘNG PHIÊN'
                  : `KÝ HIỆU TIẾP THEO (TỪ ${currentStepIndex + 1}/4)`}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="gloss-main" style={{ fontSize: '20px' }}>
                  {sessionState === 'finalized'
                    ? '🎉 Câu đã phát thành công!'
                    : sessionState === 'ready_to_finalize'
                    ? '👍 Thả like kết thúc câu'
                    : sessionState === 'idle'
                    ? '👋 Vẫy tay mở chào'
                    : currentStep.gloss}
                </span>
                {sessionState !== 'finalized' && (
                  <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>
                    ({getTargetPoseName(currentStep.gloss, sessionState)})
                  </span>
                )}
              </div>

              {lockProgress > 0 && (
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '5px', overflow: 'hidden' }}>
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
              style={{ minHeight: '34px', background: 'rgba(0,0,0,0.8)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={handleForceAdvance}
              title={sessionState === 'finalized' ? 'Bắt đầu câu mới (Phím R)' : 'Khớp nhanh bước này (phím Space)'}
            >
              {sessionState === 'finalized' ? (
                <>
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Câu mới [Phím R]</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} aria-hidden="true" />
                  <span>
                    {sessionState === 'idle'
                      ? 'Bắt đầu ngay [Space]'
                      : sessionState === 'ready_to_finalize'
                      ? 'Chốt & Phát tiếng [Space]'
                      : 'Khớp nhanh [Space]'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL TECHNICAL DIAGNOSTICS */}
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
