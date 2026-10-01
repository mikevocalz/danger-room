import { Image } from 'react-native';

/**
 * Spatial X-Men theme for the XR conference — modeled on poke-xr's theme-audio.
 * Viro/GVR spatial audio (ViroSpatialSound/ViroSoundField) is SILENT on the
 * Quest/PICO OpenXR backend (verified in poke-xr), so we spatialize through
 * react-native-audio-api instead:
 *   BufferSource(once) → StereoPanner(azimuth) → Gain(distance) → destination
 * i.e. head-tracked azimuth panning + inverse-distance attenuation (not HRTF —
 * rn-audio-api ships only StereoPannerNode, no PannerNode).
 */
const THEME = require('../../assets/audio/xtheme.wav');
const THEME_VOLUME = 0.5;
const REF_DIST_M = 1.9; // host-stage radius: full level within, falloff beyond

type Vec3 = [number, number, number];
export type ThemeState = 'idle' | 'playing';

/**
 * ALL mutable audio state lives on globalThis, not module scope: Metro Fast
 * Refresh re-evaluates this module with a FRESH scope while the old native
 * AudioContext keeps playing — module-scope state "forgets" the live source and
 * the next start() overlaps it (the "two themes playing at once" bug). The
 * globalThis singleton survives re-eval, so the source guard always sees the
 * truth. It also bridges MainActivity ↔ VRActivity (one Hermes engine).
 */
type Core = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any; buffer: any; source: any; panner: any; gain: any;
  starting: boolean;
  endTimer: ReturnType<typeof setTimeout> | null;
  state: ThemeState;
  listeners: Set<(s: ThemeState) => void>;
  sourcePos: Vec3;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const core: Core = ((globalThis as any).__xrThemeCore ??= {
  ctx: null,
  buffer: null,
  source: null,
  panner: null,
  gain: null,
  starting: false,
  endTimer: null,
  state: 'idle',
  listeners: new Set(),
  sourcePos: [-0.95, -0.1, -1.65], // host stage (left)
});

function setThemeState(s: ThemeState): void {
  core.state = s;
  core.listeners.forEach((l) => l(s));
}
export function getThemeState(): ThemeState {
  return core.state;
}
/** Subscribe to play-state changes; returns unsubscribe. */
export function onThemeState(l: (s: ThemeState) => void): () => void {
  core.listeners.add(l);
  return () => {
    core.listeners.delete(l);
  };
}

/** World position the theme emits from — default: the host stage (left). */
export function setThemePosition(p: Vec3): void {
  core.sourcePos = p;
}

/** Start the theme (plays ONCE). Idempotent — a call while playing is a no-op. */
export async function startTheme(): Promise<void> {
  if (core.source || core.starting) return;
  core.starting = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AudioContext, decodeAudioData } = require('react-native-audio-api');
    core.ctx ??= new AudioContext();
    if (core.ctx.state === 'suspended') await core.ctx.resume();
    core.buffer ??= await decodeAudioData(Image.resolveAssetSource(THEME).uri);
    if (!core.starting) return; // lost the race with stopTheme() during decode
    core.gain = core.ctx.createGain();
    core.gain.gain.value = THEME_VOLUME;
    core.panner = core.ctx.createStereoPanner();
    const src = core.ctx.createBufferSource();
    src.buffer = core.buffer;
    src.loop = false; // play once — REPLAY re-triggers
    src.connect(core.panner);
    core.panner.connect(core.gain);
    core.gain.connect(core.ctx.destination);
    src.start(core.ctx.currentTime);
    core.source = src;
    setThemeState('playing');
    // Track natural end so the button flips back to REPLAY and the next start
    // isn't blocked by a stale source guard.
    if (core.endTimer) clearTimeout(core.endTimer);
    core.endTimer = setTimeout(() => {
      core.source = null;
      setThemeState('idle');
    }, (core.buffer?.duration ?? 0) * 1000 + 250);
  } catch (e) {
    if (__DEV__) console.log('[xr] theme failed to start', e);
    setThemeState('idle');
  } finally {
    core.starting = false;
  }
}

/**
 * Fed the head transform each frame (onCameraTransformUpdate): pans the theme by
 * the azimuth of head→source and attenuates by distance, so the theme holds its
 * world position (front-left, at the host stage) as the head turns.
 */
export function updateListener(camPos: number[], camForward: number[]): void {
  if (!core.panner || !core.gain) return;
  const dx = core.sourcePos[0] - camPos[0];
  const dy = core.sourcePos[1] - camPos[1];
  const dz = core.sourcePos[2] - camPos[2];
  const dist = Math.hypot(dx, dy, dz) || 0.001;
  // right = normalize(forward × up), up = [0,1,0] → [-fz, 0, fx]
  let rx = -camForward[2];
  let rz = camForward[0];
  const rlen = Math.hypot(rx, rz) || 0.001;
  rx /= rlen;
  rz /= rlen;
  const pan = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist));
  core.panner.pan.value = pan;
  core.gain.gain.value = THEME_VOLUME * Math.min(1, REF_DIST_M / dist);
}

/** Stop whatever is playing (never leaves an orphan voice behind). */
function killSource(): void {
  if (core.endTimer) clearTimeout(core.endTimer);
  core.endTimer = null;
  try {
    core.source?.stop?.();
  } catch {
    // already stopped
  }
  core.source = null;
  core.panner = null;
  core.gain = null;
}

/** Replay from the top: stop the current voice (if any) and start again. */
export function restartTheme(): void {
  if (__DEV__) console.log('[xr] restartTheme (state was', core.state, ')');
  core.starting = false; // never let a stale in-flight start block the restart
  killSource();
  void startTheme();
}

/** Stop + release; context suspended (not closed) so re-entry reuses the buffer. */
export function stopTheme(): void {
  core.starting = false;
  killSource();
  setThemeState('idle');
  try {
    core.ctx?.suspend?.();
  } catch {
    // ignore
  }
}
