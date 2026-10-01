import type { FoldOrientation, FoldState, ReservedRegion } from './reservedRegions';

export interface FoldLayout {
  orientation: FoldOrientation;
  state: FoldState;
  separating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowOrigin {
  x: number;
  y: number;
}

export interface AxisRegion {
  start: number;
  size: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function inferOrientation(region: ReservedRegion): FoldOrientation {
  if (region.orientation) return region.orientation;
  return region.height >= region.width ? 'vertical' : 'horizontal';
}

export function foldLayoutsFromRegions(
  regions: readonly ReservedRegion[],
  origin: WindowOrigin = { x: 0, y: 0 },
): FoldLayout[] {
  return regions
    .filter((region) => region.kind === 'division' && region.active)
    .map((region) => ({
      orientation: inferOrientation(region),
      state: region.state ?? 'flat',
      separating: region.separating ?? true,
      x: region.x - origin.x,
      y: region.y - origin.y,
      width: Math.max(0, region.width),
      height: Math.max(0, region.height),
    }));
}

export function foldsIntersectingRect(
  folds: readonly FoldLayout[],
  width: number,
  height: number,
): FoldLayout[] {
  return folds.filter((fold) => {
    if (!fold.separating) return false;

    if (fold.orientation === 'vertical') {
      const start = fold.x;
      const end = fold.x + Math.max(fold.width, 1);
      const crossStart = fold.y;
      const crossEnd = fold.y + Math.max(fold.height, 1);
      return end > 0 && start < width && crossEnd > 0 && crossStart < height;
    }

    const start = fold.y;
    const end = fold.y + Math.max(fold.height, 1);
    const crossStart = fold.x;
    const crossEnd = fold.x + Math.max(fold.width, 1);
    return end > 0 && start < height && crossEnd > 0 && crossStart < width;
  });
}

export function physicalRegionsForAxis(
  folds: readonly FoldLayout[],
  total: number,
  orientation: FoldOrientation,
): AxisRegion[] {
  const divisions = folds
    .filter((fold) => fold.separating && fold.orientation === orientation)
    .map((fold) => ({
      start: orientation === 'vertical' ? fold.x : fold.y,
      extent: orientation === 'vertical' ? fold.width : fold.height,
    }))
    .sort((a, b) => a.start - b.start);

  if (divisions.length === 0 || total <= 0) return [];

  const result: AxisRegion[] = [];
  let cursor = 0;

  for (const division of divisions) {
    const start = clamp(division.start, 0, total);
    const end = clamp(start + Math.max(0, division.extent), 0, total);
    if (start > cursor) result.push({ start: cursor, size: start - cursor });
    cursor = Math.max(cursor, end);
  }

  if (cursor < total) result.push({ start: cursor, size: total - cursor });
  return result.filter((region) => region.size > 1);
}
