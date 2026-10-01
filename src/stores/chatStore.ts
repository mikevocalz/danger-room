import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  self: boolean;
  ts: number;
}

interface ChatState {
  messages: ChatMessage[];
  unread: number;
  add: (m: ChatMessage) => void;
  clearUnread: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unread: 0,
  add: (m) =>
    set((s) => ({
      messages: [...s.messages, m],
      unread: m.self ? s.unread : s.unread + 1,
    })),
  clearUnread: () => set({ unread: 0 }),
}));
