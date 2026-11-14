import React from 'react';

interface HandPoseGuideProps {
  gloss: string;
  hasHandInView: boolean;
  matchScore: number;
  isMatched: boolean;
  language: 'vi' | 'en';
}

export const HandPoseGuide: React.FC<HandPoseGuideProps> = ({
  gloss,
  hasHandInView,
  matchScore,
  isMatched,
  language,
}) => {
  // SVG Vector illustrations for each canonical sign gesture
  const renderPoseVector = () => {
    switch (gloss) {
      case 'Tôi':
        // Index pointing finger (☝️)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Chỉ ngón trỏ">
            {/* Wrist & Palm Base */}
            <path d="M42 90 L42 60 C42 55 46 50 52 50 C58 50 62 55 62 60 L62 90 Z" fill="#334155" opacity="0.4" />
            {/* Curled Middle, Ring, Pinky */}
            <rect x="52" y="44" width="8" height="18" rx="4" fill="#64748b" />
            <rect x="62" y="46" width="7" height="16" rx="3.5" fill="#64748b" />
            <rect x="71" y="50" width="6" height="13" rx="3" fill="#64748b" />
            {/* Curled Thumb */}
            <path d="M38 58 C35 52 38 46 44 48 C48 50 48 56 46 62 Z" fill="#64748b" />
            {/* Extended Index Finger (Highlighted with Braun Orange) */}
            <rect x="42" y="14" width="9" height="42" rx="4.5" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="46.5" cy="18.5" r="3" fill="#ffffff" />
            {/* Motion arrow pointing backward to chest */}
            <path d="M46.5 6 L46.5 0 M43 3 L46.5 0 L50 3" stroke="#ff5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'Đau':
        // Clenched Fist (✊)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Nắm chặt bàn tay">
            {/* Wrist */}
            <rect x="42" y="70" width="16" height="24" rx="3" fill="#334155" opacity="0.4" />
            {/* Main Fist Body */}
            <rect x="30" y="32" width="40" height="40" rx="10" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            {/* Finger Fold Lines */}
            <line x1="30" y1="44" x2="70" y2="44" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
            <line x1="40" y1="32" x2="40" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            <line x1="50" y1="32" x2="50" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            <line x1="60" y1="32" x2="60" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
            {/* Thumb wrapped over fingers */}
            <path d="M26 48 C24 38 34 36 44 38 L44 54 C34 54 28 56 26 48 Z" fill="#e04a00" stroke="#ffffff" strokeWidth="1.5" />
            {/* Vibration/Tremor lines */}
            <path d="M20 40 Q22 45 20 50 M80 40 Q78 45 80 50" stroke="#ff5500" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        );

      case 'Bụng':
        // Open Palm (🖐️)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Xòe 5 ngón tay">
            {/* Wrist */}
            <rect x="43" y="72" width="14" height="22" rx="3" fill="#334155" opacity="0.4" />
            {/* Palm base */}
            <rect x="34" y="44" width="32" height="30" rx="8" fill="var(--signal-orange, #ff5500)" opacity="0.9" />
            {/* 5 Extended Fingers */}
            {/* Thumb */}
            <rect x="20" y="46" width="8" height="24" rx="4" transform="rotate(-32 24 58)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            {/* Index */}
            <rect x="33" y="18" width="7" height="30" rx="3.5" transform="rotate(-10 36 33)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            {/* Middle */}
            <rect x="46.5" y="14" width="7" height="34" rx="3.5" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            {/* Ring */}
            <rect x="60" y="18" width="7" height="30" rx="3.5" transform="rotate(10 63 33)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            {/* Pinky */}
            <rect x="73" y="26" width="6" height="24" rx="3" transform="rotate(22 76 38)" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'Hôm qua':
        // Thumb pointing back over shoulder (👍/👈)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Ngón cái giơ chỉ sau vai">
            {/* Wrist */}
            <rect x="42" y="70" width="16" height="24" rx="3" fill="#334155" opacity="0.4" />
            {/* Curled Fingers body */}
            <rect x="36" y="38" width="34" height="34" rx="8" fill="#64748b" />
            <line x1="48" y1="38" x2="48" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
            <line x1="58" y1="38" x2="58" y2="72" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
            {/* Extended Thumb pointing back/left */}
            <path d="M38 52 C26 50 14 42 16 32 C18 22 28 26 38 40 Z" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="20" cy="30" r="3" fill="#ffffff" />
            {/* Backward arrow indicator */}
            <path d="M12 28 L4 28 M8 24 L4 28 L8 32" stroke="#ff5500" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      case 'Cần':
      case 'Giúp':
        // Upward Open Cup Palm (🤲)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Bàn tay ngửa mở">
            <rect x="43" y="72" width="14" height="22" rx="3" fill="#334155" opacity="0.4" />
            <path d="M28 45 C28 35 72 35 72 45 L68 70 C68 74 32 74 32 70 Z" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <path d="M34 25 L38 45 M46 20 L48 45 M58 20 L56 45 M68 25 L64 45" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'Khai báo':
        // Pinching Index and Thumb (✍️)
        return (
          <svg viewBox="0 0 100 100" className="pose-svg" aria-label="Hình mẫu: Chụm ngón cái và ngón trỏ như cầm bút">
            <rect x="44" y="72" width="14" height="22" rx="3" fill="#334155" opacity="0.4" />
            <rect x="36" y="50" width="30" height="24" rx="6" fill="#64748b" />
            {/* Pinch tips touching */}
            <path d="M30 52 C26 40 38 28 48 34 L48 42 C42 38 34 44 36 52 Z" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <path d="M60 52 C64 40 52 28 48 34 L48 42 C52 38 58 44 56 52 Z" fill="var(--signal-orange, #ff5500)" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="48" cy="34" r="3.5" fill="#ffffff" />
            <line x1="48" y1="34" x2="48" y2="20" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="2 2" />
          </svg>
        );

      default:
        // Generic open hand
        return (
          <svg viewBox="0 0 100 100" className="pose-svg">
            <rect x="42" y="40" width="16" height="30" rx="6" fill="var(--signal-orange, #ff5500)" />
          </svg>
        );
    }
  };

  const getPoseShortInstruction = () => {
    switch (gloss) {
      case 'Tôi':
        return language === 'vi' ? 'Chỉ ngón trỏ vào ngực' : 'Point index to chest';
      case 'Đau':
        return language === 'vi' ? 'Nắm chặt bàn tay lại' : 'Clench fist tightly';
      case 'Bụng':
        return language === 'vi' ? 'Xòe 5 ngón tay áp vào bụng' : 'Open palm to belly';
      case 'Hôm qua':
        return language === 'vi' ? 'Giơ ngón cái chỉ qua vai' : 'Point thumb back over shoulder';
      case 'Cần':
      case 'Giúp':
        return language === 'vi' ? 'Mở ngửa lòng bàn tay lên' : 'Open cup palm upward';
      case 'Khai báo':
        return language === 'vi' ? 'Chụm ngón cái và trỏ như cầm bút' : 'Pinch thumb and index like pen';
      default:
        return language === 'vi' ? 'Tạo hình cử chỉ tay' : 'Perform sign gesture';
    }
  };

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
              {language === 'vi' ? 'MẪU CỬ CHỈ' : 'TARGET SIGN'}
            </span>
            <span className="pose-gloss-name">{gloss}</span>
          </div>

          <div className="pose-instruction-text">
            👉 {getPoseShortInstruction()}
          </div>

          {!hasHandInView && (
            <div className="pose-call-to-action">
              {language === 'vi' ? 'Giơ bàn tay lên trước camera để bắt đầu' : 'Raise your hand to webcam to start'}
            </div>
          )}

          {hasHandInView && (
            <div className="pose-match-status">
              <div
                className="match-meter-bar"
                style={{
                  width: `${Math.min(100, Math.max(0, matchScore))}%`,
                  background: isMatched ? '#10b981' : '#ff5500',
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
