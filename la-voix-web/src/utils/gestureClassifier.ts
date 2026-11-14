/**
 * Robust Single-Hand Gesture Classifier for La Voix v2
 * Tailored for single-hand interaction (left or right hand).
 * Standard canonical gestures:
 * 1. POINTING (☝️) -> "Tôi" (Index finger pointing up/forward)
 * 2. FIST (✊)     -> "Đau" (Clenched fist)
 * 3. OPEN_PALM (🖐️)-> "Bụng" (5 fingers open)
 * 4. THUMBS_UP (👍) -> "Hôm qua" / Câu kết thúc ("Thả like")
 */

export type CanonicalPose = 'POINTING' | 'FIST' | 'OPEN_PALM' | 'THUMBS_UP' | 'VICTORY' | 'UNKNOWN' | 'NO_HAND';

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

export function classifyHandLandmarks(
  landmarks: { x: number; y: number }[],
  targetGloss: string
): GestureMatchResult {
  // CRITICAL: When no hand is detected in camera, score is strictly 0%
  if (!landmarks || landmarks.length < 21) {
    return {
      matchScore: 0,
      isMatched: false,
      detectedPose: 'NO_HAND',
      detectedPoseName: 'Chưa thấy bàn tay',
      targetPoseName: getTargetPoseName(targetGloss),
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
  const pinkyMcp = landmarks[17];

  // Palm scale: distance between wrist and middle MCP
  const palmScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 1.0;

  // Helper Euclidean distance
  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Check finger extension: tip distance to wrist vs pip distance to wrist
  const isExtended = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    const dTipWrist = dist(tip, wrist);
    const dPipWrist = dist(pip, wrist);
    const dTipMcp = dist(tip, mcp);

    return dTipWrist > dPipWrist * 1.1 && dTipMcp > palmScale * 0.45;
  };

  const isCurled = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    const dTipWrist = dist(tip, wrist);
    const dPipWrist = dist(pip, wrist);
    const dTipMcp = dist(tip, mcp);

    return dTipWrist <= dPipWrist * 1.05 || dTipMcp < palmScale * 0.55;
  };

  const indexExt = isExtended(8, 6, 5);
  const middleExt = isExtended(12, 10, 9);
  const ringExt = isExtended(16, 14, 13);
  const pinkyExt = isExtended(20, 18, 17);

  const indexCurl = isCurled(8, 6, 5);
  const middleCurl = isCurled(12, 10, 9);
  const ringCurl = isCurled(16, 14, 13);
  const pinkyCurl = isCurled(20, 18, 17);

  // Thumb analysis
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const thumbCmc = landmarks[1];
  const dThumbWrist = dist(thumbTip, wrist);
  const thumbExt = dThumbWrist > palmScale * 0.8 && dist(thumbTip, indexMcp) > palmScale * 0.5;

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

  // 1. CANONICAL POSE CLASSIFICATION (Single Hand)
  let detectedPose: CanonicalPose = 'UNKNOWN';
  let detectedPoseName = 'Cử chỉ tự do';

  // Check THUMBS_UP (👍): Thumb extended upward, other 4 fingers curled tightly
  const thumbUpward = thumbTip.y < thumbMcp.y && thumbTip.y < landmarks[3].y;
  const otherFingersCurled = middleCurl && ringCurl && pinkyCurl && (indexCurl || dist(landmarks[8], wrist) < palmScale * 1.1);

  if (thumbExt && thumbUpward && otherFingersCurled) {
    detectedPose = 'THUMBS_UP';
    detectedPoseName = '👍 Thả like / Đồng ý';
  }
  // Check POINTING (☝️): Index extended, other fingers curled
  else if (indexExt && middleCurl && ringCurl && pinkyCurl) {
    detectedPose = 'POINTING';
    detectedPoseName = '☝️ Chỉ ngón trỏ';
  }
  // Check FIST (✊): All 4 main fingers curled tightly into palm
  else if (indexCurl && middleCurl && ringCurl && pinkyCurl) {
    detectedPose = 'FIST';
    detectedPoseName = '✊ Nắm đấm bàn tay';
  }
  // Check OPEN_PALM (🖐️): All 4 or 5 fingers extended widely
  else if (indexExt && middleExt && ringExt && (pinkyExt || thumbExt)) {
    detectedPose = 'OPEN_PALM';
    detectedPoseName = '🖐️ Xòe 5 ngón tay';
  }
  // Check VICTORY (✌️): Index and middle extended, ring and pinky curled
  else if (indexExt && middleExt && ringCurl && pinkyCurl) {
    detectedPose = 'VICTORY';
    detectedPoseName = '✌️ Chữ V (2 ngón)';
  }

  // 2. MATCH AGAINST TARGET GLOSS
  const targetPose = getTargetCanonicalPose(targetGloss);
  const targetPoseName = getTargetPoseName(targetGloss);

  let matchScore = 0;
  let isMatched = false;
  let debugText = '';

  if (detectedPose === targetPose) {
    matchScore = 96;
    isMatched = true;
    debugText = `Khớp chuẩn: Đang làm đúng ${detectedPoseName}`;
  } else if (targetPose === 'POINTING') {
    if (indexExt) {
      matchScore = 75;
      isMatched = false;
      debugText = 'Gần đúng: Hãy gập các ngón giữa, áp út và út lại';
    } else {
      matchScore = 20;
      debugText = 'Cần làm: ☝️ Chỉ ngón trỏ thẳng lên';
    }
  } else if (targetPose === 'FIST') {
    if (curledCount >= 3) {
      matchScore = 70;
      isMatched = false;
      debugText = 'Gần đúng: Hãy nắm chặt tất cả các ngón lại thành nắm đấm';
    } else {
      matchScore = 20;
      debugText = 'Cần làm: ✊ Nắm chặt bàn tay lại';
    }
  } else if (targetPose === 'OPEN_PALM') {
    if (extendedCount >= 3) {
      matchScore = 70;
      isMatched = false;
      debugText = 'Gần đúng: Hãy xòe rộng đủ cả 5 ngón tay';
    } else {
      matchScore = 20;
      debugText = 'Cần làm: 🖐️ Xòe rộng 5 ngón tay';
    }
  } else if (targetPose === 'THUMBS_UP') {
    if (thumbExt) {
      matchScore = 75;
      isMatched = false;
      debugText = 'Gần đúng: Hãy nắm 4 ngón lại và giơ ngón cái chỉ lên trên 👍';
    } else {
      matchScore = 20;
      debugText = 'Cần làm: 👍 Giơ ngón cái thả like để kết thúc';
    }
  } else {
    // Custom fallback
    matchScore = detectedPose !== 'UNKNOWN' ? 80 : 30;
    isMatched = matchScore >= 80;
    debugText = `Đang so khớp với ${targetGloss}`;
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
  if (g === 'Tôi') return 'POINTING';
  if (g === 'Đau') return 'FIST';
  if (g === 'Bụng') return 'OPEN_PALM';
  if (g === 'Hôm qua' || g.includes('Like') || g.includes('Xong') || g.includes('Đồng ý')) return 'THUMBS_UP';
  if (g === 'Cần' || g === 'Giúp') return 'OPEN_PALM';
  if (g === 'Khai báo') return 'THUMBS_UP';
  return 'POINTING';
}

export function getTargetPoseName(gloss: string): string {
  const pose = getTargetCanonicalPose(gloss);
  switch (pose) {
    case 'POINTING':
      return '☝️ Chỉ ngón trỏ';
    case 'FIST':
      return '✊ Nắm đấm bàn tay';
    case 'OPEN_PALM':
      return '🖐️ Xòe 5 ngón tay';
    case 'THUMBS_UP':
      return '👍 Thả like kết thúc';
    case 'VICTORY':
      return '✌️ Chữ V (2 ngón)';
    default:
      return 'Bàn tay ký hiệu';
  }
}
