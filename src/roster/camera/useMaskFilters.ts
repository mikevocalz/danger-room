import { useMemo } from 'react';

import { OneEuro, POS_PARAMS, SCALE_PARAMS, ANGLE_PARAMS } from './oneEuro';
import type { FaceTickPayload } from './faceAnchor';

export interface FilteredFace {
  present: boolean;
  cx: number; cy: number; iod: number; aspect: number;
  roll: number; yaw: number; pitch: number;
}

/**
 * Six One Euro filters — one per channel — stepped on the JS face-tick (§6.7).
 * Position channels smooth harder (kill rest jitter); angle channels track
 * tighter. Roll is angle-unwrapped before filtering so a head crossing ±π never
 * spins. All filters reset on face loss so re-acquire snaps clean, not chases.
 */
export function useMaskFilters() {
  return useMemo(() => {
    const fCx = new OneEuro(POS_PARAMS);
    const fCy = new OneEuro(POS_PARAMS);
    const fIod = new OneEuro(SCALE_PARAMS);
    const fRoll = new OneEuro(ANGLE_PARAMS);
    const fYaw = new OneEuro(ANGLE_PARAMS);
    const fPitch = new OneEuro(ANGLE_PARAMS);

    let started = false;
    let rollPrev = 0;
    let rollUnwrapped = 0;

    const reset = () => {
      [fCx, fCy, fIod, fRoll, fYaw, fPitch].forEach((f) => f.reset());
      started = false;
      rollUnwrapped = 0;
    };

    return {
      reset,
      step(t: FaceTickPayload): FilteredFace {
        if (!t.present) {
          reset();
          return { present: false, cx: t.cx, cy: t.cy, iod: 0, aspect: t.aspect, roll: 0, yaw: 0, pitch: 0 };
        }
        const now = Date.now();
        // Angle-unwrap roll (§6.7) so ±π never produces a spin.
        if (!started) { rollPrev = t.roll; rollUnwrapped = t.roll; started = true; }
        let d = t.roll - rollPrev;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        rollUnwrapped += d;
        rollPrev = t.roll;

        return {
          present: true,
          cx: fCx.filter(t.cx, now),
          cy: fCy.filter(t.cy, now),
          iod: fIod.filter(t.iod, now),
          aspect: t.aspect,
          roll: fRoll.filter(rollUnwrapped, now),
          yaw: fYaw.filter(t.yaw, now),
          pitch: fPitch.filter(t.pitch, now),
        };
      },
    };
  }, []);
}
