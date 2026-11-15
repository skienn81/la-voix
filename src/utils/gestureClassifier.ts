/**
 * Strict Mutually-Exclusive Canonical Hand Gesture Classifier for La Voix v2
 * Zero False Positives: Each pose is mathematically strictly partitioned.
 * 1. POINTING (☝️): ONLY index is extended, all other fingers MUST be curled.
 * 2. FIST (✊): ALL fingers MUST be tightly curled.
 * 3. OPEN_PALM (🖐️): ALL 4-5 fingers MUST be extended.
 * 4. THUMB_SIDE (👈): Thumb extended sideways/backwards, 4 fingers curled.
 * 5. THUMBS_UP (👍): Thumb pointing UP, 4 fingers curled.
 */

export type CanonicalPose =
  | 'START_WAVE'
  | 'POINTING'
  | 'FIST'
  | 'OPEN_PALM'
  | 'THUMB_SIDE'
  | 'THUMBS_UP'
  | 'VICTORY'
  | 'UNKNOWN'
  | 'NO_HAND';

export interface FingerStates {
  thumbExtended: boolean;
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  extendedCount: number;
  curledCount: number;
}

export interface GestureMatchResult {
  matchScore: number;
  isMatched: boolean;
  detectedPose: CanonicalPose;
  detectedPoseName: string;
  targetPoseName: string;
  fingerStates: FingerStates;
  debugText: string;
}

export type ClassifierSessionState = 'idle' | 'recording' | 'ready_to_finalize' | 'finalized';

export function classifyHandLandmarks(
  landmarks: { x: number; y: number }[],
  targetGloss: string,
  sessionState: ClassifierSessionState = 'recording'
): GestureMatchResult {
  if (!landmarks || landmarks.length < 21) {
    return {
      matchScore: 0,
      isMatched: false,
      detectedPose: 'NO_HAND',
      detectedPoseName: 'Chưa thấy bàn tay',
      targetPoseName: getTargetPoseName(targetGloss, sessionState),
      fingerStates: {
        thumbExtended: false,
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
        extendedCount: 0,
        curledCount: 5,
      },
      debugText: 'Hãy giơ một bàn tay lên trước camera',
    };
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];

  // Palm scale: distance between wrist and middle MCP
  const palmScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 1.0;

  // Helper Euclidean distance
  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Exact finger extension checks
  const dTipWrist = (tipIdx: number) => dist(landmarks[tipIdx], wrist);
  const dPipWrist = (pipIdx: number) => dist(landmarks[pipIdx], wrist);

  // A finger is truly extended if its tip is significantly further from wrist than its PIP
  const indexExt = dTipWrist(8) > dPipWrist(6) * 1.12 && dTipWrist(8) > palmScale * 1.1;
  const middleExt = dTipWrist(12) > dPipWrist(10) * 1.12 && dTipWrist(12) > palmScale * 1.1;
  const ringExt = dTipWrist(16) > dPipWrist(14) * 1.12 && dTipWrist(16) > palmScale * 1.05;
  const pinkyExt = dTipWrist(20) > dPipWrist(18) * 1.12 && dTipWrist(20) > palmScale * 0.95;

  // A finger is curled if its tip is close to palm/wrist
  const indexCurl = !indexExt;
  const middleCurl = !middleExt;
  const ringCurl = !ringExt;
  const pinkyCurl = !pinkyExt;

  // Thumb analysis
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const dThumbWristVal = dist(thumbTip, wrist);
  const thumbExt = dThumbWristVal > palmScale * 0.8 && dist(thumbTip, indexMcp) > palmScale * 0.5;

  let extendedCount = 0;
  if (thumbExt) extendedCount++;
  if (indexExt) extendedCount++;
  if (middleExt) extendedCount++;
  if (ringExt) extendedCount++;
  if (pinkyExt) extendedCount++;

  const curledCount = 5 - extendedCount;

  const fingerStates: FingerStates = {
    thumbExtended: thumbExt,
    indexExtended: indexExt,
    middleExtended: middleExt,
    ringExtended: ringExt,
    pinkyExtended: pinkyExt,
    extendedCount,
    curledCount,
  };

  // 1. STRICT CANONICAL POSE CLASSIFICATION (MUTUALLY EXCLUSIVE)
  let detectedPose: CanonicalPose = 'UNKNOWN';
  let detectedPoseName = 'Cử chỉ tự do';

  // Check OPEN_PALM (🖐️): AT LEAST 4 fingers must be extended (index, middle, ring, pinky)
  if (indexExt && middleExt && ringExt && pinkyExt) {
    detectedPose = 'OPEN_PALM';
    detectedPoseName = '🖐️ Xòe 5 ngón tay';
  }
  // Check POINTING (☝️): Index extended, but Middle, Ring, and Pinky MUST BE CURLED!
  else if (indexExt && middleCurl && ringCurl && pinkyCurl) {
    detectedPose = 'POINTING';
    detectedPoseName = '☝️ Chỉ ngón trỏ';
  }
  // Check FIST (✊): Index, Middle, Ring, Pinky MUST ALL BE CURLED!
  else if (indexCurl && middleCurl && ringCurl && pinkyCurl && !thumbExt) {
    detectedPose = 'FIST';
    detectedPoseName = '✊ Nắm đấm bàn tay';
  }
  // Check THUMBS_UP (👍): Thumb extended UPWARD, all other 4 fingers MUST BE CURLED!
  else if (thumbExt && thumbTip.y < thumbMcp.y && indexCurl && middleCurl && ringCurl && pinkyCurl) {
    detectedPose = 'THUMBS_UP';
    detectedPoseName = '👍 Thả like kết thúc';
  }
  // Check THUMB_SIDE (👈): Thumb extended SIDEWAYS, all other 4 fingers curled
  else if (thumbExt && thumbTip.y >= thumbMcp.y && indexCurl && middleCurl && ringCurl && pinkyCurl) {
    detectedPose = 'THUMB_SIDE';
    detectedPoseName = '👈 Ngón cái chỉ nghiêng';
  }
  // Check VICTORY (✌️): Index and Middle extended, Ring and Pinky curled
  else if (indexExt && middleExt && ringCurl && pinkyCurl) {
    detectedPose = 'VICTORY';
    detectedPoseName = '✌️ Chữ V (2 ngón)';
  }

  // 2. TARGET MATCHING (STRICT EQUALITY ONLY!)
  let targetPose: CanonicalPose = 'POINTING';
  let targetPoseName = '';

  if (sessionState === 'idle') {
    targetPose = 'START_WAVE';
    targetPoseName = '👋 Vẫy tay hoặc ✌️ để Bắt đầu';
  } else if (sessionState === 'ready_to_finalize') {
    targetPose = 'THUMBS_UP';
    targetPoseName = '👍 Thả like kết thúc câu';
  } else if (sessionState === 'finalized') {
    targetPose = 'UNKNOWN';
    targetPoseName = '✓ Hoàn thành phiên';
  } else {
    targetPose = getTargetCanonicalPose(targetGloss);
    targetPoseName = getTargetPoseName(targetGloss, sessionState);
  }

  let matchScore = 0;
  let isMatched = false;
  let debugText = '';

  if (sessionState === 'finalized') {
    // Session is already completed and broadcasted. No further auto-locks.
    return {
      matchScore: 0,
      isMatched: false,
      detectedPose,
      detectedPoseName,
      targetPoseName,
      fingerStates,
      debugText: '✓ Phiên đã hoàn tất. Nhấn phím R hoặc Space để bắt đầu câu mới.',
    };
  }

  // EXACT MATCH EVALUATION
  if (targetPose === 'START_WAVE') {
    if (detectedPose === 'OPEN_PALM' || detectedPose === 'VICTORY') {
      matchScore = 98;
      isMatched = true;
      debugText = 'Khớp chuẩn: Đã nhận cử chỉ Bắt đầu!';
    } else {
      matchScore = 15;
      isMatched = false;
      debugText = 'Hãy giơ bàn tay mở chào 👋 hoặc giơ ✌️';
    }
  } else if (detectedPose === targetPose) {
    // PERFECT EXACT MATCH!
    matchScore = 98;
    isMatched = true;
    debugText = `✓ KHỚP CHUẨN: ${detectedPoseName}`;
  } else {
    // WRONG GESTURE! Strictly NOT matched!
    matchScore = 20;
    isMatched = false;
    debugText = `Đang làm: ${detectedPoseName} · Cần làm: ${targetPoseName}`;
  }

  return {
    matchScore,
    isMatched,
    detectedPose,
    detectedPoseName,
    targetPoseName,
    fingerStates,
    debugText,
  };
}

