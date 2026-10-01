import { useCallback } from 'react';
// react-native-client re-exports useConnection + useSandbox from react-client.
import { useConnection, useSandbox } from '@fishjam-cloud/react-native-client';

/**
 * Sandbox API base — the "Sandbox" URL from the Fishjam dashboard. Prototyping
 * path: it mints peer tokens straight from the client, so no backend is needed
 * (the FISHJAM_* keys in .env stay server-only). Set EXPO_PUBLIC_FISHJAM_SANDBOX_URL.
 */
export const SANDBOX_API_URL = process.env.EXPO_PUBLIC_FISHJAM_SANDBOX_URL ?? '';
/** Client-side Fishjam app id (fishjam.io/app) for the provider. Public. */
export const FISHJAM_ID = process.env.EXPO_PUBLIC_FISHJAM_ID ?? '';

export type Role = 'host' | 'guest';
export interface RoomPeerMetadata {
  [key: string]: unknown;
  username: string;
  role: Role;
}

/**
 * Join the Danger Room. The host "starts" the room (the first peer's token
 * request creates it); guests joining the same room name are added after. Role
 * travels in peer metadata so the room can put the host on the stage.
 */
export function useJoinDangerRoom() {
  const { getSandboxPeerToken } = useSandbox({ sandboxApiUrl: SANDBOX_API_URL });
  const { joinRoom, leaveRoom, peerStatus } = useConnection();

  const join = useCallback(
    async (roomName: string, username: string, role: Role) => {
      const peerToken = await getSandboxPeerToken(roomName.trim(), username.trim(), 'conference');
      await joinRoom<RoomPeerMetadata>({
        peerToken,
        peerMetadata: { username: username.trim().toUpperCase(), role },
      });
    },
    [getSandboxPeerToken, joinRoom],
  );

  return { join, leaveRoom, peerStatus };
}
