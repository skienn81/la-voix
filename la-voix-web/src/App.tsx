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
import { CameraTracker } from './components/CameraTracker';
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
    if (activeScenario.steps.length > 0) {
      setCompletedStepIds(new Set([activeScenario.steps[0].id]));
      setMatchedStepIds(new Set([activeScenario.steps[0].id]));
    } else {
      setCompletedStepIds(new Set());
      setMatchedStepIds(new Set());
    }
    setSelectedTouchCards([]);
  }, [scenarioId, activeScenario]);

  const currentStep = activeScenario.steps[currentStepIndex] || activeScenario.steps[0];

  const activeCompletedSteps = useMemo(() => {
    return activeScenario.steps.slice(0, currentStepIndex + 1);
  }, [activeScenario, currentStepIndex]);

  // Progressive Assembled Sentence based on matched tokens
  const assembledSentenceText = useMemo(() => {
    const totalSteps = activeScenario.steps.length;
    const count = activeScenario.steps.filter((s) => matchedStepIds.has(s.id)).length;

    if (count >= totalSteps) {
      return language === 'vi' ? activeScenario.baseSentenceVi : activeScenario.baseSentenceEn;
    }

    if (scenarioId === 'medical') {
      if (language === 'vi') {
        if (count === 1) return 'Tôi...';
        if (count === 2) return 'Tôi bị đau...';
        if (count === 3) return 'Tôi bị đau quặn bụng...';
        return 'Tôi bị đau quặn bụng dữ dội từ hôm qua...';
      } else {
        if (count === 1) return 'I...';
        if (count === 2) return 'I have pain...';
        if (count === 3) return 'I have abdominal pain...';
        return 'I have had cramping abdominal pain since yesterday...';
      }
    } else {
      if (language === 'vi') {
        if (count === 1) return 'Tôi là sinh viên...';
        if (count === 2) return 'Tôi là sinh viên cần...';
        if (count === 3) return 'Tôi là sinh viên cần giúp đỡ...';
        return 'Tôi là sinh viên, cần giúp đỡ làm thủ tục khai báo và xin giấy xác nhận...';
      } else {
        if (count === 1) return 'I am a student...';
        if (count === 2) return 'I am a student needing...';
        if (count === 3) return 'I am a student needing assistance...';
        return 'I am a student needing assistance with declaration procedures...';
      }
    }
  }, [scenarioId, language, activeScenario, matchedStepIds]);

  const allTokensAssembled = useMemo(() => {
    return activeScenario.steps.every((s) => matchedStepIds.has(s.id));
  }, [activeScenario.steps, matchedStepIds]);

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

  // Handle Token Matched from CameraTracker
  const handleTokenMatched = useCallback((step: GestureStep) => {
    setMatchedStepIds((prevSet) => new Set([...prevSet, step.id]));
    setCompletedStepIds((prevSet) => new Set([...prevSet, step.id]));
  }, []);

  // Smart Typing Tutor Auto-Advance: advances through words 1->2->3->4 and locks on final step
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

  // Law 91/2025/QH15 Compliant Zero-Retention Reset
  const handleZeroRetentionReset = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setCurrentStepIndex(0);
    if (activeScenario.steps.length > 0) {
      setCompletedStepIds(new Set([activeScenario.steps[0].id]));
      setMatchedStepIds(new Set([activeScenario.steps[0].id]));
    } else {
      setCompletedStepIds(new Set());
      setMatchedStepIds(new Set());
    }
    setSelectedTouchCards([]);

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
  }, [activeScenario.steps, language]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleNextStep();
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
  }, [handleNextStep, handleZeroRetentionReset]);

  return (
    <div className="la-voix-chassis">
      {/* 1. HARDWARE INSTRUMENT STRIP (TOP BAR) */}
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

        {/* Tactile Mode Rocker Switch */}
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

      {/* 2. TWO-PANEL WORKSPACE GRID */}
      <main className="workspace-deck" role="main">
        {/* LEFT CONSOLE: SENSOR VIEWPORT & STEP SEQUENCER */}
        <div className="left-console">
          {/* SENSOR CAMERA / VIEWFINDER */}
          <CameraTracker
            currentStep={currentStep}
            language={language}
            onAutoAdvance={handleAutoAdvance}
            onTokenMatched={handleTokenMatched}
          />

          {/* PHYSICAL STEP SEQUENCER KEYCAPS */}
          <div className="sequencer-chassis">
            <div className="sequencer-header">
              <span className="sequencer-title">
                {language === 'vi' ? 'Chuỗi Ký hiệu Thời gian thực' : 'Real-time Gesture Sequencer'}
              </span>
              <span className="sequencer-hint">
                {language === 'vi' ? 'Nhấn Space để chuyển cử chỉ' : 'Press Space to advance'}
              </span>
            </div>

            <div className="keycap-row" role="tablist">
              {activeScenario.steps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isCompleted = idx <= currentStepIndex;

                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`keycap-btn ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => {
                      setCurrentStepIndex(idx);
                      setCompletedStepIds((prev) => new Set([...prev, step.id]));
                      setMatchedStepIds((prev) => new Set([...prev, step.id]));
                    }}
                  >
                    <div className="keycap-top-row">
                      <span className="keycap-num">0{idx + 1}</span>
                      <span className="keycap-led" aria-hidden="true" />
                    </div>
                    <div className="keycap-gloss">
                      {language === 'vi' ? step.gloss : step.glossEn}
                    </div>
                    <div className="keycap-sub">
                      {Math.round(step.confidence * 100)}% match
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SENTENCE ASSEMBLY STRIP (DẢI GHÉP CÂU TỰ ĐỘNG) */}
          <div className="sentence-assembly-chassis">
            <div className="assembly-strip-header">
              <div className="assembly-strip-title">
                <Sparkles size={14} className={allTokensAssembled ? 'text-emerald-500' : 'text-cyan-500'} />
                <span>{language === 'vi' ? 'Dải Ghép Câu Tự Động' : 'Sentence Assembly Strip'}</span>
              </div>
              <span className="assembly-strip-counter">
                {allTokensAssembled
                  ? (language === 'vi' ? '✓ CÂU HOÀN CHỈNH (4/4)' : '✓ COMPLETE (4/4)')
                  : (language === 'vi' ? `ĐANG GHÉP: ${matchedStepIds.size}/4 TỪ` : `ASSEMBLING: ${matchedStepIds.size}/4`)}
              </span>
            </div>

            {/* Magnetic Token Snap Track */}
            <div className={`assembly-track ${matchedStepIds.size > 0 ? 'has-tokens' : ''}`}>
              {activeScenario.steps.map((step, idx) => {
                const isMatched = matchedStepIds.has(step.id);
                return (
                  <React.Fragment key={step.id}>
                    {idx > 0 && <span className="assembly-token-connector">→</span>}
                    <div
                      className={`assembly-token ${isMatched ? 'active-token tokenAssemble' : ''}`}
                      style={{
                        opacity: isMatched ? 1 : 0.45,
                        borderStyle: isMatched ? 'solid' : 'dashed',
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

            {/* Assembled Sentence Preview Card */}
            <div className="assembled-sentence-card">
              <div className="assembled-sentence-vi">
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: allTokensAssembled ? '#059669' : '#0284c7', marginRight: '6px' }}>
                  {allTokensAssembled ? '[CÂU HOÀN CHỈNH]:' : '[ĐANG GHÉP]:'}
                </span>
                <span>{assembledSentenceText}</span>
                {selectedTouchCards.length > 0 && (
                  <span style={{ color: '#e11d48', fontWeight: 600, marginLeft: '6px' }}>
                    (+{selectedTouchCards.map((c) => (language === 'vi' ? c.label : c.labelEn)).join(', ')})
                  </span>
                )}
              </div>
              <div className="assembled-sentence-en">
                {allTokensAssembled ? activeScenario.baseSentenceEn : 'Sentence assembling in real-time as signs match...'}
              </div>
            </div>

            {allTokensAssembled && (
              <div style={{ marginTop: '2px', fontSize: '11px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>👉</span>
                <span>{language === 'vi' ? 'Sẵn sàng phát tiếng! Nhấn phím C hoặc chạm Phát tiếng ra loa Bác sĩ' : 'Ready to broadcast! Press C or click Speak Aloud'}</span>
              </div>
            )}
          </div>

          {/* TACTILE MODIFIER KEYPAD (TOUCH CARDS) */}
          <div className="modifier-chassis">
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

        {/* RIGHT CONSOLE: TELEPROMPTER, BROADCAST & REVERSE STATION */}
        <div className="right-console">
          {/* ONE-TOUCH SAFETY CONFIRMATION TELEPROMPTER */}
          <ConfirmationGate
            scenario={activeScenario}
            activeSteps={activeCompletedSteps}
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

      {/* 3. HARDWARE STATUS STRIP (FOOTER) */}
      <footer className="hardware-footer-strip" role="contentinfo">
        <div className="footer-left">
          <div className="footer-pill">
            <span className="footer-dot" aria-hidden="true" />
            <span>EDGE INFERENCE: ONNX / MEDIAPIPE</span>
          </div>
          <div className="footer-pill">
            <span>LATENCY: 24ms</span>
          </div>
          <div className="footer-pill">
            <span>PRIVACY: LAW 91/2025 ZERO-RETENTION</span>
          </div>
        </div>
        <div className="footer-right">
          <span>SHORTCUTS: [SPACE] STEP · [C] BROADCAST · [R] RESET · [G] GUIDE</span>
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
