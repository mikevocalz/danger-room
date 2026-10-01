import { create } from 'zustand';

/** Session flag: has the Cerebro splash finished? Gates the lobby's permissions
 *  sheet so it presents on the join screen, not under the splash. */
interface SplashState {
  done: boolean;
  markDone: () => void;
}

export const useSplashStore = create<SplashState>((set) => ({
  done: false,
  markDone: () => set({ done: true }),
}));
