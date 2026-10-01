import { useEffect, useMemo } from 'react';
import { useCamera, useCameraPermission } from 'react-native-vision-camera';

/**
 * One CameraSession with independent outputs:
 * - publishOutput: Fishjam/WebRTC, never waits for ML inference;
 * - analysisOutput: small YUV face-analysis stream with its own backpressure.
 *
 * Both output objects stay mounted when the mask toggles. The analysis worklet
 * gates inference internally, so filter on/off never rebuilds the camera.
 */
export const CleanCapture = ({
  frameOutput,
  analysisOutput,
  facing = 'front',
  enabled = true,
}: {
  frameOutput: unknown;
  analysisOutput?: unknown;
  facing?: 'front' | 'back';
  enabled?: boolean;
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const outputs = useMemo(
    () => analysisOutput
      ? [frameOutput as never, analysisOutput as never]
      : [frameOutput as never],
    [frameOutput, analysisOutput],
  );

  useCamera({
    device: facing,
    isActive: hasPermission && enabled,
    outputs,
  });
  return null;
};
