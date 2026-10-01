import { Platform } from 'react-native';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useFrameOutput } from 'react-native-vision-camera';
import {
  useFaceDetector,
  type Face,
} from 'react-native-vision-camera-face-detector';

import {
  computeAnchor,
  NO_FACE,
  type FaceTickPayload,
} from './faceAnchor';

const DETECTION_FPS = 24;
const DETECTION_INTERVAL_MS = 1000 / DETECTION_FPS;

interface DetectorState {
  lastDetectionAt: number;
  trackingId: number;
}

function primaryFaceIndex(
  faces: Face[],
  trackingId: number,
): number {
  'worklet';
  if (faces.length === 0) return -1;

  if (trackingId >= 0) {
    for (let i = 0; i < faces.length; i += 1) {
      if (faces[i]?.trackingId === trackingId) return i;
    }
  }

  // Re-acquisition chooses the largest face instead of whichever ML Kit
  // happens to return first.
  let best = 0;
  let bestArea = -1;
  for (let i = 0; i < faces.length; i += 1) {
    const bounds = faces[i]?.bounds;
    if (!bounds) continue;
    const area = bounds.width * bounds.height;
    if (area > bestArea) {
      bestArea = area;
      best = i;
    }
  }
  return best;
}

/**
 * Dedicated low-cost analysis output.
 *
 * Nothing here publishes video. Fishjam's WebGPU output owns publishing; this
 * output only updates the face target it reads. Keeping the two lanes separate
 * guarantees a slow detector frame cannot delay an encoder frame.
 */
export function useFaceFilterOutput(
  enabled: SharedValue<boolean>,
  faceTarget: SharedValue<FaceTickPayload>,
  facing: 'front' | 'back' = 'front',
) {
  const detectorOptions = useMemo(
    () => ({
      performanceMode: 'fast' as const,
      cameraFacing: facing,
      runLandmarks: true,
      runContours: false,
      runClassifications: false,
      trackingEnabled: true,
      minFaceSize: 0.15,
      autoMode: false,
    }),
    [facing],
  );
  const detector = useFaceDetector(detectorOptions);

  // Mutable worklet-local state, not React state and not a JS bridge.
  const state = useMemo<DetectorState>(
    () => ({ lastDetectionAt: 0, trackingId: -1 }),
    [detector],
  );

  return useFrameOutput({
    targetResolution: { width: 640, height: 480 },
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    enablePreviewSizedOutputBuffers: true,
    enablePhysicalBufferRotation: Platform.OS === 'ios',
    allowDeferredStart: true,
    onFrame(frame) {
      'worklet';
      try {
        if (!enabled.value) {
          state.trackingId = -1;
          if (faceTarget.value.present) {
            faceTarget.value = NO_FACE;
          }
          return;
        }

        const now = performance.now();
        if (now - state.lastDetectionAt < DETECTION_INTERVAL_MS) return;
        state.lastDetectionAt = now;

        const faces = detector.detectFaces(frame);
        const index = primaryFaceIndex(faces, state.trackingId);
        if (index < 0) {
          state.trackingId = -1;
          faceTarget.value = NO_FACE;
          return;
        }

        const face = faces[index]!;
        state.trackingId = face.trackingId ?? -1;
        faceTarget.value = computeAnchor(face);
      } finally {
        frame.dispose();
      }
    },
  });
}
