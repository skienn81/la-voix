import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Sparkles,
  Bed,
  Pill,
  CalendarClock,
  CheckCircle2,
  FileSignature,
  HeartHandshake,
  Heart,
  Clock,
  Check,
} from 'lucide-react';
import { Scenario, ReverseSignCard, Language } from '../types';

interface ReverseFeedbackPanelProps {
  scenario: Scenario;
  reverseCards: ReverseSignCard[];
  language: Language;
  onKeywordDetected?: (keyword: string) => void;
}

const getCardIcon = (iconName: string) => {
  switch (iconName) {
    case 'Bed':
      return <Bed size={16} aria-hidden="true" />;
    case 'Pill':
      return <Pill size={16} aria-hidden="true" />;
    case 'CalendarClock':
      return <CalendarClock size={16} aria-hidden="true" />;
    case 'CheckCircle2':
      return <CheckCircle2 size={16} aria-hidden="true" />;
    case 'FileSignature':
      return <FileSignature size={16} aria-hidden="true" />;
    case 'HeartHandshake':
      return <HeartHandshake size={16} aria-hidden="true" />;
    case 'Heart':
      return <Heart size={16} aria-hidden="true" />;
    case 'Clock':
      return <Clock size={16} aria-hidden="true" />;
    default:
      return <Sparkles size={16} aria-hidden="true" />;
  }
};

