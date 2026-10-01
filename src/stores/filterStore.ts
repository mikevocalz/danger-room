import { create } from 'zustand';

/** Host camera filters + capture controls (CRT, cowl mask, flip, camera on/off). */
interface FilterState {
  crt: boolean;
  mask: boolean;
  /** Wall-clock ms until which mask toggles are ignored (§6.3 debounce). */
  maskLockedUntil: number;
  /** Which lens the capture opens. */
  cameraFacing: 'front' | 'back';
  /** When false the camera capture is stopped (video off). */
  cameraOn: boolean;
  toggleCrt: () => void;
  toggleMask: () => void;
  flipCamera: () => void;
  toggleCamera: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  crt: false,
  mask: false,
  maskLockedUntil: 0,
  cameraFacing: 'front',
  cameraOn: true,
  flipCamera: () => set((s) => ({ cameraFacing: s.cameraFacing === 'front' ? 'back' : 'front' })),
  toggleCamera: () => set((s) => ({ cameraOn: !s.cameraOn })),
  toggleCrt: () => set((s) => ({ crt: !s.crt })),
  // §6.3 — each MASK toggle is a full capture remount (~400 ms). A 900 ms lockout
  // absorbs rapid tapping so the CameraX session is never re-created mid-rebuild.
  toggleMask: () =>
    set((s) => {
      const now = Date.now();
      if (now < s.maskLockedUntil) return s;
      return { mask: !s.mask, maskLockedUntil: now + 900 };
    }),
}));
