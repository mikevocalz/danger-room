import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { ViroRivePanel } from '@reactvision/react-viro';
import type { RiveCanvasOptions } from 'nitro-canvas-in-Vision';
import { create } from 'zustand';

const PLATE_ASSET = require('../../assets/rive/danger_room_plate.riv');

type PlateAssetState = {
  bytes: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
  load(): Promise<void>;
};

const usePlateAsset = create<PlateAssetState>((set, get) => ({
  bytes: null,
  loading: false,
  error: null,
  async load() {
    const current = get();
    if (current.bytes || current.loading) return;
    set({ loading: true, error: null });
    try {
      const asset = Asset.fromModule(PLATE_ASSET);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const response = await fetch(uri);
      const bytes = await response.arrayBuffer();
      set({ bytes, loading: false, error: null });
    } catch (error) {
      set({ bytes: null, loading: false, error: String(error) });
    }
  },
}));

export interface SpatialRivePlateProps {
  width: number;
  height: number;
  name: string;
  status: string;
  finish: 'silver' | 'gold';
  empty?: boolean;
  live?: boolean;
  muted?: boolean;
  self?: boolean;
  speaking?: boolean;
  level?: number;
}

/**
 * Spatial sibling of the 2D RivePlate. It uses the fork's native
 * ViroRivePanel, including Android AHardwareBuffer presentation and direct
 * View Model bindings. No JS pixel copies and no RN overlay in the headset.
 */
export function SpatialRivePlate({
  width,
  height,
  name,
  status,
  finish,
  empty = false,
  live = false,
  muted = false,
  self = false,
  speaking = false,
  level = 0,
}: SpatialRivePlateProps) {
  const bytes = usePlateAsset((state) => state.bytes);
  const load = usePlateAsset((state) => state.load);
  const error = usePlateAsset((state) => state.error);

  useEffect(() => {
    void load();
  }, [load]);

  const source = useMemo<RiveCanvasOptions | null>(
    () => bytes
      ? {
          rivBytes: bytes,
          artboard: 'DangerRoomPlate',
          fit: 'fill',
        }
      : null,
    [bytes],
  );

  const bindings = useMemo(() => ({
    name: name.toUpperCase(),
    status: status.toUpperCase(),
    goldAlpha: finish === 'gold' ? 1 : 0,
    silverAlpha: finish === 'silver' ? 1 : 0,
    emptyAlpha: empty ? 1 : 0,
    speakingAlpha: speaking ? Math.max(0.35, Math.min(1, level || 1)) : 0,
    selfAlpha: self ? 1 : 0,
    liveAlpha: live ? 1 : 0,
    mutedAlpha: muted ? 1 : 0,
  }), [empty, finish, level, live, muted, name, self, speaking, status]);

  if (!source) {
    if (error && __DEV__) console.warn('[xr-rive-plate]', error);
    return null;
  }

  return (
    <ViroRivePanel
      source={source}
      width={width}
      height={height}
      position={[0, 0, 0.02]}
      resolution={{ width: 1600, height: 1000 }}
      androidRoute={Platform.OS === 'android' ? 'ahb' : 'surface-texture'}
      lightingModel="Constant"
      bindings={bindings}
      onError={(cause: Error) => console.warn('[xr-rive-plate]', cause.message)}
    />
  );
}