export const ReverseFeedbackPanel: React.FC<ReverseFeedbackPanelProps> = ({
  scenario,
  reverseCards,
  language,
  onKeywordDetected,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [activeTranscript, setActiveTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [understoodCards, setUnderstoodCards] = useState<Record<string, boolean>>({});
  const recognitionRef = useRef<any>(null);

  // Initialize transcript with scenario default preset
  useEffect(() => {
    setActiveTranscript(language === 'vi' ? scenario.doctorPresetVi : scenario.doctorPresetEn);
    setInputText('');
    setUnderstoodCards({});
  }, [scenario, language]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Keyword extraction engine
  const matchedKeywords = useMemo(() => {
    const query = activeTranscript.toLowerCase();
    const matches = new Set<string>();

    reverseCards.forEach((card) => {
      const kw = card.keyword.toLowerCase();
      if (query.includes(kw)) {
        matches.add(card.keyword);
        return;
      }

      // Semantic aliases
      if (kw === 'nghỉ ngơi' && (query.includes('nghỉ') || query.includes('rest'))) {
        matches.add(card.keyword);
      } else if (kw === 'uống thuốc' && (query.includes('thuốc') || query.includes('medicine'))) {
        matches.add(card.keyword);
      } else if (kw === 'tái khám' && (query.includes('khám lại') || query.includes('thứ hai') || query.includes('follow-up'))) {
        matches.add(card.keyword);
      } else if (kw === 'đồng ý' && (query.includes('yên tâm') || query.includes('được') || query.includes('agree'))) {
        matches.add(card.keyword);
      } else if (kw === 'khai báo' && (query.includes('quét mã') || query.includes('qr') || query.includes('thông tin') || query.includes('declare'))) {
        matches.add(card.keyword);
      } else if (kw === 'giúp đỡ' && (query.includes('giúp') || query.includes('in giấy') || query.includes('help'))) {
        matches.add(card.keyword);
      } else if (kw === 'cảm ơn' && (query.includes('cám ơn') || query.includes('thank'))) {
        matches.add(card.keyword);
      } else if (kw === 'chờ 10 phút' && (query.includes('10 phút') || query.includes('chờ') || query.includes('wait'))) {
        matches.add(card.keyword);
      }
    });

    return matches;
  }, [activeTranscript, reverseCards]);

  useEffect(() => {
    if (onKeywordDetected && matchedKeywords.size > 0) {
      matchedKeywords.forEach((kw) => onKeywordDetected(kw));
    }
  }, [matchedKeywords, onKeywordDetected]);

  // Web Speech Recognition
  const toggleSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        language === 'vi'
          ? 'Trình duyệt chưa hỗ trợ Web Speech Recognition. Bạn có thể dùng ô nhập chữ hoặc phím trả lời nhanh bên dưới!'
          : 'Speech Recognition not supported in this browser. Please use text input or presets.'
      );
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'vi' ? 'vi-VN' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('');
        setActiveTranscript(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsRecording(false);
    }
  }, [isRecording, language]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      setActiveTranscript(inputText.trim());
      setInputText('');
    }
  };

  const toggleUnderstood = (keyword: string) => {
    setUnderstoodCards((prev) => ({
      ...prev,
      [keyword]: !prev[keyword],
    }));
  };

  return (
    <div className="reverse-station-card">
      <div className="reverse-header">
        <div className="reverse-badge">
          <MessageSquare size={13} aria-hidden="true" />
          <span>
            {language === 'vi'
              ? 'Kênh Phản hồi Bác sĩ / Cán bộ -> Thẻ Ký hiệu VSL'
              : 'Staff Audio Input -> Reverse VSL Cards'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-muted)' }}>
          {matchedKeywords.size} {language === 'vi' ? 'từ khóa bóc tách' : 'keywords extracted'}
        </span>
      </div>

      {/* Doctor Input Bar (Text + Microphone) */}
      <form onSubmit={handleTextSubmit} className="doctor-input-strip">
        <input
          type="text"
          className="doctor-text-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            language === 'vi'
              ? 'Nhập lời dặn của bác sĩ hoặc nhấn micro để nói...'
              : 'Type doctor advice or click microphone to speak...'
          }
        />

        <button
          type="button"
          className={`mic-toggle-btn ${isRecording ? 'listening' : ''}`}
          onClick={toggleSpeechRecognition}
          title={isRecording ? 'Dừng ghi âm' : 'Bật micro bác sĩ'}
          aria-label="Toggle microphone for staff response"
        >
          {isRecording ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
        </button>

        <button
          type="submit"
          className="btn-hardware"
          style={{ minHeight: '40px', background: 'var(--signal-blue-dim)', color: 'var(--signal-blue)', borderColor: '#b3d4ff' }}
        >
          <Send size={14} aria-hidden="true" />
        </button>
      </form>

      {/* Quick Presets for Demo */}
      <div className="preset-row">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-muted)' }}>
          {language === 'vi' ? 'Câu mẫu:' : 'Presets:'}
        </span>
        <button
          type="button"
          className="preset-chip"
          onClick={() => setActiveTranscript(language === 'vi' ? scenario.doctorPresetVi : scenario.doctorPresetEn)}
        >
          {language === 'vi' ? 'Lời dặn chuẩn' : 'Standard clinical advice'}
        </button>
        <button
          type="button"
          className="preset-chip"
          onClick={() =>
            setActiveTranscript(
              language === 'vi'
                ? 'Bạn nhớ uống thuốc đúng giờ và nghỉ ngơi nhé, cảm ơn bạn.'
                : 'Please take medicine on time, get rest, thank you.'
            )
          }
        >
          {language === 'vi' ? 'Dặn uống thuốc' : 'Take medicine'}
        </button>
      </div>

      {/* Transcript Display */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--card-inset)',
          borderRadius: '6px',
          border: '1px solid var(--hairline)',
          marginBottom: '12px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-secondary)',
        }}
      >
        <span style={{ color: 'var(--ink-muted)', marginRight: '6px' }}>&gt;</span>
        {activeTranscript}
      </div>

      {/* Reverse VSL Graphic Flashcards Gallery */}
      <div className="vsl-cards-deck">
        {reverseCards.map((card, idx) => {
          const isMatched = matchedKeywords.has(card.keyword);
          const isAck = !!understoodCards[card.keyword];

          return (
            <div
              key={card.keyword}
              className={`vsl-flashcard ${isMatched ? 'matched' : ''}`}
            >
              <div className="flashcard-fig-num">FIG 0{idx + 1} // VSL ACTION</div>
              <div className="flashcard-keyword">
                {language === 'vi' ? card.meaningVi : card.meaningEn}
              </div>
              <div className="flashcard-action">
                {language === 'vi' ? card.actionGuideVi : card.actionGuideEn}
              </div>

              <button
                type="button"
                className={`flashcard-ack-btn ${isAck ? 'checked' : ''}`}
                onClick={() => toggleUnderstood(card.keyword)}
              >
                {isAck ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={12} aria-hidden="true" />
                    <span>{language === 'vi' ? 'Bệnh nhân đã hiểu' : 'Understood'}</span>
                  </span>
                ) : (
                  <span>{language === 'vi' ? 'Xác nhận hiểu' : 'Acknowledge'}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReverseFeedbackPanel;
