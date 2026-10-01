/**
 * One Euro filter (Casiez et al. 2012) — one instance per tracked channel, stepped
 * on the JS face-tick. Smooth at rest (kills jitter), tight in motion (no chase):
 * the cutoff rises with speed, so a still face is heavily smoothed and a fast head
 * is barely smoothed. This is the §3.5 replacement for fixed-lag easing.
 *
 * Tunables (art-facing tokens): minCutoff lower = smoother/laggier at rest;
 * beta higher = snappier under motion. Roll must be angle-unwrapped BEFORE it is
 * fed here (see makeMaskFilters) so ±π never spins.
 */
export interface OneEuroParams {
  minCutoff: number; // Hz — cutoff at zero speed
  beta: number; // speed coefficient
  dCutoff: number; // Hz — cutoff for the derivative
}

const alpha = (cutoff: number, dt: number) => {
  'worklet';
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(p: OneEuroParams) {
    this.minCutoff = p.minCutoff;
    this.beta = p.beta;
    this.dCutoff = p.dCutoff;
  }

  /** Feed a raw sample at time tMs (ms). Returns the filtered value. */
  filter(x: number, tMs: number): number {
    if (this.xPrev == null) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    const dt = Math.max(1, tMs - this.tPrev) / 1000; // seconds, guarded
    this.tPrev = tMs;

    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }
}

// Defaults per §6.7. Position channels smooth harder; angle channels track tighter.
export const POS_PARAMS: OneEuroParams = { minCutoff: 1.2, beta: 0.03, dCutoff: 1.0 };
export const ANGLE_PARAMS: OneEuroParams = { minCutoff: 2.0, beta: 0.15, dCutoff: 1.0 };
