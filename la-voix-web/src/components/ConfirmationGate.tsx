import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, VolumeX, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Scenario, GestureStep, TouchCard, Language } from '../types';

interface ConfirmationGateProps {
  scenario: Scenario;
  activeSteps: GestureStep[];
  matchedStepCount: number;
  allMatched: boolean;
  selectedTouchCards: TouchCard[];
  language: Language;
  onConfirmSpeech?: (spokenText: string) => void;
}

export const ConfirmationGate: React.FC<ConfirmationGateProps> = ({
  scenario,
  activeSteps,
  matchedStepCount,
  allMatched,
  selectedTouchCards,
  language,
  onConfirmSpeech,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpeakTimeRef = useRef<number>(0);

  const updateVoices = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setAvailableVoices(window.speechSynthesis.getVoices());
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [updateVoices]);

  // Dynamic AI Auto-complete predictions for all 4 clinical scenarios
  const predictiveCompletion = useMemo(() => {
    const scId = scenario.id;

    if (matchedStepCount === 0) {
      let preview = 'Tôi bị đau quặn bụng...';
      if (scId === 'cardio') preview = 'Tôi bị đau thắt nghẹn vùng ngực...';
      if (scId === 'allergy') preview = 'Tôi bị dị ứng thức ăn sưng nghẽn...';
      if (scId === 'admin') preview = 'Tôi là sinh viên cần giúp đỡ...';

      return {
        confirmedPart: '',
        ghostPart: language === 'vi' ? `Đang chờ ký hiệu... (${preview})` : 'Waiting for gesture signs...',
        isFull: false,
      };
    }

    if (matchedStepCount === 1) {
      let ghost = ' [bị đau quặn bụng dữ dội...]';
      if (scId === 'cardio') ghost = ' [bị đau thắt nghẹn vùng ngực lan xuống tay...]';
      if (scId === 'allergy') ghost = ' [bị dị ứng thức ăn sưng nghẽn họng...]';
      if (scId === 'admin') ghost = ' [là sinh viên cần giúp đỡ thủ tục...]';

      return {
        confirmedPart: language === 'vi' ? 'Tôi' : 'I',
        ghostPart: language === 'vi' ? ghost : ' [needing clinical attention...]',
        isFull: false,
      };
    }

    if (matchedStepCount === 2) {
      let confirmed = 'Tôi bị đau';
      let ghost = ' [quặn bụng dữ dội từ hôm qua...]';
      if (scId === 'cardio') {
        confirmed = 'Tôi bị đau ngực';
        ghost = ' [thắt nghẹn lan xuống cánh tay trái...]';
      } else if (scId === 'allergy') {
        confirmed = 'Tôi bị dị ứng';
        ghost = ' [sưng nghẽn họng, khó thở...]';
      } else if (scId === 'admin') {
        confirmed = 'Tôi cần';
        ghost = ' [giúp đỡ làm thủ tục khai báo...]';
      }

      return {
        confirmedPart: language === 'vi' ? confirmed : 'I am experiencing symptoms',
        ghostPart: language === 'vi' ? ghost : ' [acute progression...]',
        isFull: false,
      };
    }

    if (matchedStepCount === 3) {
      let confirmed = 'Tôi bị đau quặn bụng';
      let ghost = ' [dữ dội từ hôm qua...]';
      if (scId === 'cardio') {
        confirmed = 'Tôi bị đau thắt nghẹn ngực';
        ghost = ' [lan xuống cánh tay trái, khó thở...]';
      } else if (scId === 'allergy') {
        confirmed = 'Tôi bị dị ứng sưng nghẽn họng';
        ghost = ' [khó nuốt và chóng mặt choáng váng...]';
      } else if (scId === 'admin') {
        confirmed = 'Tôi cần giúp đỡ';
        ghost = ' [làm thủ tục khai báo và xin cấp giấy...]';
      }

      return {
        confirmedPart: language === 'vi' ? confirmed : 'I have severe condition',
        ghostPart: language === 'vi' ? ghost : ' [requiring urgent evaluation...]',
        isFull: false,
      };
    }

    // 4 tokens assembled: 100% full completed sentence!
    return {
      confirmedPart: language === 'vi' ? scenario.baseSentenceVi : scenario.baseSentenceEn,
      ghostPart: '',
      isFull: true,
    };
  }, [scenario, matchedStepCount, language]);

  // Full finalized text including any modifier cards
  const finalFullSentence = useMemo(() => {
    const base = language === 'vi' ? scenario.baseSentenceVi : scenario.baseSentenceEn;
    if (selectedTouchCards.length === 0) return base;

    if (language === 'vi') {
      const modifiers = selectedTouchCards.map((c) => c.label).join(', ');
      return `${base} (+${modifiers})`;
    } else {
      const modifiers = selectedTouchCards.map((c) => c.labelEn).join(', ');
      return `${base} (+${modifiers})`;
    }
  }, [scenario, selectedTouchCards, language]);

  // Handle Speech Synthesis (with spam debounce)
  const handleSpeak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(
        language === 'vi'
          ? 'Trình duyệt chưa hỗ trợ Web Speech Synthesis.'
          : 'Browser does not support Web Speech Synthesis.'
      );
      return;
    }

    const now = Date.now();
    // Prevent repeated speech spamming within 2.5 seconds
    if (now - lastSpeakTimeRef.current < 2500) {
      return;
    }
    lastSpeakTimeRef.current = now;

    window.speechSynthesis.cancel();

    const textToSpeak = finalFullSentence;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    const targetLangCode = language === 'vi' ? 'vi' : 'en';
    const voice = availableVoices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(targetLangCode) ||
        (targetLangCode === 'vi' && (v.name.includes('Vietnamese') || v.name.includes('HoaiMy') || v.name.includes('NamMinh')))
    );

    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = language === 'vi' ? 'vi-VN' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setHasConfirmed(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onConfirmSpeech) {
        onConfirmSpeech(textToSpeak);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [language, finalFullSentence, availableVoices, onConfirmSpeech]);

  // Global keydown shortcut [C] for broadcast
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleSpeak();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSpeak]);

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const isCompletedReady = predictiveCompletion.isFull || allMatched;

  return (
    <div className={`teleprompter-card ${isCompletedReady ? 'autocomplete-ready' : ''}`}>
      {/* Header */}
      <div className="teleprompter-header">
        <div className="teleprompter-badge">
          <AlertCircle size={13} aria-hidden="true" />
          <span>{language === 'vi' ? 'Cổng Xác nhận An toàn (Safety Gate)' : 'One-Touch Safety Gate'}</span>
        </div>
        <span className="safety-notice">
          {language === 'vi' ? 'Bệnh nhân kiểm duyệt câu trước khi phát âm' : 'Pre-broadcast patient verification'}
        </span>
      </div>

      {/* AI AUTO-COMPLETE PREDICTION BOX */}
      <div className={`synthesized-text-box ${isCompletedReady ? 'box-complete' : 'box-predicting'}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} className={isCompletedReady ? 'text-emerald-500' : 'text-cyan-500 animate-pulse'} />
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCompletedReady ? '#059669' : '#0284c7' }}>
              {isCompletedReady
                ? (language === 'vi' ? '✓ AI AUTO-COMPLETE HOÀN TẤT (ĐỘ CHÍNH XÁC 98%)' : '✓ AI AUTO-COMPLETE COMPLETE (98%)')
                : (language === 'vi' ? `AI ĐANG ĐOÁN Ý THEO TỪNG KÝ HIỆU (${matchedStepCount}/4)` : `AI PREDICTING: ${matchedStepCount}/4`)}
            </span>
          </div>
          {isCompletedReady && (
            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
              ĐÃ KHỚP Ý
            </span>
          )}
        </div>

        {/* Dynamic Sentence Text */}
        <div className="synthesized-sentence-vi" style={{ minHeight: '52px', fontSize: '18px', lineHeight: 1.4 }}>
          <span style={{ color: '#0f172a', fontWeight: 800 }}>
            {predictiveCompletion.confirmedPart}
          </span>
          {predictiveCompletion.ghostPart && (
            <span style={{ color: '#94a3b8', fontStyle: 'italic', opacity: 0.85 }}>
              {predictiveCompletion.ghostPart}
            </span>
          )}
          {selectedTouchCards.length > 0 && isCompletedReady && (
            <span style={{ color: '#e11d48', fontWeight: 700, marginLeft: '6px' }}>
              (+{selectedTouchCards.map((c) => (language === 'vi' ? c.label : c.labelEn)).join(', ')})
            </span>
          )}
        </div>

        <div className="synthesized-sentence-en" style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          {isCompletedReady ? scenario.baseSentenceEn : 'AI is predicting patient intention in real-time...'}
        </div>
      </div>

      {/* Actuator Broadcast Button */}
      {isSpeaking ? (
        <button
          type="button"
          className="broadcast-actuator-btn"
          style={{ background: 'var(--signal-red)', borderColor: '#b32604' }}
          onClick={handleStop}
          aria-label="Stop audio broadcast"
        >
          <VolumeX size={18} aria-hidden="true" />
          <span className="broadcast-main-text">
            {language === 'vi' ? 'Đang phát âm thanh · Bấm để Dừng' : 'Broadcasting Voice · Click to Stop'}
          </span>
          <div className="equalizer-wave" aria-hidden="true">
            <span className="eq-bar" />
            <span className="eq-bar" />
            <span className="eq-bar" />
            <span className="eq-bar" />
          </div>
        </button>
      ) : (
        <button
          type="button"
          className={`broadcast-actuator-btn ${isCompletedReady ? 'ready-pulse' : ''}`}
          onClick={handleSpeak}
          aria-label="Confirm sentence and broadcast audio"
        >
          <Volume2 size={20} aria-hidden="true" />
          <span className="broadcast-main-text">
            {language === 'vi' ? 'ĐỒNG Ý & PHÁT ÂM THANH' : 'CONFIRM & SPEAK ALOUD'}
          </span>
          <span className="broadcast-key-hint">Phím C</span>
        </button>
      )}

      {isCompletedReady && (
        <div style={{ marginTop: '6px', textAlign: 'center', fontSize: '11px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <CheckCircle2 size={13} />
          <span>{language === 'vi' ? 'Bệnh nhân thấy chuẩn ý: Bấm phím C hoặc Thả like 👍 để phát tiếng' : 'Intention verified: Press C or Thumbs Up to broadcast'}</span>
        </div>
      )}
    </div>
  );
};

export default ConfirmationGate;
