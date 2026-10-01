/**
 * Frame→view registration (§3.4). The preview renders the published camera track
 * with objectFit:"cover" (aspect-fill) and the front camera is mirrored, so a
 * frame-normalized point (0..1) must be pushed through the SAME uniform-scale
 * fill + symmetric crop + horizontal mirror to land where the face actually is in
 * the well. No fudge factors — every term is the cover transform.
 *
 * Worklet: called from the overlay's useAnimatedStyle on the UI thread.
 *
 * @param nx,ny   frame-normalized anchor (0..1)
 * @param aspect  frameWidth / frameHeight
 * @param wellW,wellH  the video well size in px
 * @param front   front camera → mirror x
 */
export function frameToView(
  nx: number,
  ny: number,
  aspect: number,
  wellW: number,
  wellH: number,
  front: boolean,
): { x: number; y: number } {
  'worklet';
  const wellAspect = wellW / wellH;
  let x: number;
  let y: number;
  if (aspect > wellAspect) {
    // Frame wider than the well → cropped left/right; vertical maps 1:1.
    const visible = wellAspect / aspect; // fraction of frame width kept
    const crop = (1 - visible) / 2;
    x = ((nx - crop) / visible) * wellW;
    y = ny * wellH;
  } else {
    // Frame taller than the well → cropped top/bottom; horizontal maps 1:1.
    const visible = aspect / wellAspect; // fraction of frame height kept
    const crop = (1 - visible) / 2;
    x = nx * wellW;
    y = ((ny - crop) / visible) * wellH;
  }
  if (front) x = wellW - x; // front-camera mirror
  return { x, y };
}

/**
 * Scale factor from a frame-normalized X distance (e.g. interocular distance /
 * frameWidth) to view px under the SAME cover transform as frameToView. When the
 * frame is wider than the well, cover scales by aspect/wellAspect > 1 — using
 * plain wellW under-sizes anything scaled by a frame-normalized distance.
 */
export function coverScale(aspect: number, wellW: number, wellH: number): number {
  'worklet';
  const wellAspect = wellW / wellH;
  return aspect > wellAspect ? wellW * (aspect / wellAspect) : wellW;
}
