/**
 * Scale-Invariant, Translation-Invariant Anatomical Hand Gesture Classifier
 * MediSign AI wrist-relative normalization and finger kinematics.
 * Optimized for natural webcam angles and varying hand sizes.
 */

export interface FingerStates {
  thumbExtended: boolean;
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  extendedCount: number;
  curledCount: number;
  pinchDistance: number; // distance between thumb tip and index tip normalized by palm
}

export interface GestureMatchResult {
  matchScore: number;
  isMatched: boolean;
  detectedPose: string;
  fingerStates: FingerStates;
  debugText: string;
}

export function classifyHandLandmarks(
  landmarks: { x: number; y: number }[],
  targetGloss: string
): GestureMatchResult {
  // CRITICAL: When no real hand landmarks exist, ALWAYS return 0% match!
  if (!landmarks || landmarks.length < 21) {
    return {
      matchScore: 0,
      isMatched: false,
      detectedPose: 'NO_HAND',
      fingerStates: {
        thumbExtended: false,
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
        extendedCount: 0,
        curledCount: 5,
        pinchDistance: 1.0,
      },
      debugText: 'Chưa phát hiện bàn tay trước camera',
    };
  }

  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];

  // Palm scale: distance between wrist and middle MCP
  const palmScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 1.0;

  // Helper: Euclidean distance
  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Helper to check if a finger is extended vs curled
  // More forgiving ratio (1.02 instead of 1.08) to accommodate webcam foreshortening
  const checkFinger = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    const dTipWrist = dist(tip, wrist);
    const dPipWrist = dist(pip, wrist);
    const dTipMcp = dist(tip, mcp);

    // Tip further than PIP and tip far from MCP
    return (dTipWrist > dPipWrist * 1.02 && dTipMcp > palmScale * 0.45) || dTipWrist > palmScale * 1.15;
  };

  const indexExtended = checkFinger(8, 6, 5);
  const middleExtended = checkFinger(12, 10, 9);
  const ringExtended = checkFinger(16, 14, 13);
  const pinkyExtended = checkFinger(20, 18, 17);

  // Thumb analysis: distance from thumb tip (4) to index MCP (5)
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const thumbDistToIndexMcp = dist(thumbTip, indexMcp) / palmScale;
  const thumbDistToWrist = dist(thumbTip, wrist) / palmScale;
  const thumbExtended = thumbDistToIndexMcp > 0.55 || thumbDistToWrist > 0.85;

  // Pinch distance (Thumb tip to Index tip normalized)
  const pinchDistance = dist(thumbTip, indexTip) / palmScale;

  let extendedCount = 0;
  if (indexExtended) extendedCount++;
  if (middleExtended) extendedCount++;
  if (ringExtended) extendedCount++;
  if (pinkyExtended) extendedCount++;
  if (thumbExtended) extendedCount++;

  const curledCount = 5 - extendedCount;

  const fingerStates: FingerStates = {
    thumbExtended,
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
    extendedCount,
    curledCount,
    pinchDistance,
  };

  // Canonical pose detection
  let detectedPose = 'UNKNOWN';
  if (extendedCount >= 4) {
    detectedPose = 'OPEN_PALM'; // Xòe bàn tay
  } else if (indexExtended && !middleExtended && !ringExtended) {
    detectedPose = 'POINTING'; // Chỉ một ngón trỏ
  } else if (curledCount >= 4) {
    detectedPose = 'FIST'; // Nắm đấm
  } else if (pinchDistance < 0.42) {
    detectedPose = 'PINCH'; // Chụm ngón cầm bút
  } else if (thumbExtended && curledCount >= 3) {
    detectedPose = 'THUMB_OUT'; // Ngón cái xòe
  }

  // Target gesture semantic evaluation
  const gloss = targetGloss.trim();
  let matchScore = 35; // base score when hand is visible
  let isMatched = false;
  let debugText = '';

  const MATCH_THRESHOLD = 65; // User-friendly sensitivity

  if (gloss === 'Tôi') {
    // Ký hiệu "Tôi": Chỉ ngón trỏ vào ngực / hướng lên
    const indexDominance = dist(landmarks[8], wrist) > dist(landmarks[12], wrist) * 1.1;

    if (indexExtended && (curledCount >= 3 || indexDominance)) {
      matchScore = 95;
      isMatched = true;
      debugText = 'Khớp chuẩn: Ngón trỏ đang chỉ';
    } else if (indexExtended && !middleExtended) {
      matchScore = 88;
      isMatched = true;
      debugText = 'Khớp tốt: Ngón trỏ vươn dài';
    } else if (indexExtended) {
      matchScore = 72;
      isMatched = true;
      debugText = 'Khớp: Có ngón trỏ duỗi';
    } else {
      matchScore = 40;
      debugText = 'Chưa khớp: Hãy duỗi ngón trỏ và co các ngón còn lại';
    }
  } else if (gloss === 'Đau') {
    // Ký hiệu "Đau": Nắm đấm co quắp (Fist)
    if (curledCount >= 4 || detectedPose === 'FIST') {
      matchScore = 96;
      isMatched = true;
      debugText = 'Khớp chuẩn: Nắm chặt bàn tay';
    } else if (curledCount >= 3) {
      matchScore = 85;
      isMatched = true;
      debugText = 'Khớp tốt: Các ngón tay đang co lại';
    } else {
      matchScore = 38;
      debugText = 'Chưa khớp: Hãy nắm bàn tay lại';
    }
  } else if (gloss === 'Bụng') {
    // Ký hiệu "Bụng": Xòe bàn tay 5 ngón (Open Palm)
    if (extendedCount >= 4 || detectedPose === 'OPEN_PALM') {
      matchScore = 96;
      isMatched = true;
      debugText = 'Khớp chuẩn: Bàn tay xòe mở 5 ngón';
    } else if (extendedCount >= 3) {
      matchScore = 82;
      isMatched = true;
      debugText = 'Khớp tốt: Hầu hết các ngón đều xòe';
    } else {
      matchScore = 40;
      debugText = 'Chưa khớp: Hãy xòe rộng bàn tay';
    }
  } else if (gloss === 'Hôm qua') {
    // Ký hiệu "Hôm qua": Ngón cái mở rộng chỉ ra sau vai
    if (thumbExtended && (curledCount >= 2 || detectedPose === 'THUMB_OUT')) {
      matchScore = 95;
      isMatched = true;
      debugText = 'Khớp chuẩn: Ngón cái mở rộng chỉ qua vai';
    } else if (thumbExtended) {
      matchScore = 84;
      isMatched = true;
      debugText = 'Khớp tốt: Ngón cái đang xòe';
    } else if (extendedCount >= 3) {
      matchScore = 70;
      isMatched = true;
      debugText = 'Khớp chấp nhận: Bàn tay nghiêng';
    } else {
      matchScore = 40;
      debugText = 'Chưa khớp: Hãy giơ ngón cái chỉ ngược ra sau';
    }
  } else if (gloss === 'Cần' || gloss === 'Giúp') {
    // Ký hiệu "Cần" hoặc "Giúp": Bàn tay ngửa mở vươn lên
    if (extendedCount >= 3) {
      matchScore = 94;
      isMatched = true;
      debugText = 'Khớp chuẩn: Bàn tay ngửa mở các ngón';
    } else if (extendedCount >= 2) {
      matchScore = 78;
      isMatched = true;
      debugText = 'Khớp tốt: Bàn tay mở';
    } else {
      matchScore = 40;
      debugText = 'Chưa khớp: Hãy mở lòng bàn tay ngửa lên';
    }
  } else if (gloss === 'Khai báo') {
    // Ký hiệu "Khai báo": Chụm ngón cái và trỏ như cầm bút viết (Pinch)
    if (pinchDistance < 0.44 || detectedPose === 'PINCH') {
      matchScore = 96;
      isMatched = true;
      debugText = 'Khớp chuẩn: Chụm ngón cái và ngón trỏ';
    } else if (indexExtended && thumbExtended && !middleExtended) {
      matchScore = 85;
      isMatched = true;
      debugText = 'Khớp tốt: Tư thế cầm bút viết';
    } else {
      matchScore = 40;
      debugText = 'Chưa khớp: Hãy chụm đầu ngón trỏ và ngón cái';
    }
  } else {
    // Generic fallback for custom glosses
    matchScore = extendedCount >= 2 ? 80 : 50;
    isMatched = matchScore >= MATCH_THRESHOLD;
    debugText = `Đang so khớp cử chỉ ${gloss}`;
  }

  return {
    matchScore,
    isMatched,
    detectedPose,
    fingerStates,
    debugText,
  };
}
