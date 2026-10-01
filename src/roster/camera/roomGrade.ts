/**
 * The room grade: the look applied to *outgoing* frames on WebGPU-capable
 * publishers. Deliberately subtle — a gentle S-curve lift, mild saturation,
 * and a soft vignette — so graded (iOS 17+) and ungraded (everything else)
 * feeds can share a grid without reading as different rooms.
 *
 * Authored as a WGSL fragment stage. TypeGPU pipelines embed WGSL functions;
 * hand `ROOM_GRADE_WGSL` to the pipeline you build for
 * `useVisionCameraWebGpuSource` (see the SEAM note in publishPipeline.ts) and
 * bind `RoomGradeParams` as its uniform buffer.
 */

export interface RoomGradeParams {
  /** 0 disables the grade entirely (bypass). */
  strength: number;
  /** 1 = neutral. */
  saturation: number;
  /** 0..1 vignette darkness at the corners. */
  vignette: number;
  /** Warm/cool shift, -1..1. */
  temperature: number;
}

export const defaultRoomGrade: RoomGradeParams = {
  strength: 0.85,
  saturation: 1.08,
  vignette: 0.22,
  temperature: 0.06,
};

export const ROOM_GRADE_WGSL = /* wgsl */ `
struct GradeParams {
  strength    : f32,
  saturation  : f32,
  vignette    : f32,
  temperature : f32,
};

fn luma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

// Filmic-ish S curve: lifts shadows slightly, rolls highlights off.
fn sCurve(x: vec3f) -> vec3f {
  return x * x * (3.0 - 2.0 * x);
}

/// color: source pixel, uv: 0..1, params: bound uniforms.
fn roomGrade(color: vec3f, uv: vec2f, params: GradeParams) -> vec3f {
  var c = clamp(color, vec3f(0.0), vec3f(1.0));

  // Tone curve.
  let curved = sCurve(c);

  // Saturation around luma.
  let l = vec3f(luma(curved));
  var graded = mix(l, curved, params.saturation);

  // Temperature: nudge red/blue in opposition.
  graded.r += params.temperature * 0.04;
  graded.b -= params.temperature * 0.04;

  // Vignette.
  let d = distance(uv, vec2f(0.5));
  let vig = 1.0 - params.vignette * smoothstep(0.45, 0.85, d);
  graded *= vig;

  // Bypass blend.
  return clamp(mix(c, graded, params.strength), vec3f(0.0), vec3f(1.0));
}
`;
