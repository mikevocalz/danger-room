import type { Face } from 'react-native-vision-camera-face-detector';

/**
 * Raw (pre-filter) tracking channels, all in FRAME-normalized space so the view
 * mapping (frameToView) stays the single place that knows the preview transform.
 * Built in the detector's JS `onFacesDetected` callback (Nitro path — not a
 * worklet), so plain JS; no worklet directive needed.
 */
export interface FaceTickPayload {
  present: boolean;
  cx: number; // frame-normalized anchor x (0..1)
  cy: number; // frame-normalized anchor y (0..1)
  iod: number; // interocular distance / frameWidth (drives scale)
  aspect: number; // frameWidth / frameHeight (for cover-crop registration)
  roll: number; // radians (eye-line angle)
  yaw: number; // degrees (MLKit Euler Y)
  pitch: number; // degrees (MLKit Euler X)
}

export const NO_FACE: FaceTickPayload = {
  present: false, cx: 0.5, cy: 0.42, iod: 0, aspect: 1, roll: 0, yaw: 0, pitch: 0,
};

// The cowl template's iod is calibrated against interocular distance. The FACE
// contour's horizontal extent on a frontal face is ~3.4x IOD (MLKit oval ≈ full
// head width), so contour-derived scale is expressed in iod units to keep the
// template solve unchanged.
const FACE_WIDTH_TO_IOD = 1 / 3.4;

/**
 * FaceBlurApp-style contour fit (§3.3 upgrade): when MLKit contours are present,
 * scale comes from the FACE oval's width measured ALONG the eye line. Unlike raw
 * IOD, the oval width barely changes under yaw (the eyes foreshorten, the head
 * outline doesn't), which is what made the cowl shrink when the head turned.
 * Anchor and roll still come from the eye landmarks/contours. Runs in the
 * publish frame worklet, so it must stay allocation-light and synchronous.
 */
export function computeAnchor(f: Face): FaceTickPayload {
  'worklet';
  const fw = f.frameWidth || 1;
  const fh = f.frameHeight || 1;
  const aspect = fw / fh;
  const le = f.landmarks?.LEFT_EYE;
  const re = f.landmarks?.RIGHT_EYE;
  const nb = f.landmarks?.NOSE_BASE;

  if (le && re && nb) {
    const emx = (le.x + re.x) / 2;
    const emy = (le.y + re.y) / 2;
    const roll = Math.atan2(re.y - le.y, re.x - le.x);

    // Yaw-stable scale: project every FACE-oval point onto the eye line and take
    // the extent. Falls back to raw IOD when contours are off/absent.
    let iod = Math.hypot(re.x - le.x, re.y - le.y) / fw;
    const oval = f.contours?.FACE;
    if (oval && oval.length >= 8) {
      const ux = Math.cos(roll);
      const uy = Math.sin(roll);
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < oval.length; i++) {
        const t = oval[i].x * ux + oval[i].y * uy;
        if (t < min) min = t;
        if (t > max) max = t;
      }
      iod = ((max - min) * FACE_WIDTH_TO_IOD) / fw;
    }

    return {
      present: true,
      cx: (emx + 0.22 * (nb.x - emx)) / fw,
      cy: (emy + 0.22 * (nb.y - emy)) / fh,
      iod,
      aspect,
      roll,
      yaw: f.yawAngle ?? 0,
      pitch: f.pitchAngle ?? 0,
    };
  }

  // Degraded fallback: bias the anchor up toward the eye line, not the box centre.
  const b = f.bounds;
  return {
    present: true,
    cx: (b.x + b.width / 2) / fw,
    cy: (b.y + b.height * 0.42) / fh,
    iod: (b.width * 0.42) / fw,
    aspect,
    roll: ((f.rollAngle ?? 0) * Math.PI) / 180,
    yaw: f.yawAngle ?? 0,
    pitch: f.pitchAngle ?? 0,
  };
}
