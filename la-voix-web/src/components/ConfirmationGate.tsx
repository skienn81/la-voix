import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, ShieldCheck, AlertCircle } from 'lucide-react';
import { Scenario, GestureStep, TouchCard, Language } from '../types';

interface ConfirmationGateProps {
  scenario: Scenario;
  activeSteps: GestureStep[];
  selectedTouchCards: TouchCard[];
  language: Language;
  onConfirmSpeech?: (spokenText: string) => void;
}

export const ConfirmationGate: React.FC<ConfirmationGateProps> = ({
  scenario,
  activeSteps,
  selectedTouchCards,
  language,
  onConfirmSpeech,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  // Construct dynamic full sentence including touch card modifiers
  const getFullSentence = useCallback(
    (lang: Language): string => {
      const base = lang === 'vi' ? scenario.baseSentenceVi : scenario.baseSentenceEn;
      if (selectedTouchCards.length === 0) return base;

      if (lang === 'vi') {
        const modifiers = selectedTouchCards.map((c) => c.label).join(', ');
        return `${base} (Bổ trợ: ${modifiers})`;
      } else {
        const modifiers = selectedTouchCards.map((c) => c.labelEn).join(', ');
        return `${base} (Notes: ${modifiers})`;
      }
    },
    [scenario, selectedTouchCards]
  );

  const sentenceVi = getFullSentence('vi');
  const sentenceEn = getFullSentence('en');

  // Handle Speech Synthesis
  const handleSpeak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert(
        language === 'vi'
          ? 'Trình duyệt chưa hỗ trợ Web Speech Synthesis.'
          : 'Browser does not support Web Speech Synthesis.'
      );
      return;
    }

    window.speechSynthesis.cancel();

    const textToSpeak = language === 'vi' ? sentenceVi : sentenceEn;
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
  }, [language, sentenceVi, sentenceEn, availableVoices, onConfirmSpeech]);

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

  // Stop speaking
  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="teleprompter-card">
      <div className="teleprompter-header">
        <div className="teleprompter-badge">
          <AlertCircle size={13} aria-hidden="true" />
          <span>{language === 'vi' ? 'Cổng Xác nhận An toàn (Safety Gate)' : 'One-Touch Safety Gate'}</span>
        </div>
        <span className="safety-notice">
          {language === 'vi' ? 'Bệnh nhân duyệt câu trước khi phát âm' : 'Pre-broadcast safety verification'}
        </span>
      </div>

      {/* Synthesized Text Preview */}
      <div className="synthesized-text-box">
        <div className="synthesized-sentence-vi">{sentenceVi}</div>
        <div className="synthesized-sentence-en">{sentenceEn}</div>
      </div>

      {/* Hardware Actuator Button */}
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
            {language === 'vi' ? 'Đang phát âm thanh · Dừng lại' : 'Broadcasting · Stop'}
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
          className="broadcast-actuator-btn"
          onClick={handleSpeak}
          aria-label="Confirm sentence and broadcast audio"
        >
          <Volume2 size={20} aria-hidden="true" />
          <span className="broadcast-main-text">
            {language === 'vi' ? 'Xác nhận & Phát âm thanh' : 'Confirm & Broadcast Voice'}
          </span>
          <span className="broadcast-key-hint">Phím C</span>
        </button>
      )}
    </div>
  );
};

export default ConfirmationGate;
