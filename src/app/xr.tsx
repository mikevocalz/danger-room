import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePeers, type MediaStream } from '@fishjam-cloud/react-native-client';

import { isHorizonDevice } from '@/horizon';
import { useJoinDangerRoom, type RoomPeerMetadata } from '@/fishjam/room';
import { startTheme, stopTheme } from '@/scenes/xrThemeAudio';

// ponytail: Viro is only linked into the `quest` flavor (app.json xRMode:["QUEST"]).
// On the mobile flavor NativeModules.VRTMaterialManager is null, so merely *importing*
// @reactvision/react-viro throws while the module evaluates — and expo-router evaluates
// every route file at startup to read its default export, so a top-level import crashes
// the lobby too, reported as "Route ./xr.tsx is missing the required default export".
// Require it, and ConferenceScene (which imports it too), only on a Quest build.
const viro = isHorizonDevice
  ? {
      Navigator: require('@reactvision/react-viro').ViroXRSceneNavigator,
      scene: require('@/scenes/ConferenceScene').ConferenceScene,
    }
  : null;

/**
 * XR session route. Config cloned from Viro's quest-object-detection example:
 * ViroARScene root + `passthroughEnabled` + hdr/bloom/pbr OFF keeps the eye
 * buffer's transparent clear, so with no 360 mounted the REAL ROOM shows.
 *
 * `onExitViro` (QUEST_SETUP.md §6): after the B-button/system exit the navigator
 * renders null in the panel — navigate back to the lobby or the screen is blank.
 *
 * Theme lifecycle lives HERE (module-singleton audio), not in the scene — the
 * scene key-remounts on the passthrough toggle and must not restart the music.
 */
export default function XrEntry() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string; username?: string }>();

  // Quest joins the SAME fishjam room as a watch-only guest (no camera, no
  // publish — the headset has nothing useful to publish), purely to receive the
  // host's remote track for the in-scene screen.
  const { join, leaveRoom } = useJoinDangerRoom();
  const { peers } = usePeers<RoomPeerMetadata>();
  useEffect(() => {
    if (!viro) return;
    join(params.room ?? 'danger-room', params.username ?? 'QUEST', 'guest')
      .catch((e) => console.warn('[xr] room join failed', e));
    return () => leaveRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host's live stream → its RN-webrtc stream tag. The tag (a string) is what
  // crosses into the Viro scene; native side resolves it back to the track.
  const host = peers.find((p) => (p.metadata as RoomPeerMetadata | undefined)?.role === 'host');
  const streamOf = (p: {
    customVideoTracks?: { stream: MediaStream | null }[];
    cameraTrack?: { stream: MediaStream | null };
    screenShareVideoTrack?: { stream: MediaStream | null };
  }): MediaStream | null =>
    p.screenShareVideoTrack?.stream ?? p.customVideoTracks?.[0]?.stream ?? p.cameraTrack?.stream ?? null;
  const hostStreamTag = host ? streamOf(host)?.toURL() ?? null : null;

  useEffect(() => {
    if (!viro) return;
    startTheme();
    return () => stopTheme();
  }, []);

  // Reachable by deep link even though the lobby hides ENTER XR off-headset.
  if (!viro) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.fallbackLabel}>◉ HEADSET REQUIRED</Text>
        <Text style={styles.fallbackBody}>
          The immersive conference runs on the quest flavor, on a Meta Horizon device.
        </Text>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>◇ BACK TO LOBBY</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <viro.Navigator
        initialScene={{ scene: viro.scene }}
        viroAppProps={{ hostStreamTag }}
        passthroughEnabled
        hdrEnabled={false}
        bloomEnabled={false}
        pbrEnabled={false}
        onExitViro={() => router.back()}
        style={styles.nav}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0518' },
  nav: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  fallbackLabel: { color: '#e9ddff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  fallbackBody: {
    color: '#b79dff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 10,
    textAlign: 'center',
  },
  back: { paddingVertical: 10, marginTop: 18 },
  backText: { color: '#9fc0ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
});
