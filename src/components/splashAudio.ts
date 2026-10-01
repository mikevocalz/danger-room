import { Image } from 'react-native';

// The theme. `xtheme_intro.wav` is a clean 6s HEAD of `xtheme.wav` — it decodes
// in <1s so it can start on the very first splash frame with no wait, while the
// full 64s track (~5s to decode) loads in the background and takes over exactly
// where the intro ends. Same track, so the handoff is seamless.
const INTRO = require('../../assets/audio/xtheme_intro.wav');
const THEME = require('../../assets/audio/xtheme.wav');

let ctx: any = null;
let source: any = null;
let gain: any = null;

/** Start the theme immediately (no decode delay): play the short intro at once,
 *  then continue with the full track from the intro's end. Stereo is played
 *  straight through (no panner) so the file's own channels are preserved.
 *  Defensive: no-op if the native audio module isn't in this build. */
export async function startTheme(): Promise<void> {
  try {
    const { AudioContext, decodeAudioData } = require('react-native-audio-api');
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(ctx.destination);

    const introAsset = Image.resolveAssetSource(INTRO);
    const fullAsset = Image.resolveAssetSource(THEME);
    if (!introAsset?.uri || !fullAsset?.uri) throw new Error('theme assets unavailable');
    const introUri = introAsset.uri;
    const fullUri = fullAsset.uri;

    // Intro: tiny file, decodes fast → audible on the first frame.
    const introBuf = await decodeAudioData(introUri);
    const startAt = ctx.currentTime + 0.02;
    const intro = ctx.createBufferSource();
    intro.buffer = introBuf;
    intro.connect(gain);
    intro.start(startAt);
    source = intro;
    const introLen = introBuf.duration;

    // Full theme decodes while the intro plays, then starts at the intro's end
    // (offset = intro length, since the intro is the theme's head) → seamless.
    decodeAudioData(fullUri)
      .then((fullBuf: any) => {
        const full = ctx.createBufferSource();
        full.buffer = fullBuf;
        full.connect(gain);
        full.start(startAt + introLen, introLen);
        source = full;
      })
      .catch((e: unknown) => console.warn('[splash] full theme decode failed', e));
  } catch (e) {
    console.warn('[splash] audio unavailable', e);
  }
}

/** Hard-stop the theme immediately. */
export function stopTheme(): void {
  try {
    source?.stop?.();
  } catch {}
  try {
    ctx?.close?.();
  } catch {}
  ctx = source = gain = null;
}

/** Fade the theme out over `seconds`, then stop. */
export function fadeOutTheme(seconds: number): void {
  try {
    if (gain && ctx) {
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value ?? 1, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + seconds);
    }
  } catch {}
  setTimeout(stopTheme, Math.max(0, seconds) * 1000 + 250);
}
