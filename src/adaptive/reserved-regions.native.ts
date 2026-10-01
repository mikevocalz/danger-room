import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import type { ReservedRegion } from './reserved-regions.types';
export type { ReservedRegion } from './reserved-regions.types';

interface NativeSubscription { remove(): void }
interface ReservedRegionsNative {
  query(): Promise<ReservedRegion[]>;
  addListener?(eventName: 'changed', listener: (regions: ReservedRegion[]) => void): NativeSubscription;
}
interface ExpoModulesV2Global { expoV2?: { modules?: { ReservedRegions?: ReservedRegionsNative } } }
const legacyNative = requireOptionalNativeModule<ReservedRegionsNative>('ReservedRegions');
const NONE: readonly ReservedRegion[] = [];
function nativeModule(): ReservedRegionsNative | null {
  return (globalThis as typeof globalThis & ExpoModulesV2Global).expoV2?.modules?.ReservedRegions ?? legacyNative;
}
export function useReservedRegions(): readonly ReservedRegion[] {
  const { width, height } = useWindowDimensions();
  const [regions, setRegions] = useState<readonly ReservedRegion[]>(NONE);
  useEffect(() => {
    const native = nativeModule();
    if (!native) return;
    let live = true;
    const accept = (next: ReservedRegion[]) => { if (live) setRegions(next); };
    void native.query().then(accept).catch(() => { if (live) setRegions(NONE); });
    const subscription = Platform.OS === 'android' ? native.addListener?.('changed', accept) : undefined;
    return () => { live = false; subscription?.remove(); };
  }, [width, height]);
  return regions;
}
