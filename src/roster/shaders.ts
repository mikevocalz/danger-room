import { Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';

/**
 * SkSL for the room's presentation layer. These run on the *chrome* only —
 * Skia cannot sample the live video texture, so nothing here touches a feed.
 *
 * Coordinate contract: every effect takes uRect = (x, y, w, h) of the region
 * it paints, in Canvas coordinates, and normalises internally. uTime is
 * seconds.
 */

/**
 * Unclaimed-seat interior: powered-but-unoccupied.
 *
 * - Slow breathing radial glow keyed to the seatGlow pair
 * - CRT scanlines with a faint roll
 * - Chromatic drift at the edges so the void reads as a signal, not paint
 * - Vignette to seat it inside the bevel well
 */
const SEAT_VOID_SKSL = `
uniform float uTime;
uniform float4 uRect;      // x, y, w, h
uniform half4  uBase;      // seatVoid
uniform half4  uGlowA;     // seatGlow[0]
uniform half4  uGlowB;     // seatGlow[1]

half4 main(float2 xy) {
  float2 uv = (xy - uRect.xy) / uRect.zw;   // 0..1 in the hole
  float2 p  = uv - 0.5;
  float  r  = length(p);

  // Breathing radial glow, phase-split across the two neon stops.
  float breathe = 0.5 + 0.5 * sin(uTime * 0.9);
  float glow    = smoothstep(0.75, 0.0, r) * (0.10 + 0.10 * breathe);
  half3 glowCol = mix(uGlowA.rgb, uGlowB.rgb, uv.x + 0.15 * sin(uTime * 0.4));

  // Scanlines with a slow vertical roll.
  float roll = fract(uTime * 0.03);
  float line = 0.5 + 0.5 * sin((uv.y + roll) * uRect.w * 1.6);
  float scan = mix(0.92, 1.0, line);

  // Chromatic drift: nudge the glow's red/blue apart near the edges.
  float edge = smoothstep(0.30, 0.55, r);
  half3 col  = uBase.rgb * scan + glowCol * glow;
  col.r += edge * glow * 0.6 * uGlowA.r;
  col.b += edge * glow * 0.6 * uGlowB.b;

  // Vignette into the bevel.
  float vig = smoothstep(0.85, 0.45, r);
  col *= mix(0.65, 1.0, vig);

  return half4(col, 1.0);
}
`;

/**
 * Neon sweep for the seat mark's fill: the base gradient with a bright band
 * migrating along the diagonal, plus a subtle shimmer so the mark never sits
 * fully still while the seat waits.
 */
const MARK_SWEEP_SKSL = `
uniform float uTime;
uniform float4 uRect;      // glyph bounds in Canvas coordinates
uniform half4  uGlowA;
uniform half4  uGlowB;

half4 main(float2 xy) {
  float2 uv = (xy - uRect.xy) / uRect.zw;

  // Base diagonal gradient.
  float t    = clamp((uv.x + uv.y) * 0.5, 0.0, 1.0);
  half3 base = mix(uGlowA.rgb, uGlowB.rgb, t);

  // Sweeping highlight band along the same diagonal.
  float sweep = fract(uTime * 0.25);
  float d     = abs(t - sweep);
  float band  = smoothstep(0.18, 0.0, min(d, 1.0 - d));

  // Fine shimmer so arms feel lit, not printed.
  float shimmer = 0.06 * sin((uv.x - uv.y) * 40.0 + uTime * 3.0);

  half3 col = base + band * 0.55 + shimmer;
  return half4(col, 1.0);
}
`;

/**
 * The host screen at rest: a lit purple field falling to indigo at the edges,
 * with a magenta bloom riding the bottom edge and a faint CRT wash. Video
 * covers this once the host publishes — it is the plate's idle state, not a
 * layer over the feed.
 */
const HOST_SCREEN_SKSL = `
uniform float uTime;
uniform float4 uRect;      // x, y, w, h
uniform half4  uHi;        // screenHi
uniform half4  uLo;        // screenLo
uniform half4  uBloom;     // screenBloom
uniform float  uLife;      // 0 = flat, 1 = full breathe

half4 main(float2 xy) {
  float2 uv = (xy - uRect.xy) / uRect.zw;

  // Lit centre, biased slightly above middle like a CRT's hot spot.
  float2 c = float2(0.5, 0.42);
  float  d = distance(uv, c) * 1.25;
  float  breathe = 1.0 + uLife * 0.05 * sin(uTime * 0.7);
  float  fall = smoothstep(1.0, 0.0, d) * breathe;

  half3 col = mix(uLo.rgb, uHi.rgb, clamp(fall, 0.0, 1.0));

  // Magenta bloom hugging the bottom edge.
  float bloom = smoothstep(0.82, 1.0, uv.y) * 0.55;
  col = mix(col, uBloom.rgb, bloom * (0.6 + 0.4 * uLife));

  // Cool cast into the lower-left corner, as in the reference plate.
  float cool = smoothstep(0.55, 1.0, uv.y) * smoothstep(0.55, 0.0, uv.x);
  col.b += cool * 0.10;

  // Very fine phosphor wash — keeps a large flat field from banding.
  float wash = 0.012 * sin(uv.y * uRect.w * 1.2);
  col += wash;

  return half4(col, 1.0);
}
`;

/**
 * Brushed plate metal. One compiled effect serves both finishes — silver and
 * gold differ only in their uLo/uHi stops, which is what makes a claimed seat
 * read as the same object in a different material rather than a new widget.
 *
 * uSheen 0 keeps the plate perfectly static, so Skia can cache the whole tile
 * and eight vacant seats cost nothing per frame.
 */
const PLATE_METAL_SKSL = `
uniform float4 uRect;    // x, y, w, h
uniform half4  uLo;
uniform half4  uHi;
uniform float  uTime;
uniform float  uSheen;   // 0 = static, 1 = drifting sheen

float mhash(float n) {
  return fract(sin(n * 12.9898) * 43758.5453);
}

half4 main(float2 xy) {
  float2 uv = (xy - uRect.xy) / uRect.zw;

  // Broad diagonal sheen: light from the upper left.
  float drift = uSheen * 0.12 * sin(uTime * 0.25);
  float sheen = clamp(uv.x * 0.62 + (1.0 - uv.y) * 0.38 + drift, 0.0, 1.0);
  sheen = smoothstep(0.04, 0.96, sheen);

  half3 col = mix(uLo.rgb, uHi.rgb, sheen);

  // Horizontal brushing — two octaves of per-row jitter.
  float row = floor((xy.y - uRect.y) * 1.6);
  float brush = mhash(row) * 0.6 + mhash(row * 3.1 + 7.0) * 0.4;
  col *= 0.955 + brush * 0.09;

  // The plate's own curvature: lifts at the top, falls at the bottom.
  col += smoothstep(0.34, 0.0, uv.y) * 0.055;
  col -= smoothstep(0.72, 1.0, uv.y) * 0.075;

  return half4(clamp(col, half3(0.0), half3(1.0)), 1.0);
}
`;

function compile(name: string, source: string): SkRuntimeEffect {
  const effect = Skia.RuntimeEffect.Make(source);
  if (!effect) {
    throw new Error(`[roster] SkSL failed to compile: ${name}`);
  }
  return effect;
}

export const seatVoidEffect = compile('seatVoid', SEAT_VOID_SKSL);
export const markSweepEffect = compile('markSweep', MARK_SWEEP_SKSL);
export const hostScreenEffect = compile('hostScreen', HOST_SCREEN_SKSL);
export const plateMetalEffect = compile('plateMetal', PLATE_METAL_SKSL);

/** '#RRGGBB' → half4 uniform tuple. */
export function rgba(hex: string, alpha = 1): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [
    ((n >> 16) & 0xff) / 255,
    ((n >> 8) & 0xff) / 255,
    (n & 0xff) / 255,
    alpha,
  ];
}
