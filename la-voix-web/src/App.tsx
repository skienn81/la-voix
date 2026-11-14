import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Stethoscope,
  GraduationCap,
  ShieldCheck,
  RotateCcw,
  Video,
  Languages as LanguagesIcon,
  Activity,
  Zap,
  Thermometer,
  FileText,
  Building2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

import { Language, TouchCard, GestureStep } from './types';
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
  const [scenarioId, setScenarioId] = useState<'medical' | 'admin'>('medical');
  const [language, setLanguage] = useState<Language>('vi');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());
  const [selectedTouchCards, setSelectedTouchCards] = useState<TouchCard[]>([]);
  const [matchedStepIds, setMatchedStepIds] = useState<Set<string>>(new Set());
  const [isVideoGuideOpen, setIsVideoGuideOpen] = useState<boolean>(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('recording');
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const activeScenario = scenarios[scenarioId];
  const activeReverseCards = scenarioReverseCards[scenarioId];

  // Reset or initialize session state on scenario change
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

  // Handle Session Start Wake
  const handleSessionStart = useCallback(() => {
    setSessionState('recording');
    setCurrentStepIndex(0);
  }, []);

  // Handle Final Thumbs Up -> Speak Aloud!
  const handleFinalizeLike = useCallback(() => {
    // Automatically trigger speech broadcast via phím C
    const event = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    window.dispatchEvent(event);
  }, []);

  // Zero-Retention Reset
  const handleZeroRetentionReset = useCallback(() => {
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
        ? 'Zero-Retention: Bộ nhớ phiên đã được giải phóng hoàn toàn theo Luật 91/2025/QH15!'
        : 'Zero-Retention: Memory purged compliant with Law 91/2025/QH15!'
    );
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = window.setTimeout(() => {
      setResetFeedback(null);
      resetTimeoutRef.current = null;
    }, 3000);
  }, [language]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (sessionState === 'ready_to_finalize') {
          handleFinalizeLike();
        } else {
          handleNextStep();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleZeroRetentionReset();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setIsVideoGuideOpen((prev) => !prev);
      } else if (e.key === '1') {
        setScenarioId('medical');
      } else if (e.key === '2') {
        setScenarioId('admin');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handleZeroRetentionReset, handleFinalizeLike, sessionState]);

  return (
    <div className="la-voix-chassis">
      {/* 1. TOP INSTRUMENT STRIP */}
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

        {/* Mode Rocker Switch */}
        <nav className="mode-rocker-track" aria-label="Mode Selection">
          <button
            type="button"
            className={`mode-rocker-btn med ${scenarioId === 'medical' ? 'active' : ''}`}
            onClick={() => setScenarioId('medical')}
            aria-label="Select Medical Emergency Scenario"
          >
            <span className="mode-led" aria-hidden="true" />
            <Stethoscope size={14} aria-hidden="true" />
            <span>{language === 'vi' ? '01 Cấp cứu Y tế' : '01 Medical ER'}</span>
            <span className="key-tag">1</span>
          </button>

          <button
            type="button"
            className={`mode-rocker-btn adm ${scenarioId === 'admin' ? 'active' : ''}`}
            onClick={() => setScenarioId('admin')}
            aria-label="Select ULIS Student Admin Scenario"
          >
            <span className="mode-led" aria-hidden="true" />
            <GraduationCap size={14} aria-hidden="true" />
            <span>{language === 'vi' ? '02 Hành chính ULIS' : '02 ULIS Admin'}</span>
            <span className="key-tag">2</span>
          </button>
        </nav>

        {/* Hardware Action Buttons */}
        <div className="strip-actions">
          <button
            type="button"
            className="btn-hardware"
            onClick={() => setLanguage((prev) => (prev === 'vi' ? 'en' : 'vi'))}
            title="Toggle Language (VI / EN)"
            aria-label="Toggle language"
          >
            <LanguagesIcon size={14} aria-hidden="true" />
            <span>{language.toUpperCase()}</span>
          </button>

          <button
            type="button"
            className="btn-hardware btn-guide"
            onClick={() => setIsVideoGuideOpen(true)}
            aria-label="Open 90-second video demo script"
          >
            <Video size={14} aria-hidden="true" />
            <span>{language === 'vi' ? 'Kịch bản 90s' : '90s Script'}</span>
            <span className="key-tag">G</span>
          </button>

          <button
            type="button"
            className="btn-hardware btn-reset"
            onClick={handleZeroRetentionReset}
            title="Reset session (Law 91/2025/QH15)"
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
        {/* LEFT CONSOLE: WEBCAM TRACKER & CLEAN SENTENCE STRIP */}
        <div className="left-console">
          {/* SENSOR CAMERA / VIEWFINDER */}
          <CameraTracker
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            sessionState={sessionState}
            onSessionStart={handleSessionStart}
            onFinalizeLike={handleFinalizeLike}
            language={language}
            onAutoAdvance={handleAutoAdvance}
            onTokenMatched={handleTokenMatched}
          />

          {/* DẢI GHÉP CÂU TỰ ĐỘNG (CLEAN SENTENCE ASSEMBLY STRIP) */}
          <div className="sentence-assembly-chassis" style={{ marginTop: '10px' }}>
            <div className="assembly-strip-header">
              <div className="assembly-strip-title">
                <Sparkles size={14} className={allTokensAssembled ? 'text-emerald-500' : 'text-cyan-500'} />
                <span>{language === 'vi' ? 'Dải Ghép Ký Hiệu Thời Gian Thực' : 'Real-time Token Snap Strip'}</span>
              </div>
              <span className="assembly-strip-counter">
                {allTokensAssembled
                  ? (language === 'vi' ? '✓ ĐỦ 4/4 TỪ · THẢ LIKE 👍 ĐỂ CHỐT' : '✓ 4/4 TOKENS · THUMBS UP TO FINALIZE')
                  : (language === 'vi' ? `ĐÃ BẮT: ${matchedStepIds.size}/4 TỪ` : `TRACKED: ${matchedStepIds.size}/4`)}
              </span>
            </div>

            {/* Magnetic Token Snap Track */}
            <div className={`assembly-track ${matchedStepIds.size > 0 ? 'has-tokens' : ''}`}>
              {activeScenario.steps.map((step, idx) => {
                const isMatched = matchedStepIds.has(step.id);
                const isCurrent = idx === currentStepIndex;
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
              {language === 'vi' ? 'Bổ trợ Triệu chứng Lâm sàng (Chạm nhanh)' : 'Clinical Modifier Matrix'}
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
          <span>SHORTCUTS: [SPACE] BƯỚC · [C] DUYỆT PHÁT ÂM · [R] XÓA PHIÊN · [G] KỊCH BẢN</span>
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
