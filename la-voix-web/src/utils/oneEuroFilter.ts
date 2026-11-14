/**
 * One-Euro Filter (1€ Filter) & Zero-Lag Fast Motion Bypass
 * Adaptive low-pass filter with dynamic cutoff frequency:
 * - Low speed (static posture): Low cutoff -> Zero high-frequency jitter.
 * - High speed (gesture stroke): High cutoff & Zero-lag bypass -> Instant 1:1 responsiveness.
 * Optimized for MediaPipe 21-point hand tracking based on the MediSign AI technical report.
 */

export interface Point2D {
  x: number;
  y: number;
}

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  public filter(x: number, alpha: number): number {
    if (this.y === null || this.s === null) {
      this.y = x;
      this.s = x;
    } else {
      this.y = alpha * x + (1.0 - alpha) * this.s;
      this.s = this.y;
    }
    return this.y;
  }

  public last(): number | null {
    return this.y;
  }

  public reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(x: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(x, 1.0);
    }

    const dt = Math.max(1e-4, (timestamp - this.lastTime) * 0.001); // in seconds
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    // Estimate derivative
    const lastX = this.xFilter.last();
    const dx = lastX !== null ? (x - lastX) * rate : 0.0;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));

    // Dynamic cutoff based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this.alpha(rate, cutoff));
  }

  public reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/**
 * 21-Landmark Hand Stabilizer with Zero-Lag Fast Motion Bypass
 */
export class HandLandmarkStabilizer {
  private filtersX: OneEuroFilter1D[];
  private filtersY: OneEuroFilter1D[];
  private fastMotionThreshold: number; // in pixels/frame
  private prevWrist: Point2D | null = null;

  constructor(minCutoff = 1.2, beta = 0.012, fastMotionThreshold = 28.0) {
    this.fastMotionThreshold = fastMotionThreshold;
    this.filtersX = Array.from({ length: 21 }, () => new OneEuroFilter1D(minCutoff, beta));
    this.filtersY = Array.from({ length: 21 }, () => new OneEuroFilter1D(minCutoff, beta));
  }

  /**
   * Filter 21 landmarks. If the overall hand motion is fast (rapid gesture transition),
   * bypass filtering to guarantee zero lag!
   */
  public filter(landmarks: Point2D[], timestamp: number): Point2D[] {
    if (landmarks.length !== 21) return landmarks;

    // Calculate motion magnitude of wrist (landmark 0) from previous raw position
    let isFastMotion = false;
    const wrist = landmarks[0];
    if (this.prevWrist) {
      const wristSpeed = Math.hypot(wrist.x - this.prevWrist.x, wrist.y - this.prevWrist.y);
      if (wristSpeed > this.fastMotionThreshold) {
        isFastMotion = true;
      }
    }
    this.prevWrist = { x: wrist.x, y: wrist.y };

    // If rapid fast motion, bypass filter for 1:1 instant tracking and sync filter states
    if (isFastMotion) {
      for (let i = 0; i < 21; i++) {
        this.filtersX[i].reset();
        this.filtersY[i].reset();
        this.filtersX[i].filter(landmarks[i].x, timestamp);
        this.filtersY[i].filter(landmarks[i].y, timestamp);
      }
      return landmarks;
    }

    // Filter each landmark coordinates smoothly
    const filtered: Point2D[] = new Array(21);
    for (let i = 0; i < 21; i++) {
      filtered[i] = {
        x: this.filtersX[i].filter(landmarks[i].x, timestamp),
        y: this.filtersY[i].filter(landmarks[i].y, timestamp),
      };
    }
    return filtered;
  }

  public reset(): void {
    this.filtersX.forEach((f) => f.reset());
    this.filtersY.forEach((f) => f.reset());
    this.prevWrist = null;
  }
}
