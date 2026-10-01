export type FoldOrientation = 'vertical' | 'horizontal';
export type FoldState = 'flat' | 'halfOpened';
export interface ReservedRegion {
  kind: 'division' | 'occlusion';
  x: number; y: number; width: number; height: number;
  margins: { top: number; left: number; bottom: number; right: number };
  active: boolean;
  orientation?: FoldOrientation;
  state?: FoldState;
  occlusionType?: 'none' | 'full';
  separating?: boolean;
}
