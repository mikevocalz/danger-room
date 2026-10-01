import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Motion } from '@legendapp/motion';

import { EMOJI, useReactionStore, type ReactionKind } from '@/stores/reactionStore';

/**
 * Themed emoji burst — one creative "explosion" per reaction, rendered as native
 * RN Text driven by Reanimated (Legend Motion) so it's smooth and never fights
 * the WebGPU showcase / camera for a GPU surface:
 *   🎉 party → a shower of 🎉 raining down
 *   ❤️ heart → hearts drifting up and out
 *   🔥 fire  → embers shooting up and shrinking
 *   👏 clap  → 👏 bursting radially from the centre
 */

interface Cfg {
  count: number;
  life: number;
  size: [number, number];
  /** Per-particle spawn point + travel vector, as fractions of the frame. */
  make: (w: number, h: number) => { left: number; top: number; dx: number; dy: number };
  spinDeg: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Live-stream style: every reaction rises UP through the video feed from near the
// bottom and fades out — always visible inside the frame, never falling out under
// the controls bar.
// Spawn just ABOVE the floating control bar (~bottom third) and rise up the feed.
const CFG: Record<ReactionKind, Cfg> = {
  party: {
    count: 16, life: 2600, size: [22, 36], spinDeg: 200,
    make: (w, h) => ({ left: rnd(w * 0.12, w * 0.88), top: h * 0.6, dx: rnd(-1, 1) * w * 0.2, dy: -h * 0.5 }),
  },
  heart: {
    count: 12, life: 2500, size: [24, 42], spinDeg: 30,
    make: (w, h) => ({ left: rnd(w * 0.32, w * 0.68), top: h * 0.6, dx: rnd(-1, 1) * w * 0.24, dy: -h * 0.5 }),
  },
  fire: {
    count: 14, life: 1700, size: [20, 36], spinDeg: 24,
    make: (w, h) => ({ left: rnd(w * 0.2, w * 0.8), top: h * 0.62, dx: rnd(-1, 1) * w * 0.12, dy: -h * 0.52 }),
  },
  clap: {
    count: 12, life: 1900, size: [22, 36], spinDeg: 120,
    make: (w, h) => ({ left: rnd(w * 0.2, w * 0.8), top: h * 0.6, dx: rnd(-1, 1) * w * 0.32, dy: -h * 0.5 }),
  },
};

interface P {
  left: number; top: number; dx: number; dy: number; size: number; rot: number; delay: number;
}

const Fly = ({ emoji, p, life }: { emoji: string; p: P; life: number }) => (
  <Motion.View
    style={[styles.fly, { left: p.left, top: p.top }]}
    initial={{ opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.4 }, { rotate: '0deg' }] }}
    animate={{ opacity: 1, transform: [{ translateX: p.dx }, { translateY: p.dy }, { scale: 1.05 }, { rotate: `${p.rot}deg` }] }}
    transition={{ type: 'timing', duration: life, delay: p.delay }}
  >
    <Text style={{ fontSize: p.size }}>{emoji}</Text>
  </Motion.View>
);

/** One themed burst, sized to the frame it's dropped in; self-removes when done. */
export const ReactionBurst = ({
  id, kind, width, height,
}: {
  id: number; kind: ReactionKind; width: number; height: number;
}) => {
  const cfg = CFG[kind];
  const emoji = EMOJI[kind];
  const parts = useMemo<P[]>(
    () =>
      Array.from({ length: cfg.count }, () => {
        const m = cfg.make(width, height);
        return {
          ...m,
          size: rnd(cfg.size[0], cfg.size[1]),
          rot: rnd(-1, 1) * cfg.spinDeg,
          delay: Math.random() * 120,
        };
      }),
    [kind, width, height],
  );

  const end = useReactionStore((s) => s.end);
  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    const t = setTimeout(() => endRef.current(id), cfg.life + 250);
    return () => clearTimeout(t);
  }, [id, cfg.life]);

  if (width <= 0) return null;
  return (
    <>
      {parts.map((p, i) => (
        <Fly key={i} emoji={emoji} p={p} life={cfg.life} />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  fly: { position: 'absolute' },
});
