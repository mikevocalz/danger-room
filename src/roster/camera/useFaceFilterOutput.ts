import { Platform } from 'react-native';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrameOutput } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';

import { computeAnchor, NO_FACE, type FaceTickPayload } from './faceAnchor';

/**
 * Snapchat-style analysis lane:
 *
 * - camera publishing and face inference are different outputs;
 * - ML Kit gets a small 640x480 YUV stream instead of the published frame;
 * - new frames are dropped while inference is busy instead of building latency;
 * - the mask toggle gates inference inside the worklet without reconfiguring the
 *   camera session;
 * - detection is capped at 24 Hz. Reanimated interpolates those targets at the
 *   display refresh rate, so 60/90/120 Hz screens remain visually smooth.
 *
 * The detector stays react-native-vision-camera-face-detector. MediaPipe is a
 * precision tier for future mesh/blendshape filters, not an always-on second
 * detector.
 */
const DETECTION_FPS = 24;
const DETECTION_INTERVAL_MS = 1000 / DETECTION_FPS;

function primaryFaceIndex(
  faces: ReturnType<ReturnType<typeof useFaceDetector>['detectFaces']>,
  trackingId: number,
): number {
  'worklet';
  if (faces.length === 0) return -1;

  if (trackingId >= 0) {
    for (let i = 0; i < faces.length; i += 1) {
      if (faces[i]?.trackingId === trackingId) return i;
    }
  }

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

export function useFaceFilterOutput(
  enabled: SharedValue<boolean>,
  onFaceTick: (tick: FaceTickPayload) => void,
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

  const lastDetectionAt = useSharedValue(0);
  const selectedTrackingId = useSharedValue(-1);

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
          selectedTrackingId.value = -1;
          return;
        }

        const now = performance.now();
        if (now - lastDetectionAt.value < DETECTION_INTERVAL_MS) return;
        lastDetectionAt.value = now;

        const faces = detector.detectFaces(frame);
        const index = primaryFaceIndex(faces, selectedTrackingId.value);
        if (index < 0) {
          selectedTrackingId.value = -1;
          scheduleOnRN(onFaceTick, NO_FACE);
          return;
        }

        const face = faces[index]!;
        selectedTrackingId.value = face.trackingId ?? -1;
        scheduleOnRN(onFaceTick, computeAnchor(face));
      } finally {
        frame.dispose();
      }
    },
  });
}
