import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { RiveCanvasOptions } from 'nitro-canvas-in-Vision';

export interface DangerRoomRiveSources {
  plateSource: RiveCanvasOptions | null;
  hudSource: RiveCanvasOptions | null;
  error: string | null;
  enabled: boolean;
}

const RIVE_URL = process.env.EXPO_PUBLIC_DANGER_ROOM_RIVE_URL;
const PLATE_ARTBOARD =
  process.env.EXPO_PUBLIC_DANGER_ROOM_RIVE_PLATE_ARTBOARD ?? 'ParticipantPlate';
const HUD_ARTBOARD =
  process.env.EXPO_PUBLIC_DANGER_ROOM_RIVE_HUD_ARTBOARD ?? 'DangerRoomHUD';
const STATE_MACHINE =
  process.env.EXPO_PUBLIC_DANGER_ROOM_RIVE_STATE_MACHINE ?? 'Main';

function supportsNativeRivePanel() {
  if (Platform.OS !== 'android') return false;
  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);
  return Number.isFinite(version) && version >= 34;
}

export function useDangerRoomRiveSources(): DangerRoomRiveSources {
  const enabled = Boolean(RIVE_URL) && supportsNativeRivePanel();
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !RIVE_URL) {
      setBytes(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let live = true;

    void fetch(RIVE_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Rive asset request failed: HTTP ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((next) => {
        if (!live) return;
        setBytes(next);
        setError(null);
      })
      .catch((cause) => {
        if (!live || controller.signal.aborted) return;
        setBytes(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [enabled]);

  const plateSource = useMemo<RiveCanvasOptions | null>(
    () =>
      bytes
        ? {
            rivBytes: bytes,
            artboard: PLATE_ARTBOARD,
            stateMachine: STATE_MACHINE,
            fit: 'fill',
          }
        : null,
    [bytes],
  );

  const hudSource = useMemo<RiveCanvasOptions | null>(
    () =>
      bytes
        ? {
            rivBytes: bytes,
            artboard: HUD_ARTBOARD,
            stateMachine: STATE_MACHINE,
            fit: 'contain',
          }
        : null,
    [bytes],
  );

  return { plateSource, hudSource, error, enabled };
}
