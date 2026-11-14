import React from 'react';
import { getTargetPoseName } from '../utils/gestureClassifier';

interface HandPoseGuideProps {
  gloss: string;
  hasHandInView: boolean;
  matchScore: number;
  isMatched: boolean;
  detectedPoseName?: string;
  lockProgress?: number;
  sessionState?: 'idle' | 'recording' | 'ready_to_finalize';
  language: 'vi' | 'en';
}

export const HandPoseGuide: React.FC<HandPoseGuideProps> = ({
  gloss,
  hasHandInView,
  matchScore,
  isMatched,
  detectedPoseName = 'Chưa thấy bàn tay',
  lockProgress = 0,
  sessionState = 'recording',
  language,
}) => {
  // SVG Vector illustrations for canonical gestures
  const renderPoseVector = () => {
    if (sessionState === 'idle') {
      // START / WAKE (👋 Wave Hand / ✌️ Victory)
      return (
        <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Giơ tay mở chào để bắt đầu">
          <rect x="44" y="70" width="14" height="24" rx="3" fill="#334155" opacity="0.4" />
          <rect x="36" y="44" width="30" height="28" rx="7" fill="var(--signal-orange, #ff5500)" opacity="0.9" />
          {/* Wave motion lines */}
          <path d="M22 36 Q26 28 32 36 M78 36 Q74 28 68 36" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Fingers */}
          <rect x="22" y="44" width="7" height="22" rx="3.5" transform="rotate(-30 25 55)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="35" y="20" width="6.5" height="28" rx="3.2" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="47" y="16" width="6.5" height="32" rx="3.2" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="59" y="20" width="6.5" height="28" rx="3.2" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="70" y="28" width="6" height="22" rx="3" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );
    }

    if (sessionState === 'ready_to_finalize') {
      // THUMBS UP (👍 Thả like kết thúc câu)
      return (
        <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Thả like kết thúc">
          <rect x="42" y="70" width="16" height="24" rx="3" fill="#334155" opacity="0.4" />
          <rect x="34" y="38" width="36" height="34" rx="8" fill="#64748b" />
          <line x1="46" y1="38" x2="46" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
          <line x1="56" y1="38" x2="56" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
          {/* Extended Thumb pointing UP */}
          <rect x="32" y="12" width="13" height="34" rx="6.5" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="38.5" cy="18" r="3.5" fill="#ffffff" />
          {/* Upward motion glow */}
          <path d="M38.5 6 L38.5 0 M34 3 L38.5 0 L43 3" stroke="#ff5500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    switch (gloss) {
      case 'Tôi':
        // POINTING (☝️)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Chỉ ngón trỏ">
            <path d="M42 90 L42 62 C42 56 46 52 52 52 C58 52 62 56 62 62 L62 90 Z" fill="#334155" opacity="0.4" />
            <rect x="52" y="44" width="8" height="18" rx="4" fill="#64748b" />
            <rect x="62" y="46" width="7" height="16" rx="3.5" fill="#64748b" />
            <rect x="71" y="50" width="6" height="13" rx="3" fill="#64748b" />
            <path d="M38 58 C35 52 38 46 44 48 C48 50 48 56 46 62 Z" fill="#64748b" />
            <rect x="42" y="14" width="9" height="42" rx="4.5" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="46.5" cy="18.5" r="3" fill="#ffffff" />
          </svg>
        );

      case 'Đau':
      case 'Cần':
        // FIST (✊)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Nắm đấm bàn tay">
            <rect x="42" y="70" width="16" height="24" rx="3" fill="#334155" opacity="0.4" />
            <rect x="30" y="32" width="40" height="40" rx="10" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <line x1="30" y1="44" x2="70" y2="44" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
            <line x1="40" y1="32" x2="40" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            <line x1="50" y1="32" x2="50" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            <line x1="60" y1="32" x2="60" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            <path d="M26 48 C24 38 34 36 44 38 L44 54 C34 54 28 56 26 48 Z" fill="#e04a00" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'Bụng':
      case 'Giúp':
        // OPEN PALM (🖐️)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Xòe 5 ngón tay">
            <rect x="43" y="72" width="14" height="22" rx="3" fill="#334155" opacity="0.4" />
            <rect x="34" y="44" width="32" height="30" rx="8" fill="var(--signal-orange, #ff5500)" opacity="0.9" />
            <rect x="20" y="46" width="8" height="24" rx="4" transform="rotate(-32 24 58)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="33" y="18" width="7" height="30" rx="3.5" transform="rotate(-10 36 33)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="46.5" y="14" width="7" height="34" rx="3.5" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="60" y="18" width="7" height="30" rx="3.5" transform="rotate(10 63 33)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="73" y="26" width="6" height="24" rx="3" transform="rotate(22 76 38)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'Hôm qua':
      case 'Khai báo':
      default:
        // THUMB SIDE (👈 Ngón cái xòe nghiêng)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Ngón cái chỉ nghiêng qua vai">
            <rect x="42" y="70" width="16" height="24" rx="3" fill="#334155" opacity="0.4" />
            <rect x="36" y="38" width="34" height="34" rx="8" fill="#64748b" />
            <line x1="48" y1="38" x2="48" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
            <line x1="58" y1="38" x2="58" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
            {/* Extended Thumb pointing back/left */}
            <path d="M38 52 C26 50 14 42 16 32 C18 22 28 26 38 40 Z" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="20" cy="30" r="3" fill="#ffffff" />
            <path d="M12 28 L4 28 M8 24 L4 28 L8 32" stroke="#ff5500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
    }
  };

  const targetPoseTitle = getTargetPoseName(gloss, sessionState);

  return (
    <div className={`hand-pose-guide-panel ${hasHandInView ? 'compact-mode' : 'prominent-mode'}`}>
      <div className="guide-card-inner">
        {/* SVG Illustration Container */}
        <div className="pose-svg-box">
          {renderPoseVector()}
        </div>

        {/* Text instructions */}
        <div className="pose-info-box">
          <div className="pose-target-header">
            <span className="pose-type-tag">
              {sessionState === 'idle'
                ? 'BƯỚC 0'
                : sessionState === 'ready_to_finalize'
                ? 'CHỐT CÂU'
                : 'MỤC TIÊU'}
            </span>
            <span className="pose-gloss-name">
              {sessionState === 'idle' ? 'Khởi động' : sessionState === 'ready_to_finalize' ? 'Thả like' : gloss}
            </span>
          </div>

          <div className="pose-instruction-text" style={{ color: isMatched ? '#34d399' : '#fdba74' }}>
            👉 {targetPoseTitle}
          </div>

          {/* Live Detected Pose Feedback */}
          {hasHandInView && (
            <div style={{ fontSize: '10px', color: isMatched ? '#10b981' : '#94a3b8', fontWeight: 600, marginTop: '1px' }}>
              {isMatched ? '✓ ĐÃ ĐÚNG CỬ CHỈ' : `Đang thấy: ${detectedPoseName}`}
            </div>
          )}

          {!hasHandInView && (
            <div className="pose-call-to-action">
              {sessionState === 'idle'
                ? (language === 'vi' ? 'Vẫy tay mở chào để bắt đầu' : 'Wave hand to start')
                : (language === 'vi' ? 'Giơ 1 bàn tay lên trước camera' : 'Raise one hand to webcam')}
            </div>
          )}

          {/* Lock Countdown Progress Bar */}
          {hasHandInView && isMatched && (
            <div className="pose-match-status" style={{ marginTop: '4px' }}>
              <div
                className="match-meter-bar"
                style={{
                  width: `${Math.min(100, Math.round(lockProgress * 100))}%`,
                  background: '#10b981',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HandPoseGuide;
