import { create } from 'zustand';

export type ReactionKind = 'clap' | 'heart' | 'fire' | 'party';

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'clap', emoji: '👏', label: 'CLAP' },
  { kind: 'heart', emoji: '❤️', label: 'LOVE' },
  { kind: 'fire', emoji: '🔥', label: 'FIRE' },
  { kind: 'party', emoji: '🎉', label: 'PARTY' },
];

export const EMOJI: Record<ReactionKind, string> = {
  clap: '👏',
  heart: '❤️',
  fire: '🔥',
  party: '🎉',
};

/** One themed particle burst playing in the host frame. */
export interface Burst {
  id: number;
  kind: ReactionKind;
}

interface ReactionState {
  bursts: Burst[];
  /** Fire a themed burst (local + call sites also broadcast it). */
  show: (kind: ReactionKind) => void;
  /** Remove a finished burst once its particles have died. */
  end: (id: number) => void;
}

let seq = 0;

export const useReactionStore = create<ReactionState>((set) => ({
  bursts: [],
  show: (kind) => set((s) => ({ bursts: [...s.bursts, { id: ++seq, kind }] })),
  end: (id) => set((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })),
}));
