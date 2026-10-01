import { requireOptionalNativeModule } from 'expo';

/**
 * True only on a Meta Horizon (Quest) headset.
 *
 * ponytail: read through `requireOptionalNativeModule` rather than importing
 * expo-horizon-core directly — the ExpoHorizon native module is absent from any
 * build that predates it, and a plain import throws "Cannot find native module
 * 'ExpoHorizon'" at module scope, which takes down whichever route imported it.
 * Optional lookup returns null instead, so off-headset just reads as false.
 */
export const isHorizonDevice =
  requireOptionalNativeModule<{ isHorizonDevice: boolean }>('ExpoHorizon')?.isHorizonDevice ?? false;
