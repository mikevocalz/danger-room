import type { Face } from 'react-native-vision-camera-face-detector';

export interface FaceTickPayload {
  present: boolean;
  cx: number;
  cy: number;
  iod: number;
  aspect: number;
  roll: number;
  yaw: number;
  pitch: number;
}

export const NO_FACE: FaceTickPayload = {
  present: false,
  cx: 0.5,
  cy: 0.42,
  iod: 0,
  aspect: 1,
  roll: 0,
  yaw: 0,
  pitch: 0,
};

const clamp01 = (value: number) => {
  'worklet';
  return Math.max(0, Math.min(1, value));
};

/**
 * Lightweight attachment solve for the FAST ML Kit path.
 *
 * Landmarks provide the eye-line anchor/roll. Scale blends raw eye distance
 * toward face-box width as yaw increases, avoiding the obvious "helmet shrinks
 * when I turn" artifact without requesting expensive face contours. That keeps
 * ML Kit tracking compatible and leaves dense mesh work to an optional
 * MediaPipe precision tier.
 */
export function computeAnchor(f: Face): FaceTickPayload {
  'worklet';
  const fw = f.frameWidth || 1;
  const fh = f.frameHeight || 1;
  const aspect = fw / fh;
  const yaw = f.yawAngle ?? 0;
  const pitch = f.pitchAngle ?? 0;
  const le = f.landmarks?.LEFT_EYE;
  const re = f.landmarks?.RIGHT_EYE;
  const nb = f.landmarks?.NOSE_BASE;
  const b = f.bounds;

  if (le && re && nb) {
    const emx = (le.x + re.x) / 2;
    const emy = (le.y + re.y) / 2;
    const roll = Math.atan2(re.y - le.y, re.x - le.x);
    const eyeIod = Math.hypot(re.x - le.x, re.y - le.y) / fw;
    const boxIod = (b.width * 0.42) / fw;
    const yawWeight = clamp01(Math.abs(yaw) / 38);
    const iod = eyeIod * (1 - yawWeight) + boxIod * yawWeight;

    return {
      present: true,
      cx: (emx + 0.22 * (nb.x - emx)) / fw,
      cy: (emy + 0.22 * (nb.y - emy)) / fh,
      iod,
      aspect,
      roll,
      yaw,
      pitch,
    };
  }

  return {
    present: true,
    cx: (b.x + b.width / 2) / fw,
    cy: (b.y + b.height * 0.42) / fh,
    iod: (b.width * 0.42) / fw,
    aspect,
    roll: ((f.rollAngle ?? 0) * Math.PI) / 180,
    yaw,
    pitch,
  };
}
