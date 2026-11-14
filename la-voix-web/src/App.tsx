import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Stethoscope,
  HeartPulse,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  Video,
  Play,
  Square,
  Menu,
  X,
  Languages as LanguagesIcon,
  Activity,
  Zap,
  Thermometer,
  FileText,
  Building2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

import { Language, TouchCard, GestureStep, ScenarioId } from './types';
import { scenarios, scenarioReverseCards } from './data/scenarios';
import { CameraTracker, SessionState } from './components/CameraTracker';
import { ConfirmationGate } from './components/ConfirmationGate';
import { ReverseFeedbackPanel } from './components/ReverseFeedbackPanel';
import { VideoGuideModal } from './components/VideoGuideModal';

// Helper to render modifier card icons
const getTouchCardIcon = (iconName: string) => {
  switch (iconName) {
    case 'Activity':
      return <Activity size={15} aria-hidden="true" />;
    case 'Zap':
      return <Zap size={15} aria-hidden="true" />;
    case 'Thermometer':
      return <Thermometer size={15} aria-hidden="true" />;
    case 'FileText':
      return <FileText size={15} aria-hidden="true" />;
    case 'Building2':
      return <Building2 size={15} aria-hidden="true" />;
    default:
      return <Sparkles size={15} aria-hidden="true" />;
  }
};

const AUTO_SCENARIOS: ScenarioId[] = ['medical', 'cardio', 'allergy', 'admin'];

let sharedDemoAudioCtx: AudioContext | null = null;

const playDemoTone = (freq = 880, durationMs = 80) => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedDemoAudioCtx || sharedDemoAudioCtx.state === 'closed') {
      sharedDemoAudioCtx = new AudioCtx();
    }
    if (sharedDemoAudioCtx.state === 'suspended') {
      sharedDemoAudioCtx.resume().catch(() => {});
    }
    const osc = sharedDemoAudioCtx.createOscillator();
    const gain = sharedDemoAudioCtx.createGain();
    const now = sharedDemoAudioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.connect(gain);
    gain.connect(sharedDemoAudioCtx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch (e) {
    // AudioContext blocked
  }
};

