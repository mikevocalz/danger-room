import { create } from 'zustand';

/** Coordinates the room's single reveal: skeleton faceplates show for every part
 *  until the slowest (the 3D model) is ready, then everything appears at once. */
interface RoomState {
  ready: boolean;
  setReady: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  ready: false,
  setReady: () => set({ ready: true }),
  reset: () => set({ ready: false }),
}));
