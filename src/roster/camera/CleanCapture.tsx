import { useEffect } from 'react';
import { useCamera, useCameraPermission } from 'react-native-vision-camera';

/**
 * THE capture driver (§D1): one `useCamera` with the stable, HostStage-owned
 * Fishjam `frameOutput`. Face detection no longer lives in a second CameraOutput —
 * it runs frame-sync inside the publish source's onFrame worklet
 * (useTrackedGuestCameraSource), so the old MaskedCapture remount seam is gone;
 * only a lens flip recreates the session.
 */
export const CleanCapture = ({
  frameOutput, facing = 'front', enabled = true,
}: {
  frameOutput: unknown; facing?: 'front' | 'back'; enabled?: boolean;
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission, requestPermission]);
  useCamera({ device: facing, isActive: hasPermission && enabled, outputs: [frameOutput as never] });
  return null;
};