export const App: React.FC = () => {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('medical');
  const [language, setLanguage] = useState<Language>('vi');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());
  const [selectedTouchCards, setSelectedTouchCards] = useState<TouchCard[]>([]);
  const [matchedStepIds, setMatchedStepIds] = useState<Set<string>>(new Set());
  const [isVideoGuideOpen, setIsVideoGuideOpen] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('recording');
  const resetTimeoutRef = useRef<number | null>(null);

  // Auto-play state & refs for 4 cases demo
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [autoCaseIndex, setAutoCaseIndex] = useState<number>(0);
  const isAutoPlayingRef = useRef<boolean>(false);
  const autoCaseIndexRef = useRef<number>(0);
  const autoPlayTimeoutsRef = useRef<number[]>([]);
  const speechSafetyTimeoutRef = useRef<number | null>(null);

  const clearAllAutoTimeouts = useCallback(() => {
    autoPlayTimeoutsRef.current.forEach((t) => clearTimeout(t));
    autoPlayTimeoutsRef.current = [];
    if (speechSafetyTimeoutRef.current) {
      clearTimeout(speechSafetyTimeoutRef.current);
      speechSafetyTimeoutRef.current = null;
    }
  }, []);

  const stopAutoPlay = useCallback(() => {
    clearAllAutoTimeouts();
    isAutoPlayingRef.current = false;
    setIsAutoPlaying(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [clearAllAutoTimeouts]);

  useEffect(() => {
    return () => {
      clearAllAutoTimeouts();
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearAllAutoTimeouts]);

  const activeScenario = scenarios[scenarioId];
  const activeReverseCards = scenarioReverseCards[scenarioId];

  // Reset session state on scenario switch
  useEffect(() => {
    setCurrentStepIndex(0);
    setCompletedStepIds(new Set());
    setMatchedStepIds(new Set());
    setSelectedTouchCards([]);
    setSessionState('recording');
  }, [scenarioId]);

  const currentStep = activeScenario.steps[currentStepIndex] || activeScenario.steps[0];

  const activeCompletedSteps = useMemo(() => {
    return activeScenario.steps.slice(0, currentStepIndex + 1);
  }, [activeScenario, currentStepIndex]);

  const allTokensAssembled = useMemo(() => {
    return matchedStepIds.size >= activeScenario.steps.length;
  }, [activeScenario.steps, matchedStepIds]);

  // Transition to ready_to_finalize when all 4 words are assembled
  useEffect(() => {
    if (allTokensAssembled && sessionState === 'recording') {
      setSessionState('ready_to_finalize');
    }
  }, [allTokensAssembled, sessionState]);

  const handleToggleTouchCard = (card: TouchCard) => {
    setSelectedTouchCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.filter((c) => c.id !== card.id);
      } else {
        return [...prev, card];
      }
    });
  };

  const handleNextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const nextIdx = (prev + 1) % activeScenario.steps.length;
      const nextStepObj = activeScenario.steps[nextIdx];
      setCompletedStepIds((prevSet) => new Set([...prevSet, nextStepObj.id]));
      setMatchedStepIds((prevSet) => new Set([...prevSet, nextStepObj.id]));
      return nextIdx;
    });
  }, [activeScenario.steps]);

  const handleTokenMatched = useCallback((step: GestureStep) => {
    if (isAutoPlayingRef.current) return;
    setMatchedStepIds((prevSet) => new Set([...prevSet, step.id]));
    setCompletedStepIds((prevSet) => new Set([...prevSet, step.id]));
  }, []);

  const handleAutoAdvance = useCallback(() => {
    if (isAutoPlayingRef.current) return;
    setCurrentStepIndex((prev) => {
      if (prev < activeScenario.steps.length - 1) {
        const nextIdx = prev + 1;
        const nextStepObj = activeScenario.steps[nextIdx];
        setCompletedStepIds((prevSet) => new Set([...prevSet, nextStepObj.id]));
        setMatchedStepIds((prevSet) => new Set([...prevSet, nextStepObj.id]));
        return nextIdx;
      }
      return prev;
    });
  }, [activeScenario.steps]);

  const handleSessionStart = useCallback(() => {
    setSessionState('recording');
    setCurrentStepIndex(0);
  }, []);

  // Handle Final Thumbs Up: Trigger speech ONCE and switch to 'finalized' state!
  const handleFinalizeLike = useCallback(() => {
    setSessionState('finalized');
    // Trigger speech synthesis ONCE
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    window.dispatchEvent(event);
  }, []);

  // Run a single case in the automated 4-case sequence
  const runAutoCase = useCallback((caseIndex: number) => {
    if (!isAutoPlayingRef.current) return;

    clearAllAutoTimeouts();

    if (caseIndex >= AUTO_SCENARIOS.length) {
      // Completed all 4 cases! Stop completely!
      isAutoPlayingRef.current = false;
      setIsAutoPlaying(false);
      clearAllAutoTimeouts();
      setResetFeedback(
        language === 'vi'
          ? '✓ Hoàn thành tự động toàn bộ 4 ca Demo!'
          : '✓ Completed auto-demo of all 4 cases!'
      );
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = window.setTimeout(() => {
        setResetFeedback(null);
        resetTimeoutRef.current = null;
      }, 3000);
      return;
    }

    autoCaseIndexRef.current = caseIndex;
    setAutoCaseIndex(caseIndex);

    const targetScId = AUTO_SCENARIOS[caseIndex];
    setScenarioId(targetScId);

    const scObj = scenarios[targetScId];
    const steps = scObj.steps;

    // Reset session state for this case
    setCurrentStepIndex(0);
    setCompletedStepIds(new Set());
    setMatchedStepIds(new Set());
    setSelectedTouchCards([]);
    setSessionState('recording');

    // Step 0: matches after 800ms
    const t0 = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      playDemoTone(880, 80);
      setCompletedStepIds(new Set([steps[0].id]));
      setMatchedStepIds(new Set([steps[0].id]));
    }, 800);

    // Step 1: matches after 2000ms
    const t1 = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      playDemoTone(940, 80);
      setCurrentStepIndex(1);
      setCompletedStepIds(new Set([steps[0].id, steps[1].id]));
      setMatchedStepIds(new Set([steps[0].id, steps[1].id]));
    }, 2000);

    // Step 2: matches after 3200ms
    const t2 = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      playDemoTone(1020, 80);
      setCurrentStepIndex(2);
      setCompletedStepIds(new Set([steps[0].id, steps[1].id, steps[2].id]));
      setMatchedStepIds(new Set([steps[0].id, steps[1].id, steps[2].id]));
    }, 3200);

    // Step 3: matches after 4400ms
    const t3 = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      playDemoTone(1100, 80);
      setCurrentStepIndex(3);
      setCompletedStepIds(new Set([steps[0].id, steps[1].id, steps[2].id, steps[3].id]));
      setMatchedStepIds(new Set([steps[0].id, steps[1].id, steps[2].id, steps[3].id]));
      setSessionState('ready_to_finalize');
    }, 4400);

    // Final thumbs up & broadcast after 5400ms
    const tFinal = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      playDemoTone(1320, 160);
      setSessionState('finalized');

      // Trigger speech synthesis
      const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
      window.dispatchEvent(event);

      // Safety fallback in case browser speech onend doesn't fire:
      speechSafetyTimeoutRef.current = window.setTimeout(() => {
        if (!isAutoPlayingRef.current) return;
        runAutoCase(caseIndex + 1);
      }, 7500);
    }, 5400);

    autoPlayTimeoutsRef.current = [t0, t1, t2, t3, tFinal];
  }, [language, clearAllAutoTimeouts]);

  // When speech finishes reading: wait 2s, then advance to next case!
  const handleSpeechEnd = useCallback(() => {
    if (!isAutoPlayingRef.current) return;

    if (speechSafetyTimeoutRef.current) {
      clearTimeout(speechSafetyTimeoutRef.current);
      speechSafetyTimeoutRef.current = null;
    }

    // "Đọc xong chữ của case này thì đợi 2s sau thì chuyển sang case tiếp theo."
    const delayTimer = window.setTimeout(() => {
      if (!isAutoPlayingRef.current) return;
      runAutoCase(autoCaseIndexRef.current + 1);
    }, 2000);

    autoPlayTimeoutsRef.current.push(delayTimer);
  }, [runAutoCase]);

  // Toggle Auto-Play 4 Cases
  const toggleAutoPlay4Cases = useCallback(() => {
    if (isAutoPlayingRef.current) {
      stopAutoPlay();
      setResetFeedback(language === 'vi' ? 'Đã tạm dừng tự động Demo.' : 'Demo paused.');
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = window.setTimeout(() => {
        setResetFeedback(null);
        resetTimeoutRef.current = null;
      }, 2000);
    } else {
      clearAllAutoTimeouts();
      isAutoPlayingRef.current = true;
      setIsAutoPlaying(true);
      setResetFeedback(
        language === 'vi'
          ? '▶️ Bắt đầu tự động chạy 4 ca Demo (Tự chuyển sau 2s)...'
          : '▶️ Starting auto-demo for 4 cases...'
      );
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = window.setTimeout(() => {
        setResetFeedback(null);
        resetTimeoutRef.current = null;
      }, 2500);
      runAutoCase(0);
    }
  }, [clearAllAutoTimeouts, language, runAutoCase, stopAutoPlay]);

  // Zero-Retention Reset
  const handleZeroRetentionReset = useCallback(() => {
    stopAutoPlay();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setCurrentStepIndex(0);
    setCompletedStepIds(new Set());
    setMatchedStepIds(new Set());
    setSelectedTouchCards([]);
    setSessionState('recording');

    try {
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }

    setResetFeedback(
      language === 'vi'
        ? 'Zero-Retention: Bộ nhớ phiên đã giải phóng sạch sẽ (Luật 91/2025/QH15)!'
        : 'Zero-Retention: Memory purged compliant with Law 91/2025/QH15!'
    );
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      setResetFeedback(null);
      resetTimeoutRef.current = null;
    }, 2800);
  }, [language]);

  // Global Keyboard Shortcuts (1: Bụng, 2: Tim, 3: Dị ứng, 4: Hành chính)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (sessionState === 'ready_to_finalize') {
          handleFinalizeLike();
        } else if (sessionState === 'finalized') {
          handleZeroRetentionReset();
        } else {
          handleNextStep();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleZeroRetentionReset();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        toggleAutoPlay4Cases();
      } else if (e.key === '1') {
        stopAutoPlay();
        setScenarioId('medical');
      } else if (e.key === '2') {
        stopAutoPlay();
        setScenarioId('cardio');
      } else if (e.key === '3') {
        stopAutoPlay();
        setScenarioId('allergy');
      } else if (e.key === '4') {
        stopAutoPlay();
        setScenarioId('admin');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handleZeroRetentionReset, handleFinalizeLike, sessionState, toggleAutoPlay4Cases, stopAutoPlay]);

  return (
    <div className="la-voix-chassis">
      {/* 1. TOP INSTRUMENT STRIP (SCENARIO SELECTOR 1-4) */}
      <header className="instrument-strip" role="banner">
        <div className="brand-section">
          <div className="brand-badge" aria-hidden="true">LV</div>
          <div className="brand-meta">
            <div className="brand-title-row">
              <span className="brand-name">LA VOIX</span>
              <span className="brand-edition">v2.0</span>
            </div>
            <span className="brand-sub">
              {language === 'vi'
                ? 'Nền tảng Giao tiếp Song phương Ký hiệu Y tế & Hành chính'
                : 'Bilingual Assistive Sign Terminal · ULIS Hackathon 2026'}
            </span>
          </div>
        </div>

        {/* 4 Multi-Clinical Scenario Rocker Tabs */}
        <nav className="mode-rocker-track" aria-label="Mode Selection" style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={`mode-rocker-btn med ${scenarioId === 'medical' ? 'active' : ''}`}
            onClick={() => setScenarioId('medical')}
            title="Ca 1: Cấp cứu Đau bụng cấp (Phím 1)"
          >
            <span className="mode-led" aria-hidden="true" />
            <Stethoscope size={13} aria-hidden="true" />
            <span>01 Đau bụng</span>
            <span className="key-tag">1</span>
          </button>

          <button
            type="button"
            className={`mode-rocker-btn med ${scenarioId === 'cardio' ? 'active' : ''}`}
            onClick={() => setScenarioId('cardio')}
            title="Ca 2: Cấp cứu Đau thắt ngực & Tim mạch (Phím 2)"
          >
            <span className="mode-led" aria-hidden="true" />
            <HeartPulse size={13} aria-hidden="true" />
            <span>02 Tim mạch</span>
            <span className="key-tag">2</span>
          </button>

          <button
            type="button"
            className={`mode-rocker-btn med ${scenarioId === 'allergy' ? 'active' : ''}`}
            onClick={() => setScenarioId('allergy')}
            title="Ca 3: Cấp cứu Dị ứng phản vệ & Nghẹt thở (Phím 3)"
          >
            <span className="mode-led" aria-hidden="true" />
            <AlertTriangle size={13} aria-hidden="true" />
            <span>03 Dị ứng</span>
            <span className="key-tag">3</span>
          </button>

          <button
            type="button"
            className={`mode-rocker-btn adm ${scenarioId === 'admin' ? 'active' : ''}`}
            onClick={() => setScenarioId('admin')}
            title="Ca 4: Hành chính Một cửa ULIS (Phím 4)"
          >
            <span className="mode-led" aria-hidden="true" />
            <GraduationCap size={13} aria-hidden="true" />
            <span>04 ULIS</span>
            <span className="key-tag">4</span>
          </button>
        </nav>

        {/* Actions */}
        <div className="strip-actions">
          <button
            type="button"
            className="btn-hardware"
            onClick={() => setLanguage((prev) => (prev === 'vi' ? 'en' : 'vi'))}
            title="Đổi ngôn ngữ (VI / EN)"
            aria-label="Toggle language"
          >
            <LanguagesIcon size={14} aria-hidden="true" />
            <span>{language.toUpperCase()}</span>
          </button>

          <button
            type="button"
            className={`btn-hardware btn-guide ${isAutoPlaying ? 'btn-autoplaying' : ''}`}
            onClick={toggleAutoPlay4Cases}
            aria-label="Tự động chạy toàn bộ 4 ca demo"
            title={isAutoPlaying ? 'Dừng tự động chạy (Phím G)' : 'Tự động chạy hết 4 ca demo (Phím G)'}
          >
            {isAutoPlaying ? (
              <>
                <Square size={13} fill="#e11d48" aria-hidden="true" />
                <span>{language === 'vi' ? `Dừng Demo (${autoCaseIndex + 1}/4)` : `Stop (${autoCaseIndex + 1}/4)`}</span>
                <span className="key-tag" style={{ background: '#fda4af', color: '#881337' }}>G</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" aria-hidden="true" />
                <span>{language === 'vi' ? 'Tự chạy 4 ca' : 'Auto 4 Cases'}</span>
                <span className="key-tag">G</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-hardware"
            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setIsVideoGuideOpen(true)}
            title="Xem kịch bản lời thoại 90s cho thuyết trình"
            aria-label="Xem kịch bản 90s"
          >
            <Video size={13} aria-hidden="true" />
            <span>{language === 'vi' ? 'Lời thoại' : 'Script'}</span>
          </button>

          <button
            type="button"
            className="btn-hardware btn-reset"
            onClick={handleZeroRetentionReset}
            title="Xóa phiên (Luật 91/2025/QH15)"
            aria-label="Reset session"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>{language === 'vi' ? 'Xóa phiên' : 'Reset'}</span>
            <span className="key-tag">R</span>
          </button>
        </div>
      </header>

      {/* Reset Notification Banner */}
      {resetFeedback && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            background: 'var(--signal-green-dim)',
            border: '1px solid #a3e6cd',
            color: 'var(--signal-green)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role="status"
        >
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{resetFeedback}</span>
        </div>
      )}

      {/* 2. MINIMALIST TWO-PANEL WORKSPACE GRID */}
      <main className="workspace-deck" role="main">
        {/* LEFT CONSOLE: WEBCAM TRACKER & CLEAN TOKEN STRIP */}
        <div className="left-console">
          {/* SENSOR CAMERA / VIEWFINDER */}
          <CameraTracker
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            sessionState={sessionState}
            onSessionStart={handleSessionStart}
            onFinalizeLike={handleFinalizeLike}
            onResetSession={handleZeroRetentionReset}
            language={language}
            onAutoAdvance={handleAutoAdvance}
            onTokenMatched={handleTokenMatched}
          />

          {/* DẢI GHÉP KÝ HIỆU THỜI GIAN THỰC */}
          <div className="sentence-assembly-chassis" style={{ marginTop: '10px' }}>
            <div className="assembly-strip-header">
              <div className="assembly-strip-title">
                <Sparkles size={14} className={allTokensAssembled ? 'text-emerald-500' : 'text-cyan-500'} />
                <span>{language === 'vi' ? 'Dải Ghép Ký Hiệu Thời Gian Thực' : 'Real-time Token Snap Strip'}</span>
              </div>
              <span className="assembly-strip-counter">
                {sessionState === 'finalized'
                  ? (language === 'vi' ? '✓ ĐÃ PHÁT ÂM THANH (1 LẦN THÀNH CÔNG)' : '✓ BROADCAST COMPLETE (ONCE)')
                  : allTokensAssembled
                  ? (language === 'vi' ? '✓ ĐỦ 4/4 TỪ · THẢ LIKE 👍 ĐỂ CHỐT' : '✓ 4/4 TOKENS · THUMBS UP TO FINALIZE')
                  : (language === 'vi' ? `ĐÃ BẮT: ${matchedStepIds.size}/4 TỪ` : `TRACKED: ${matchedStepIds.size}/4`)}
              </span>
            </div>

            {/* Magnetic Token Snap Track */}
            <div className={`assembly-track ${matchedStepIds.size > 0 ? 'has-tokens' : ''}`}>
              {activeScenario.steps.map((step, idx) => {
                const isMatched = matchedStepIds.has(step.id);
                const isCurrent = idx === currentStepIndex && sessionState === 'recording';
                return (
                  <React.Fragment key={step.id}>
                    {idx > 0 && <span className="assembly-token-connector">→</span>}
                    <div
                      className={`assembly-token ${isMatched ? 'active-token tokenAssemble' : ''}`}
                      style={{
                        opacity: isMatched ? 1 : isCurrent ? 0.9 : 0.45,
                        borderColor: isCurrent ? 'var(--signal-orange)' : isMatched ? '#10b981' : '#cbd5e1',
                        borderWidth: isCurrent ? '2px' : '1px',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        setCompletedStepIds((prev) => new Set([...prev, step.id]));
                        setMatchedStepIds((prev) => new Set([...prev, step.id]));
                      }}
                    >
                      <span className="token-index">0{idx + 1}</span>
                      <span className="token-gloss">{language === 'vi' ? step.gloss : step.glossEn}</span>
                      {isMatched && <CheckCircle2 size={12} className="text-emerald-500" />}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* TACTILE MODIFIER KEYPAD (TOUCH CARDS) */}
          <div className="modifier-chassis" style={{ marginTop: '10px' }}>
            <div className="modifier-title">
              {language === 'vi' ? 'Bổ trợ Triệu chứng Cấp cứu (Chạm nhanh)' : 'Clinical Emergency Modifiers'}
            </div>
            <div className="modifier-grid">
              {activeScenario.touchCards.map((card) => {
                const isSelected = selectedTouchCards.some((c) => c.id === card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`modifier-key ${isSelected ? 'active' : ''}`}
                    onClick={() => handleToggleTouchCard(card)}
                    aria-pressed={isSelected}
                  >
                    <span className="modifier-icon">{getTouchCardIcon(card.icon)}</span>
                    <span>{language === 'vi' ? card.label : card.labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT CONSOLE: AI AUTO-COMPLETE PREDICTOR & REVERSE STATION */}
        <div className="right-console">
          {/* AI AUTO-COMPLETE SAFETY CONFIRMATION GATE */}
          <ConfirmationGate
            scenario={activeScenario}
            activeSteps={activeCompletedSteps}
            matchedStepCount={matchedStepIds.size}
            allMatched={allTokensAssembled}
            selectedTouchCards={selectedTouchCards}
            language={language}
            onSpeechEnd={handleSpeechEnd}
          />

          {/* REVERSE FEEDBACK STATION (DOCTOR SPEECH -> VSL FLASHCARDS) */}
          <ReverseFeedbackPanel
            scenario={activeScenario}
            reverseCards={activeReverseCards}
            language={language}
          />
        </div>
      </main>

      {/* 3. HARDWARE STATUS FOOTER */}
      <footer className="hardware-footer-strip" role="contentinfo">
        <div className="footer-left">
          <div className="footer-pill">
            <span className="footer-dot" aria-hidden="true" />
            <span>AI ENGINE: MEDIAPIPE SINGLE-HAND V3</span>
          </div>
          <div className="footer-pill">
            <span>LATENCY: 18ms</span>
          </div>
          <div className="footer-pill">
            <span>PRIVACY: LAW 91/2025 ZERO-RETENTION</span>
          </div>
        </div>
        <div className="footer-right">
          <span>PHÍM TẮT: [1-4] ĐỔI CA BỆNH · [G] TỰ CHẠY 4 CA DEMO · [SPACE] BƯỚC · [C] DUYỆT PHÁT ÂM · [R] XÓA PHIÊN</span>
        </div>
      </footer>

      {/* 4. ACCESSIBLE 90-SECOND VIDEO GUIDE MODAL */}
      <VideoGuideModal
        isOpen={isVideoGuideOpen}
        onClose={() => setIsVideoGuideOpen(false)}
        language={language}
      />
    </div>
  );
};

export default App;
