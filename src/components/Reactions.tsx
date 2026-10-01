import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDataChannel } from '@fishjam-cloud/react-native-client';

import { REACTIONS, useReactionStore, type ReactionKind } from '@/stores/reactionStore';
import { ReactionBurst } from '@/components/Confetti';

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Wires the Fishjam data channel for reactions: returns `send(kind)` that fires
 * the burst locally AND broadcasts it, and subscribes so every peer's reaction
 * bursts in your frame too. Rides the chat channel but tagged `t:'r'` so the two
 * never cross-talk (unreliable — drop-ok).
 */
export function useReactionsChannel() {
  const { publishData, subscribeData, initializeDataChannel } = useDataChannel();
  const show = useReactionStore((s) => s.show);

  useEffect(() => {
    try {
      initializeDataChannel();
    } catch {}
    const unsub = subscribeData(
      (payload) => {
        try {
          const raw = payload instanceof Uint8Array ? payload : new Uint8Array(payload as ArrayBuffer);
          const m = JSON.parse(dec.decode(raw));
          if (m?.t === 'r' && m.kind) show(m.kind as ReactionKind);
        } catch {}
      },
      { reliable: false },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useCallback(
    (kind: ReactionKind) => {
      show(kind);
      try {
        publishData(enc.encode(JSON.stringify({ t: 'r', kind })), { reliable: false });
      } catch {}
    },
    [publishData, show],
  );
}

/** The tappable reaction pills (👏 ❤️ 🔥 🎉). */
export const ReactionsBar = ({ onReact }: { onReact: (kind: ReactionKind) => void }) => (
  <View style={styles.bar}>
    {REACTIONS.map((r) => (
      <Pressable key={r.kind} style={styles.pill} onPress={() => onReact(r.kind)} hitSlop={6}>
        <Text style={styles.pillEmoji}>{r.emoji}</Text>
      </Pressable>
    ))}
  </View>
);

/**
 * Non-interactive layer that fills whatever frame it's dropped into (the host
 * video panel): every reaction plays its themed particle burst here. Measures
 * its own box so the bursts scale to the frame.
 */
export const ReactionsOverlay = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const bursts = useReactionStore((s) => s.bursts);
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size.width > 0
        ? bursts.map((b) => (
            <ReactionBurst key={b.id} id={b.id} kind={b.kind} width={size.width} height={size.height} />
          ))
        : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  pill: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a1830', borderWidth: 1, borderColor: '#2a3b57',
  },
  pillEmoji: { fontSize: 20, lineHeight: 24 },
});
