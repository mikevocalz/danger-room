import { Image, NativeModules, Platform } from 'react-native';
import { COWL } from './cowlTemplate';

/**
 * §6.9 — publish-side cowl bridge. Feeds the NATIVE GL compositor patched into
 * @fishjam-cloud/react-native-webrtc (patches/), which bakes the face-tracked
 * cowl into the published video track so REMOTE peers see it — the Reanimated
 * MaskOverlay remains the LOCAL preview only. Android-only by design (the patch
 * is Android GL); every entry point no-ops via optional chaining + Platform
 * check when the module or methods are absent (iOS, web, unpatched build).
 *
 * Protocol: overlaySetImage ships the template PNG (base64) + the SAME solved
 * template numbers as cowlTemplate.ts, once per session; overlaySetFace streams
 * frame-normalized channels at the detector rate (~26Hz); overlaySetEnabled
 * gates compositing so a disabled mask costs nothing on the encode path.
 */
type CowlCompositor = {
  overlaySetImage?: (
    base64Png: string, imgW: number, imgH: number,
    tplIod: number, anchorX: number, anchorY: number,
  ) => void;
  overlaySetFace?: (present: boolean, cx: number, cy: number, iod: number, roll: number) => void;
  overlaySetEnabled?: (enabled: boolean) => void;
};

const native: CowlCompositor | undefined =
  Platform.OS === 'android' ? (NativeModules.WebRTCModule as CowlCompositor | undefined) : undefined;

/**
 * Whether the native publish-side compositor drives the cowl.
 *
 * When true, the cowl is baked into the PUBLISHED track (remote peers see it)
 * and — because the self-view renders that same publish stream — the local
 * preview shows the identical baked cowl. MaskOverlay is gated OFF on this flag
 * (room.tsx), otherwise the preview draws a second cowl on top.
 *
 * Registration history: the compositor originally painted MLKit's
 * rotation-corrected upright coords straight into the sensor-oriented buffer
 * (VideoFrame rotates downstream) → rotated ~90°, ~1.78x oversized, offset.
 * Fixed in the webrtc patch: buildOverlayTransform now maps upright → buffer by
 * the inverse of the frame rotation (points, roll and the iod scale axis).
 */
export const HAS_PUBLISH_COWL = !!native?.overlaySetEnabled;

/** Template PNG → base64 via Metro/asset URI (fetch → blob → FileReader). */
async function loadCowlBase64(): Promise<string> {
  const src = Image.resolveAssetSource(require('../../../assets/models/wolverine_cowl.png'));
  const blob = await (await fetch(src.uri)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('cowl asset read failed'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1); // strip data:image/png;base64,
}

/** Sent-at-most-once-per-session gate; reset on failure so enable can retry. */
let imageSent: Promise<void> | null = null;

/** Upload the template (first call only) and switch the compositor on. */
export async function enablePublishCowl(): Promise<void> {
  if (!HAS_PUBLISH_COWL) return; // misregistered — see HAS_PUBLISH_COWL
  if (!native?.overlaySetEnabled) return; // iOS / unpatched — no-op
  if (!imageSent) {
    imageSent = loadCowlBase64().then((b64) => {
      native.overlaySetImage?.(b64, COWL.w, COWL.h, COWL.iod, COWL.anchorX, COWL.anchorY);
    });
    imageSent.catch(() => { imageSent = null; });
  }
  await imageSent;
  native.overlaySetEnabled(true);
}

/** Switch the compositor off (template stays cached native-side). */
export function disablePublishCowl(): void {
  try {
    native?.overlaySetEnabled?.(false);
  } catch {}
}

/** ~26Hz hot path — one guarded bridge call per detector tick, never throws. */
export function pushCowlFace(f: {
  present: boolean; cx: number; cy: number; iod: number; roll: number;
}): void {
  try {
    native?.overlaySetFace?.(f.present, f.cx, f.cy, f.iod, f.roll);
  } catch {}
}
