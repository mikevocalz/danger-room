import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Shadow,
  SweepGradient,
  Text as SkText,
  useClock,
  useFont,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { makeCircledX } from '@/roster/glyphs';

const mark = makeCircledX({
  ringRadius: 42,
  ringWidth: 8,
  ringGap: 0,
  armSpan: 33,
  armWidthCenter: 7,
  armWidthOuter: 13,
});

const HOLD_MS = 8000; // splash on-screen time before it clears
const FADE_MS = 1300;

// The room's sci-fi Megalopolis face — same asset the plate headers use.
const TITLE_TTF = require('../../assets/fonts/MegalopolisX.ttf');

/**
 * Cerebro-style splash: a brushed-metal circled-X (X-Men door) over a dark
 * chamber, with the theme playing from the first frame and fading as it clears.
 */
export const DangerRoomSplash = ({ onDone }: { onDone: () => void }) => {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2 - 20;
  const R = Math.min(width, height) * 0.32;
  const clock = useClock();
  const titleFont = useFont(TITLE_TTF, 40);

  const progress = useSharedValue(0); // 0→1 entrance
  const opacity = useSharedValue(1); // 1→0 exit
  const titleReveal = useSharedValue(0); // 0→1 liquid-metal title reveal

  // Safety net: if the font never resolves (dev fetch stall), still reveal the
  // disc and dismiss so the splash can't hang.
  useEffect(() => {
    const hard = setTimeout(() => {
      if (progress.value === 0) {
        progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      }
      opacity.value = withTiming(0, { duration: FADE_MS }, (fin) => fin && runOnJS(onDone)());
    }, HOLD_MS + 4000);
    return () => clearTimeout(hard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In dev the Megalopolis TTF is fetched over the bundler (~2s), so gate the
  // DISC entrance on it too — the silver chamber shows immediately (covering the
  // room), then the disc and "DANGER ROOM" animate in TOGETHER once the font is
  // ready. No disc-without-title gap, and the title never arrives late.
  useEffect(() => {
    if (!titleFont) return;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    titleReveal.value = withDelay(80, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(onDone)();
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleFont]);

  // Disc scales in (no rotation — the X-arms swinging past the fixed blue core
  // read as the core drifting off-centre during the entrance).
  const discTransform = useDerivedValue(() => [
    { scale: 0.7 + progress.value * 0.3 },
  ]);
  const rootOpacity = useDerivedValue(() => opacity.value);
  // Live brushed-metal chamber — the sheen rotates slowly behind the disc.
  const bgTransform = useDerivedValue(() => [{ rotate: clock.value / 7000 }]);
  // Blue Cerebro-core pulse.
  const coreR = useDerivedValue(() => R * 0.12 * (1 + Math.sin(clock.value / 380) * 0.14));
  // Liquid-metal title: reveal + a bright highlight sweeping across the letters.
  const titleOpacity = useDerivedValue(() => titleReveal.value * opacity.value);
  const titleTransform = useDerivedValue(() => [{ translateY: (1 - titleReveal.value) * 16 }]);
  const shine = useDerivedValue(() => {
    const b = 0.2 + (Math.sin(clock.value / 620) * 0.5 + 0.5) * 0.6;
    return [b - 0.18, b, b + 0.18];
  });
  // Fade the whole opaque splash out (its solid bg covers the room from frame 1,
  // so the room never flashes underneath before the Skia canvas draws).
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const scale = R / 50; // glyph authored in a 100-box
  const gx = cx - scale * 50;
  const gy = cy - scale * 50;

  const title = 'DANGER ROOM';
  const tw = titleFont ? titleFont.measureText(title).width : 0;
  const ty = cy + R + 64;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#c2c6cb' }, fadeStyle]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={rootOpacity}>
          {/* Brushed-metal chamber (silver) */}
          <Fill>
            <SweepGradient
              c={vec(cx, cy)}
              colors={['#b9bfc7', '#eef1f4', '#8f959d', '#e6e9ee', '#a4aab2', '#eef1f4', '#b9bfc7']}
            />
          </Fill>
          {/* Vignette so the disc still reads against the metal. */}
          <Fill opacity={0.32}>
            <RadialGradient
              c={vec(cx, cy)}
              r={Math.max(width, height) * 0.72}
              colors={['#00000000', '#000000cc']}
            />
          </Fill>

          <Group origin={vec(cx, cy)} transform={discTransform}>
            {/* Brushed-metal disc */}
            <Circle cx={cx} cy={cy} r={R}>
              <SweepGradient
                c={vec(cx, cy)}
                colors={['#9aa0a8', '#e9edf1', '#7f858d', '#f2f5f8', '#8b9199', '#e9edf1', '#9aa0a8']}
              />
              <Shadow dx={0} dy={6} blur={22} color="#000000cc" />
            </Circle>
            <Circle cx={cx} cy={cy} r={R} style="stroke" strokeWidth={R * 0.03} color="#5c6169" />

            {/* Circled-X, brushed + embossed */}
            <Group transform={[{ translateX: gx }, { translateY: gy }, { scale }]}>
              <Path path={mark.path} color="#3c4046" transform={[{ translateX: 1.2 }, { translateY: 1.4 }]} />
              <Path path={mark.path}>
                <SweepGradient
                  c={vec(50, 50)}
                  colors={['#cfd4da', '#ffffff', '#aeb4bc', '#ffffff', '#cfd4da']}
                />
              </Path>
            </Group>

            {/* Cerebro blue core */}
            <Circle cx={cx} cy={cy} r={coreR} color="#43c8ff">
              <Blur blur={10} />
            </Circle>
            <Circle cx={cx} cy={cy} r={R * 0.05} color="#eaffff" />
          </Group>

          {/* Title — liquid metal with a reveal + sweeping highlight. */}
          {titleFont ? (
            <Group opacity={titleOpacity} origin={vec(cx, ty)} transform={titleTransform}>
              {/* Dark embossed base so the gold reads against the silver chamber. */}
              <SkText x={cx - tw / 2 + 2} y={ty + 2} text={title} font={titleFont} color="#3a2708" />
              {/* Liquid-metal GOLD: deep gold → bright highlight sweep → deep gold. */}
              <SkText x={cx - tw / 2} y={ty} text={title} font={titleFont}>
                <LinearGradient
                  start={vec(cx - tw / 2, ty - 30)}
                  end={vec(cx + tw / 2, ty)}
                  colors={['#8a5c0c', '#ffe680', '#9a6a10']}
                  positions={shine}
                />
                <Shadow dx={0} dy={3} blur={7} color="#000000aa" />
              </SkText>
            </Group>
          ) : null}
        </Group>
      </Canvas>
    </Animated.View>
  );
};

// A plain View wrapper keeps the splash above the app while mounted.
export const SplashHost = ({ children }: { children: React.ReactNode }) => (
  <View style={StyleSheet.absoluteFill}>{children}</View>
);
