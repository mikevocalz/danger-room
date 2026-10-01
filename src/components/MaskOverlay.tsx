import React from 'react';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { frameToView, coverScale } from '@/roster/camera/frameToView';
import { COWL } from '@/roster/camera/cowlTemplate';
import type { FilteredFace } from '@/roster/camera/useMaskFilters';

const COWL_IMG = require('../../assets/models/wolverine_cowl.png');

function smoothAdaptive(
  current: number,
  next: number,
  epsilon: number,
  response: number,
  minAlpha: number,
  maxAlpha: number,
  frameScale: number,
): number {
  'worklet';
  const delta = next - current;
  const distance = Math.abs(delta);
  if (distance <= epsilon) return current;

  const motion = Math.min(distance / response, 1);
  const alpha60 = minAlpha + motion * (maxAlpha - minAlpha);
  // Keep the response stable on 60/90/120 Hz displays instead of making
  // high-refresh devices artificially laggier.
  const alpha = 1 - Math.pow(1 - alpha60, frameScale);
  return current + delta * alpha;
}

/**
 * The detector produces sparse targets (up to ~24 Hz). This component turns
 * those targets into display-rate motion entirely on the UI thread.
 *
 * That split is intentional: inference cadence is a power/thermal decision,
 * rendering cadence is a visual-quality decision. Reanimated can animate at the
 * screen refresh rate without asking ML Kit to run at 60/90/120 Hz.
 */
export const MaskOverlay = ({
  face,
  wellW,
  wellH,
  front = true,
}: {
  face: SharedValue<FilteredFace>;
  wellW: number;
  wellH: number;
  front?: boolean;
}) => {
  const cx = useSharedValue(0.5);
  const cy = useSharedValue(0.42);
  const iod = useSharedValue(0);
  const aspect = useSharedValue(1);
  const roll = useSharedValue(0);
  const yaw = useSharedValue(0);
  const pitch = useSharedValue(0);
  const initialized = useSharedValue(false);
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    () => wellW > 0 && face.value.present && face.value.iod > 0.02,
    (visible, previous) => {
      if (visible === previous) return;
      opacity.value = withTiming(visible ? 1 : 0, {
        duration: visible ? 70 : 110,
      });
    },
    [wellW],
  );

  useFrameCallback((frameInfo) => {
    'worklet';
    const target = face.value;
    if (!target.present || target.iod <= 0.02) {
      initialized.value = false;
      return;
    }

    if (!initialized.value) {
      cx.value = target.cx;
      cy.value = target.cy;
      iod.value = target.iod;
      aspect.value = target.aspect;
      roll.value = target.roll;
      yaw.value = target.yaw;
      pitch.value = target.pitch;
      initialized.value = true;
      return;
    }

    const dt = frameInfo.timeSincePreviousFrame ?? 16.667;
    const frameScale = Math.max(0.35, Math.min(2.5, dt / 16.667));

    cx.value = smoothAdaptive(cx.value, target.cx, 0.0008, 0.08, 0.14, 0.72, frameScale);
    cy.value = smoothAdaptive(cy.value, target.cy, 0.0008, 0.08, 0.14, 0.72, frameScale);
    iod.value = smoothAdaptive(iod.value, target.iod, 0.0005, 0.05, 0.12, 0.62, frameScale);
    roll.value = smoothAdaptive(roll.value, target.roll, 0.002, 0.35, 0.18, 0.72, frameScale);
    yaw.value = smoothAdaptive(yaw.value, target.yaw, 0.12, 18, 0.16, 0.68, frameScale);
    pitch.value = smoothAdaptive(pitch.value, target.pitch, 0.12, 14, 0.16, 0.68, frameScale);
    aspect.value = target.aspect;
  });

  const style = useAnimatedStyle(() => {
    const viewIod = iod.value * coverScale(aspect.value, wellW, wellH);
    const s = viewIod / COWL.iod;
    const p = frameToView(cx.value, cy.value, aspect.value, wellW, wellH, front);
    const rz = front ? -roll.value : roll.value;
    const yy = Math.max(-25, Math.min(25, front ? -yaw.value : yaw.value));
    const xx = Math.max(-15, Math.min(15, -pitch.value));

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: COWL.w,
      height: COWL.h,
      opacity: opacity.value,
      transform: [
        { perspective: 600 },
        { translateX: p.x - COWL.w / 2 },
        { translateY: p.y - COWL.h / 2 },
        { rotateZ: `${rz}rad` },
        { rotateY: `${yy}deg` },
        { rotateX: `${xx}deg` },
        { scale: s },
        { translateX: COWL.w / 2 - COWL.anchorX },
        { translateY: COWL.h / 2 - COWL.anchorY },
      ],
    };
  }, [wellW, wellH, front]);

  return <Animated.Image source={COWL_IMG} style={style} resizeMode="contain" />;
};
