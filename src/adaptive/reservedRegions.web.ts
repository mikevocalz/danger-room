import type { ReservedRegion } from './reservedRegions.types';

export type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from './reservedRegions.types';

const NONE: readonly ReservedRegion[] = [];

export function useReservedRegions(): readonly ReservedRegion[] {
  return NONE;
}
