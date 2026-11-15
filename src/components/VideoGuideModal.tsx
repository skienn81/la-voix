import React, { useEffect, useRef, useState } from 'react';
import { Video, X, Copy, Check, Clock, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface VideoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface ScriptStep {
  time: string;
  titleVi: string;
  titleEn: string;
  speechVi: string;
  speechEn: string;
  actionVi: string;
  actionEn: string;
  keyHighlight?: boolean;
}

const SCRIPT_STEPS: ScriptStep[] = [
  {
    time: '00:00 - 00:15',
    titleVi: '1. Mở đầu: Đặt vấn đề & Nỗi đau giao tiếp sinh tử',
    titleEn: '1. Introduction: Problem & Critical Barrier',
    speechVi:
      '\"Kính thưa Ban Giám khảo, hơn 2.5 triệu người khiếm thính tại Việt Nam gặp rào cản sinh tử khi đến bệnh viện cấp cứu hoặc làm thủ tục hành chính. Họ không thể nghe bác sĩ nói và bác sĩ không hiểu ngôn ngữ ký hiệu. La Voix v2 ra đời để giải quyết bài toán giao tiếp hai chiều này!\"',
    speechEn:
      '\"Esteemed Judges, over 2.5 million deaf individuals face critical communication barriers in medical emergencies and public administration. They cannot hear healthcare providers, and doctors cannot read sign language. La Voix v2 bridges this gap with true two-way assistive technology!\"',
    actionVi: 'Mở màn hình chính La Voix v2, chỉ vào tiêu đề và huy hiệu Bệnh viện / ULIS.',
    actionEn: 'Show La Voix v2 main screen, pointing to Clinical / ULIS badge.',
  },
  {
    time: '00:15 - 00:35',
    titleVi: '2. Demo Nhận diện Cử chỉ: 21 Điểm chốt & Bộ lọc Motion Gate',
    titleEn: '2. Gesture Tracking: 21 Landmarks & Motion Gate',
    speechVi:
      '\"La Voix v2 theo dõi 21 điểm chốt bàn tay theo thời gian thực kết hợp biểu cảm phi thủ công NMM. Đặc biệt, bộ lọc Motion Gate phân tích biến thiên năng lượng khung hình để loại bỏ hoàn toàn cử động tĩnh thừa.\"',
    speechEn:
      '\"La Voix v2 tracks 21 hand landmarks in real time with non-manual markers (NMM). Crucially, the Motion Gate analyzes frame-over-frame energy variance to filter out static noise.\"',
    actionVi: 'Bấm phím Space để chuyển tuần tự 4 cử chỉ: [Tôi] -> [Đau] -> [Bụng] -> [Hôm qua]. Chỉ vào thanh Motion Gate màu xanh phát sáng và chỉ số tin cậy >94%.',
    actionEn: 'Press Space to advance 4 steps: [Tôi] -> [Đau] -> [Bụng] -> [Hôm qua]. Highlight the glowing Motion Gate bar and >94% confidence.',
    keyHighlight: true,
  },
  {
    time: '00:35 - 00:50',
    titleVi: '3. Chạm Bổ trợ Triệu chứng & Cổng An toàn Một Chạm (Safety Gate)',
    titleEn: '3. Touch Modifiers & One-Touch Safety Confirmation Gate',
    speechVi:
      '\"Trong y khoa, một từ dịch sai có thể nguy hiểm tính mạng. Vì vậy, người bệnh chạm bổ sung mức độ đau 7/10, quặn thắt và sốt 38°C. Cổng Safety Gate bắt buộc kiểm tra trực quan trước khi phát âm thanh ra loa.\"',
    speechEn:
      '\"In healthcare, one mistranslated word can endanger life. The patient taps modifiers: 7/10 pain, cramping, 38°C fever. Our One-Touch Safety Gate guarantees visual verification before speech synthesis.\"',
    actionVi: 'Chạm chọn 3 thẻ triệu chứng, sau đó nhấn phím C (hoặc nút Xác nhận & Phát tiếng). Quan sát sóng âm thanh phát ra rõ ràng.',
    actionEn: 'Click the 3 symptom cards, then press C to trigger natural speech output with animated soundwave.',
    keyHighlight: true,
  },
  {
    time: '00:50 - 01:10',
    titleVi: '4. Đột phá Hai chiều: Kênh Bác sĩ & Thẻ Ký hiệu VSL Phản hồi',
    titleEn: '4. Two-Way Breakthrough: Doctor Speech to Visual VSL Cards',
    speechVi:
      '\"Điểm sáng tạo nhất là chiều ngược lại: Bác sĩ nói vào micro, hệ thống tự động trích xuất từ khóa y khoa và hiển thị ngay các Thẻ Ký hiệu VSL trực quan: Nghỉ ngơi, Uống thuốc, Tái khám sau 3 ngày!\"',
    speechEn:
      '\"The biggest innovation is the reverse channel: The doctor speaks naturally, our NLP engine extracts clinical keywords and instantly displays visual VSL Sign Cards: Rest, Take medicine, Follow-up in 3 days!\"',
    actionVi: 'Bấm nút Mic hoặc chọn câu mẫu nhanh của Bác sĩ. Các thẻ ký hiệu [Nghỉ ngơi], [Uống thuốc], [Tái khám] lập tức viền xanh phát sáng. Bấm \"Đã hiểu ký hiệu\".',
    actionEn: 'Click Mic or select quick preset reply. Watch matching VSL cards illuminate in cyan/emerald. Click \"Understood\".',
    keyHighlight: true,
  },
  {
    time: '01:10 - 01:30',
    titleVi: '5. Tuân thủ Luật 91/2025/QH15 & Tác động Nhân văn',
    titleEn: '5. Compliance with Law 91/2025/QH15 & Impact',
    speechVi:
      '\"Dự án tuân thủ nghiêm ngặt Luật 91/2025/QH15 và Nghị định 13: Xóa trắng toàn bộ dữ liệu bộ nhớ ngay sau phiên khám bằng nút Zero-Retention. La Voix v2 - Vì một thế giới không rào cản! Cảm ơn Ban Giám khảo!\"',
    speechEn:
      '\"Fully compliant with Law 91/2025/QH15 and Decree 13: zero-retention memory wipe instantly cleans all session data. La Voix v2 - For an accessible, barrier-free future! Thank you, Judges!\"',
    actionVi: 'Nhấn nút Khẩn cấp / Reset (phím R) để kích hoạt Zero-retention reset sạch phiên. Cười và chào kết thúc video!',
    actionEn: 'Press Reset (key R) to demonstrate instant zero-retention session wipe. Wave and conclude video presentation!',
  },
];

export const VideoGuideModal: React.FC<VideoGuideModalProps> = ({ isOpen, onClose, language }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle native escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleCopyScript = () => {
    const text = SCRIPT_STEPS.map((s) => {
      const title = language === 'vi' ? s.titleVi : s.titleEn;
      const speech = language === 'vi' ? s.speechVi : s.speechEn;
      const action = language === 'vi' ? s.actionVi : s.actionEn;
      return `[${s.time}] ${title}\nLời nói: ${speech}\nThao tác: ${action}\n`;
    }).join('\n----------------------------------------\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <dialog ref={dialogRef} className="p-0 border-0 bg-transparent">
      <div className="modal-window">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Video className="text-cyan-400" size={20} aria-hidden="true" />
            <span>
              {language === 'vi'
                ? 'Kịch bản Video Thuyết trình 90s (Dành cho Kiên)'
                : '90-Second Video Presentation Script for Kiên'}
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close video guide modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tips banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles size={16} aria-hidden="true" />
            <span>
              {language === 'vi'
                ? 'Mẹo: Dùng phím Space (bước kế), C (phát tiếng), R (reset), G (bật/tắt kịch bản này).'
                : 'Tip: Use keys Space (next step), C (speak), R (reset), G (toggle guide).'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary text-xs py-1 px-2.5 h-auto"
            onClick={handleCopyScript}
            aria-label="Copy entire script to clipboard"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Sao chép kịch bản</span>
              </>
            )}
          </button>
        </div>

        {/* Script Steps List */}
        <div className="script-timeline">
          {SCRIPT_STEPS.map((step, idx) => (
            <div
              key={idx}
              className={`script-step-item ${step.keyHighlight ? 'highlight-step' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="script-time-badge flex items-center gap-1">
                  <Clock size={12} aria-hidden="true" />
                  <span>{step.time}</span>
                </span>
                {step.keyHighlight && (
                  <span className="badge badge-emerald text-[10px] font-mono">
                    ĐIỂM NHẤN ĂN ĐIỂM
                  </span>
                )}
              </div>

              <h4 className="script-step-title">
                {language === 'vi' ? step.titleVi : step.titleEn}
              </h4>

              <div className="text-xs text-slate-200 bg-slate-900/60 p-2.5 rounded border border-slate-700/50 leading-relaxed font-sans">
                <span className="text-cyan-400 font-semibold block mb-0.5">
                  {language === 'vi' ? 'Lời thoại Kiên đọc:' : 'Spoken Voiceover:'}
                </span>
                {language === 'vi' ? step.speechVi : step.speechEn}
              </div>

              <div className="text-xs text-emerald-400/90 italic pl-1 flex items-start gap-1">
                <span className="font-semibold not-italic text-slate-400">
                  {language === 'vi' ? 'Thao tác giao diện:' : 'UI Action:'}
                </span>
                <span>{language === 'vi' ? step.actionVi : step.actionEn}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Chuẩn cấu trúc 90s Hackathon ULIS 2026</span>
          </div>
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose}>
            {language === 'vi' ? 'Đóng kịch bản (Esc)' : 'Close Script (Esc)'}
          </button>
        </div>
      </div>
    </dialog>
  );
};
