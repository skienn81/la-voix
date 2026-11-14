import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Stethoscope,
  HeartPulse,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  Video,
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

  // Auto-switch to next case after patient signs & TTS finishes reading
  const [autoNextCaseEnabled, setAutoNextCaseEnabled] = useState<boolean>(true);
  const autoNextCaseEnabledRef = useRef<boolean>(true);
  autoNextCaseEnabledRef.current = autoNextCaseEnabled;
  const autoNextTimerRef = useRef<number | null>(null);
  const [transitionCountdown, setTransitionCountdown] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (autoNextTimerRef.current) {
        clearTimeout(autoNextTimerRef.current);
      }
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeScenario = scenarios[scenarioId];
  const activeReverseCards = scenarioReverseCards[scenarioId];

  // Reset session state on scenario switch
  useEffect(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setTransitionCountdown(null);
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
    setMatchedStepIds((prevSet) => new Set([...prevSet, step.id]));
    setCompletedStepIds((prevSet) => new Set([...prevSet, step.id]));
  }, []);

  const handleAutoAdvance = useCallback(() => {
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

  // When patient finishes gestures and TTS speaks aloud:
  // "Đọc xong chữ của case này thì đợi 2s sau thì chuyển sang case tiếp theo. Đến case cuối xong thì dừng lại k cần làm gì thêm :)"
  const handleSpeechEnd = useCallback(() => {
    if (!autoNextCaseEnabledRef.current) return;

    let nextScId: ScenarioId | null = null;
    let nextTitle = '';

    if (scenarioId === 'medical') {
      nextScId = 'cardio';
      nextTitle = '02 Tim mạch & Đau ngực';
    } else if (scenarioId === 'cardio') {
      nextScId = 'allergy';
      nextTitle = '03 Dị ứng Phản vệ';
    } else if (scenarioId === 'allergy') {
      nextScId = 'admin';
      nextTitle = '04 Hành chính ULIS';
    } else {
      nextScId = null;
    }

    if (!nextScId) {
      // Completed Case 4 (admin)!
      setTransitionCountdown(
        language === 'vi'
          ? '🎉 Đã hoàn tất phiên giao tiếp cả 4 ca!'
          : '🎉 All 4 scenarios completed!'
      );
      setTimeout(() => setTransitionCountdown(null), 3500);
      return;
    }

    setTransitionCountdown(
      language === 'vi'
        ? `✓ Đã phát âm xong! Tự chuyển sang [${nextTitle}] sau 2s...`
        : `✓ Completed! Switching to next case in 2s...`
    );

    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
    }

    autoNextTimerRef.current = window.setTimeout(() => {
      setTransitionCountdown(null);
      if (nextScId) {
        setScenarioId(nextScId);
      }
    }, 2000);
  }, [scenarioId, language]);

  // Zero-Retention Reset
  const handleZeroRetentionReset = useCallback(() => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    setTransitionCountdown(null);
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
        setAutoNextCaseEnabled((prev) => !prev);
      } else if (e.key === '1') {
        setScenarioId('medical');
      } else if (e.key === '2') {
        setScenarioId('cardio');
      } else if (e.key === '3') {
        setScenarioId('allergy');
      } else if (e.key === '4') {
        setScenarioId('admin');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handleZeroRetentionReset, handleFinalizeLike, sessionState]);

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

        {/* Actions: Auto-Next Toggle & Minimalist Hamburger Menu (Dấu 3 gạch) */}
        <div className="strip-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút Tự chuyển ca khi xong (BẬT / TẮT) */}
          <button
            type="button"
            className={`btn-hardware ${autoNextCaseEnabled ? 'btn-guide' : ''}`}
            onClick={() => setAutoNextCaseEnabled((prev) => !prev)}
            title="Tự động chuyển sang ca tiếp theo sau khi bạn làm xong và loa đọc xong 2s (Phím G)"
            aria-label="Tự chuyển ca"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '34px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Sparkles size={14} className={autoNextCaseEnabled ? 'text-orange-500' : ''} />
            <span>
              {language === 'vi'
                ? (autoNextCaseEnabled ? 'Tự chuyển ca: BẬT' : 'Tự chuyển ca: TẮT')
                : (autoNextCaseEnabled ? 'Auto-Next: ON' : 'Auto-Next: OFF')}
            </span>
            <span className="key-tag">G</span>
          </button>

          {/* Dấu 3 Gạch (Hamburger Menu Button) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`btn-hardware ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Menu mở rộng & Cài đặt hệ thống"
              aria-label="Menu"
              style={{
                minHeight: '34px',
                width: '38px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Dropdown Menu 3 Gạch */}
            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: 0,
                  width: '270px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
                  padding: '12px',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                  {language === 'vi' ? 'Tiện ích hệ thống' : 'System Utilities'}
                </div>

                {/* Kịch bản lời thoại 90s */}
                <button
                  type="button"
                  className="btn-hardware"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', minHeight: '34px', fontSize: '12px' }}
                  onClick={() => {
                    setIsVideoGuideOpen(true);
                    setIsMenuOpen(false);
                  }}
                >
                  <Video size={14} className="text-orange-500" />
                  <span>{language === 'vi' ? 'Kịch bản lời thoại 90s' : '90s Presentation Script'}</span>
                </button>

                {/* Đổi ngôn ngữ VI / EN */}
                <button
                  type="button"
                  className="btn-hardware"
                  style={{ width: '100%', justifyContent: 'space-between', minHeight: '34px', fontSize: '12px' }}
                  onClick={() => setLanguage((prev) => (prev === 'vi' ? 'en' : 'vi'))}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LanguagesIcon size={14} />
                    <span>{language === 'vi' ? 'Ngôn ngữ hiển thị' : 'Display Language'}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--signal-orange)' }}>{language.toUpperCase()}</span>
                </button>

                {/* Xóa phiên Zero-Retention */}
                <button
                  type="button"
                  className="btn-hardware btn-reset"
                  style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', minHeight: '34px', fontSize: '12px' }}
                  onClick={() => {
                    handleZeroRetentionReset();
                    setIsMenuOpen(false);
                  }}
                  title="Xóa phiên (Luật 91/2025/QH15)"
                >
                  <RotateCcw size={14} />
                  <span>{language === 'vi' ? 'Xóa phiên sạch sẽ (Phím R)' : 'Zero-Retention Reset (R)'}</span>
                </button>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', fontSize: '10px', color: '#94a3b8', lineHeight: 1.4 }}>
                  Luật 91/2025/QH15 · Zero-Retention · MediPipe Single-Hand V3
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Transition Countdown Toast (Non-intrusive) */}
      {transitionCountdown && (
        <div
          style={{
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '10px 24px',
            borderRadius: '30px',
            background: 'rgba(15, 23, 42, 0.94)',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid #10b981',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
          role="status"
        >
          <Sparkles size={16} className="text-emerald-400 animate-spin" />
          <span>{transitionCountdown}</span>
        </div>
      )}

      {/* Floating Reset Notification Toast (Non-intrusive) */}
      {resetFeedback && (
        <div
          style={{
            position: 'fixed',
            top: '64px',
            right: '24px',
            zIndex: 1000,
            padding: '8px 16px',
            borderRadius: '6px',
            background: 'var(--signal-green-dim)',
            border: '1px solid #a3e6cd',
            color: 'var(--signal-green)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
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
                  ? (language === 'vi' ? '✓ ĐÃ PHÁT ÂM THANH (5/5 CỬ CHỈ HOÀN TẤT)' : '✓ BROADCAST COMPLETE (5/5 GESTURES)')
                  : sessionState === 'ready_to_finalize'
                  ? (language === 'vi' ? '👉 BƯỚC 5/5: THẢ LIKE 👍 ĐỂ CHỐT PHÁT ÂM' : '👉 STEP 5/5: THUMBS UP 👍 TO BROADCAST')
                  : (language === 'vi' ? `TIẾN TRÌNH: ${matchedStepIds.size}/5 CỬ CHỈ` : `PROGRESS: ${matchedStepIds.size}/5 GESTURES`)}
              </span>
            </div>

            {/* Magnetic Token Snap Track (Chuẩn 5 cử chỉ: 4 từ + 1 Thả like) */}
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

              {/* Mũi tên kết nối sang cử chỉ thứ 5 */}
              <span className="assembly-token-connector">→</span>

              {/* Cử chỉ thứ 5: Thả like 👍 chốt câu */}
              <div
                className={`assembly-token ${sessionState === 'finalized' ? 'active-token tokenAssemble' : sessionState === 'ready_to_finalize' ? 'token-ready-finalize' : ''}`}
                style={{
                  opacity: sessionState === 'finalized' ? 1 : sessionState === 'ready_to_finalize' ? 1 : 0.45,
                  borderColor: sessionState === 'finalized' ? '#10b981' : sessionState === 'ready_to_finalize' ? 'var(--signal-orange)' : '#cbd5e1',
                  borderWidth: sessionState === 'ready_to_finalize' ? '2px' : '1px',
                  background: sessionState === 'ready_to_finalize' ? '#fff7ed' : sessionState === 'finalized' ? '#ecfdf5' : undefined,
                  cursor: sessionState === 'ready_to_finalize' ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (sessionState === 'ready_to_finalize') {
                    handleFinalizeLike();
                  }
                }}
                title={language === 'vi' ? 'Cử chỉ 5: Thả like 👍 để duyệt phát âm ra loa' : 'Gesture 5: Thumbs up 👍 to broadcast'}
              >
                <span className="token-index" style={{ color: sessionState === 'ready_to_finalize' ? 'var(--signal-orange)' : undefined }}>05</span>
                <span className="token-gloss" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{language === 'vi' ? 'Thả like' : 'Confirm'}</span>
                  <span>👍</span>
                </span>
                {sessionState === 'finalized' && <CheckCircle2 size={12} className="text-emerald-500" />}
              </div>
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