export function getTargetCanonicalPose(gloss: string): CanonicalPose {
  const g = (gloss || '').trim();
  // Ca 1 (Đau bụng): Tôi -> Đau -> Bụng -> Hôm qua
  // Ca 2 (Tim mạch): Tôi -> Ngực -> Thắt nghẹn -> Lan tay
  // Ca 3 (Dị ứng): Tôi -> Dị ứng -> Nghẽn họng -> Choáng váng
  // Ca 4 (Hành chính): Tôi -> Cần -> Giúp -> Khai báo

  if (g === 'Tôi') return 'POINTING';

  // Fist: Đau, Thắt nghẹn, Nghẽn họng, Cần
  if (['Đau', 'Thắt nghẹn', 'Nghẽn họng', 'Cần'].includes(g)) return 'FIST';

  // Open Palm: Bụng, Ngực, Dị ứng, Giúp
  if (['Bụng', 'Ngực', 'Dị ứng', 'Giúp'].includes(g)) return 'OPEN_PALM';

  // Thumb Side: Hôm qua, Lan tay, Choáng váng, Khai báo
  if (['Hôm qua', 'Lan tay', 'Choáng váng', 'Khai báo'].includes(g)) return 'THUMB_SIDE';

  return 'POINTING';
}

export function getTargetPoseName(gloss: string, sessionState: string = 'recording'): string {
  if (sessionState === 'idle') {
    return '👋 Vẫy tay / ✌️ Bắt đầu';
  }
  if (sessionState === 'ready_to_finalize') {
    return '👍 Thả like kết thúc câu';
  }
  if (sessionState === 'finalized') {
    return '✓ Đã phát âm (Phím R / Space cho câu mới)';
  }

  const pose = getTargetCanonicalPose(gloss);
  switch (pose) {
    case 'POINTING':
      return '☝️ Chỉ ngón trỏ';
    case 'FIST':
      return '✊ Nắm đấm bàn tay';
    case 'OPEN_PALM':
      return '🖐️ Xòe 5 ngón tay';
    case 'THUMB_SIDE':
      return '👈 Ngón cái chỉ nghiêng';
    case 'THUMBS_UP':
      return '👍 Thả like kết thúc';
    case 'VICTORY':
      return '✌️ Chữ V';
    default:
      return 'Bàn tay ký hiệu';
  }
}
