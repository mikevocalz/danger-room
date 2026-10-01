import { Platform } from 'react-native';

/**
 * Publish-side pipeline selection.
 *
 * Fishjam 0.29.0 ships two publish paths in
 * `@fishjam-cloud/react-native-vision-camera-source`:
 *
 *   - `useVisionCameraSource`        — raw VisionCamera frames → Fishjam track
 *   - `useVisionCameraWebGpuSource`  — frames through a TypeGPU (WebGPU)
 *                                      pipeline first; iOS 17+ only
 *
 * The room's visual identity does NOT live here — the plate, seat marks, and
 * halos are SkSL on every viewer's device and stay consistent across the room.
 * The WebGPU grade is the *feed's* look: it's baked into the published track,
 * so every viewer sees it, but only capable publishers apply it. The grade is
 * therefore designed to be subtle enough that graded and ungraded feeds sit
 * side by side without the grid looking broken.
 *
 * ── SEAM ─────────────────────────────────────────────────────────────────────
 * The exact hook signatures for the 0.29.0 packages are not verifiable from
 * here (docs index lags the release). Everything below the `FishjamSeam`
 * boundary compiles against a declared interface; bind it to the real hooks
 * and check the shapes against the package's shipped .d.ts before running.
 * Nothing outside the seam needs to change when you do.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PublishPipeline {
  kind: 'webgpu' | 'plain';
  /** Why this pipeline was selected — surfaced in the room debug panel. */
  reason: string;
}

const IOS_WEBGPU_FLOOR = 17;

export function selectPublishPipeline(): PublishPipeline {
  if (Platform.OS !== 'ios') {
    return { kind: 'plain', reason: `webgpu source is iOS-only (${Platform.OS})` };
  }
  const major = parseInt(String(Platform.Version), 10);
  if (Number.isNaN(major) || major < IOS_WEBGPU_FLOOR) {
    return {
      kind: 'plain',
      reason: `iOS ${Platform.Version} < ${IOS_WEBGPU_FLOOR}`,
    };
  }
  return { kind: 'webgpu', reason: `iOS ${Platform.Version} supports TypeGPU path` };
}

/* ── FishjamSeam ──────────────────────────────────────────────────────────── */

/**
 * VERIFY-BEFORE-RUN: bind these to the real exports of
 * `@fishjam-cloud/react-native-vision-camera-source` and confirm each shape
 * against the installed package's types. Names follow the 0.29.0 release
 * notes; parameters are this app's assumption, not a confirmed API.
 */
export interface FishjamSeam {
  useVisionCameraSource: (options?: unknown) => unknown;
  useVisionCameraWebGpuSource: (options?: unknown) => unknown;
}

let seam: FishjamSeam | null = null;

/** Call once at startup with the real package's hooks. */
export function bindFishjamSeam(impl: FishjamSeam): void {
  seam = impl;
}

export function getFishjamSeam(): FishjamSeam {
  if (!seam) {
    throw new Error(
      '[publish] Fishjam seam unbound. Call bindFishjamSeam() with the hooks ' +
        'from @fishjam-cloud/react-native-vision-camera-source at startup.',
    );
  }
  return seam;
}
