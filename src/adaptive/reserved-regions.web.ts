import type { ReservedRegion } from './reserved-regions.types';
export type { ReservedRegion } from './reserved-regions.types';
const NONE: readonly ReservedRegion[] = [];
export function useReservedRegions(): readonly ReservedRegion[] { return NONE; }
