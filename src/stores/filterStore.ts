import { create } from 'zustand';

/** Host camera filters + capture controls (CRT, cowl mask, flip, camera on/off). */
interface FilterState {
  crt: boolean;
  mask: boolean;
  cameraFacing: 'front' | 'back';
  cameraOn: boolean;
  toggleCrt: () => void;
  toggleMask: () => void;
  flipCamera: () => void;
  toggleCamera: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  crt: false,
  mask: false,
  cameraFacing: 'front',
  cameraOn: true,
  flipCamera: () =>
    set((s) => ({ cameraFacing: s.cameraFacing === 'front' ? 'back' : 'front' })),
  toggleCamera: () => set((s) => ({ cameraOn: !s.cameraOn })),
  toggleCrt: () => set((s) => ({ crt: !s.crt })),
  // The analysis output stays attached; its worklet gates ML inference. There is
  // no CameraSession rebuild to debounce when a lens toggles on or off.
  toggleMask: () => set((s) => ({ mask: !s.mask })),
}));
