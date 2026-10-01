import type { ReservedRegion, FoldOrientation, FoldState } from './reserved-regions.types';
export type FoldPosture = 'flat' | 'book' | 'tabletop';
export interface FoldLayout {
  orientation: FoldOrientation; state: FoldState; posture: FoldPosture;
  occlusionType?: 'none' | 'full'; separating: boolean;
  x: number; y: number; width: number; height: number;
}
export function foldLayoutsFromRegions(
  regions: readonly ReservedRegion[], windowOriginX = 0, windowOriginY = 0,
): FoldLayout[] {
  return regions.filter((r) => r.kind === 'division').map((region) => {
    const orientation: FoldOrientation = region.orientation ?? (region.height >= region.width ? 'vertical' : 'horizontal');
    const state: FoldState = region.state ?? 'flat';
    const posture: FoldPosture = state === 'halfOpened' ? (orientation === 'horizontal' ? 'tabletop' : 'book') : 'flat';
    return {
      orientation, state, posture, occlusionType: region.occlusionType,
      separating: (region.separating ?? region.active) || region.occlusionType === 'full',
      x: region.x - windowOriginX, y: region.y - windowOriginY,
      width: Math.max(0, region.width), height: Math.max(0, region.height),
    };
  }).sort((a,b) => a.orientation === b.orientation
    ? (a.orientation === 'vertical' ? a.x - b.x : a.y - b.y)
    : (a.orientation === 'vertical' ? -1 : 1));
}
export function foldsInsideRow(folds: readonly FoldLayout[], width: number, height: number) {
  return folds.filter((fold) => fold.orientation === 'vertical'
    ? fold.x < width && (fold.width === 0 ? fold.x > 0 : fold.x + fold.width > 0)
    : fold.y < height && (fold.height === 0 ? fold.y > 0 : fold.y + fold.height > 0));
}
