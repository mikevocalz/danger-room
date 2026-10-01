import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Slot, useLocalSearchParams, useRouter } from 'expo-router';
import { SplitView } from 'expo-router/unstable-split-view';
import { useFont, type SkFont } from '@shopify/react-native-skia';
import {
  usePeers,
  useConnection,
  useScreenShare,
  useForegroundService,
  useMicrophone,
  RTCView,
  type MediaStream,
} from '@fishjam-cloud/react-native-client';
import { useCamera, useCameraPermission } from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-reanimated';
import { Motion } from '@legendapp/motion';
import BottomSheet, { BottomSheetView, type BottomSheetModal } from '@gorhom/bottom-sheet';

import { isHorizonDevice } from '@/horizon';
import { HostPlate } from '@/roster/HostPlate';
import { RoomLayout } from '@/roster/layout/RoomLayout';
import { GuestColumnsProvider, RoomGuestProvider } from '@/room/RoomPaneContext';
import { RosterGrid } from '@/roster/RosterGrid';
import { DnaShowcase } from '@/roster/showcase/DnaShowcase';
import { makeCircledX } from '@/roster/glyphs';
import { ShowcaseCard } from '@/components/ShowcaseCard';
import { ChatSheet } from '@/components/ChatSheet';
import { RoomSkeleton } from '@/components/RoomSkeleton';
import { CRTOverlay } from '@/components/CRTOverlay';
import { MaskOverlay } from '@/components/MaskOverlay';
import { ReactionsBar, ReactionsOverlay, useReactionsChannel } from '@/components/Reactions';
import type { ReactionKind } from '@/stores/reactionStore';
import { CleanCapture } from '@/roster/camera/CleanCapture';
import { useMaskFilters, type FilteredFace } from '@/roster/camera/useMaskFilters';
import type { FaceTickPayload } from '@/roster/camera/faceAnchor';
import { useGuestCameraSource, useTrackedGuestCameraSource } from '@/roster/camera/usePublishSource';
import {
  enablePublishCowl, disablePublishCowl, pushCowlFace, HAS_PUBLISH_COWL,
} from '@/roster/camera/publishCowl';
import { useChatStore } from '@/stores/chatStore';
import { useRoomStore } from '@/stores/roomStore';
import { useFilterStore } from '@/stores/filterStore';
import type { RoomPeerMetadata } from '@/fishjam/room';

const MEGALOPOLIS = require('../../assets/fonts/MegalopolisX.ttf');

const mark = makeCircledX({
  ringRadius: 42, ringWidth: 7, ringGap: 0, armSpan: 34, armWidthCenter: 6, armWidthOuter: 12,
});

const CHARACTERS = [
  'Cyclops', 'Magneto', 'Morph', 'Apocalypse', 'Spiderman', 'Beast', 'Storm', 'Sunspot',
] as const;
const CYCLE_MS = 7000;
const DESCRIPTIONS: Record<string, string> = {
  Cyclops: '- Emits concussive beams from his eyes',
  Magneto: '- Controls magnetic fields and metal',
  Morph: '- Shapeshifts into anyone he sees',
  Apocalypse: '- Ancient mutant of near-limitless power',
  Spiderman: '- Wall-crawling, web-slinging hero',
  Beast: '- Genius intellect with feline agility',
  Storm: '- Commands weather and lightning',
  Sunspot: '- Absorbs solar energy for raw power',
};

function nameOf(meta: unknown): string | undefined {
  const m = meta as { username?: string; peer?: { username?: string } } | undefined;
  return m?.peer?.username ?? m?.username;
}
function roleOf(meta: unknown): string | undefined {
  const m = meta as { role?: string; peer?: { role?: string } } | undefined;
  return m?.peer?.role ?? m?.role;
}

const GUEST_SLOTS = 8;
const GUEST_SEATS = [
  'WOLVERINE', 'STORM', 'ROGUE', 'GAMBIT', 'BEAST', 'JEAN GREY', 'NIGHTCRAWLER', 'BISHOP',
] as const;

/**
 * The room. Host stage (video 80% + controls 20%) + auto-cycling DNA showcase,
 * with the live guest band. Peers come from Fishjam; the host takes the stage.
 */
export default function RoomLayoutRoute() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const orientation = width > height ? 'land' : 'port';
  const params = useLocalSearchParams<{ role?: string; username?: string }>();
  const plateFont = useFont(MEGALOPOLIS, 13);
  const router = useRouter();
  const { leaveRoom } = useConnection();
  const { localPeer, peers } = usePeers<RoomPeerMetadata>();
  const [modelIndex, setModelIndex] = useState(0);
  const chatRef = useRef<BottomSheetModal>(null);

  // Single coordinated reveal: skeleton faceplates until the slow 3D model is up.
  const ready = useRoomStore((s) => s.ready);
  const setReady = useRoomStore((s) => s.setReady);
  const resetReady = useRoomStore((s) => s.reset);
  useEffect(() => {
    resetReady();
    return resetReady;
  }, [resetReady]);

  // Graceful leave: SIGSEGV if the camera/RTCView/WebGPU tear down while the
  // peer disposes and we navigate, all at once. So unmount the heavy native
  // views FIRST (leaving=true → RoomLayout gone), let them settle a couple of
  // frames, THEN leaveRoom + navigate.
  const [leaving, setLeaving] = useState(false);
  const leave = () => setLeaving(true);
  useEffect(() => {
    if (!leaving) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try { leaveRoom(); } catch {}
        router.replace('/');
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [leaving, leaveRoom, router]);

  useEffect(() => {
    const id = setInterval(() => setModelIndex((i) => (i + 1) % CHARACTERS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  // Peers publish through the custom vision-camera source, so their live video
  // lands in customVideoTracks (not the standard cameraTrack). Grab the first
  // renderable stream so each guest plate can show the real feed.
  const streamOf = (p: {
    customVideoTracks?: { stream: MediaStream | null }[];
    cameraTrack?: { stream: MediaStream | null };
  }): MediaStream | null => p.customVideoTracks?.[0]?.stream ?? p.cameraTrack?.stream ?? null;
  const screenOf = (p: { screenShareVideoTrack?: { stream: MediaStream | null } }): MediaStream | null =>
    p.screenShareVideoTrack?.stream ?? null;
  const everyone = [
    ...(localPeer ? [{ id: localPeer.id, name: nameOf(localPeer.metadata) ?? params.username, role: roleOf(localPeer.metadata) ?? params.role, self: true, stream: streamOf(localPeer), screenStream: screenOf(localPeer) }] : []),
    ...peers.map((p) => ({ id: p.id, name: nameOf(p.metadata), role: roleOf(p.metadata), self: false, stream: streamOf(p), screenStream: screenOf(p) })),
  ];
  const host = everyone.find((p) => p.role === 'host');
  const guests = everyone.filter((p) => p.role !== 'host');

  const hostName = host?.name ?? params.username ?? 'PROFESSOR X';
  const myName = (params.username ?? hostName) as string;
  const iAmHost = params.role === 'host' || host?.self === true;

  // Reactions: broadcast + receive on the data channel; emojis float for everyone.
  const react = useReactionsChannel();

  // ponytail: TEMPORARY flicker probe. Logs only when the video graph actually
  // changes, so a stream that flaps shows up as a burst of [vidgraph] lines while
  // a steady one prints once. `r=` is the render count, to separate "re-rendering
  // hard" from "stream identity churning". Delete once the glitch is pinned down.
  const renderCount = useRef(0);
  renderCount.current += 1;
  const vidSig =
    `host=${host?.id ?? '-'} cam=${host?.stream?.id ?? 'null'} scr=${host?.screenStream?.id ?? 'null'} | ` +
    guests.map((g) => `${g.name ?? g.id}:${g.stream?.id ?? 'null'}`).join(' ');
  const lastSig = useRef('');
  useEffect(() => {
    if (__DEV__ && vidSig !== lastSig.current) {
      lastSig.current = vidSig;
      console.log(`[vidgraph] r=${renderCount.current} ${vidSig}`);
    }
  });

  const hostPane = <MeasuredHost name={hostName} font={plateFont ?? undefined}
    video={iAmHost ? <HostStage orientation={orientation} host onLeave={leave} onChat={() => chatRef.current?.present()} onReact={react} />
      : <ViewerStage hostStream={host?.screenStream ?? host?.stream ?? null} sharing={!!host?.screenStream}
          onLeave={leave} onChat={() => chatRef.current?.present()} onReact={react} />}
    onLeave={leave} onChat={() => chatRef.current?.present()} />;

  const showcasePane = <ShowcaseCard name={CHARACTERS[modelIndex]} description={DESCRIPTIONS[CHARACTERS[modelIndex]]} compact={orientation === 'port'}>
    <DnaShowcase key={orientation} character={CHARACTERS[modelIndex]} onModelReady={setReady} />
  </ShowcaseCard>;

  const renderGuests = (columns: number) => <RosterGrid peers={Array.from({ length: GUEST_SLOTS }, (_, i) => {
    const g=guests[i]; return { id:g?.id ?? `seat${i}`, name:g?.name ?? GUEST_SEATS[i],
      state:g ? ('occupied' as const) : ('empty' as const), isSelf:g?.self,
      videoSlot:g?.stream ? <RTCView mediaStream={g.stream} style={StyleSheet.absoluteFill} objectFit="cover" mirror={!!g.self} /> : undefined };
  })} columns={columns} rows={GUEST_SLOTS/columns} slots={GUEST_SLOTS} glyph={mark} font={plateFont ?? undefined} />;

  return <RoomGuestProvider renderGuests={renderGuests}>
    <View style={[styles.root,{paddingTop:insets.top,paddingBottom:insets.bottom+8}]}>
      {!leaving ? <View style={styles.detail}>
        {Platform.OS === 'ios'
          ? <GuestColumnsProvider columns={2}><SplitView topColumnForCollapsing="primary" activityEnabled>
              <SplitView.Column><View style={styles.fill}>{hostPane}</View></SplitView.Column>
              <SplitView.Column><View style={styles.fill}>{showcasePane}</View></SplitView.Column>
            </SplitView></GuestColumnsProvider>
          : <RoomLayout host={hostPane} showcase={showcasePane}
              guests={(columns)=><GuestColumnsProvider columns={columns}><Slot /></GuestColumnsProvider>} />}
      </View> : null}
      <Motion.View style={[styles.overlay,{paddingTop:insets.top,paddingBottom:insets.bottom+8}]}
        pointerEvents={ready&&!leaving?'none':'auto'} animate={{opacity:ready&&!leaving?0:1}}
        transition={{type:'timing',duration:400}}>
        <View style={styles.detail}><RoomSkeleton /></View>
      </Motion.View>
      <ChatSheet ref={chatRef} username={myName} />
    </View>
  </RoomGuestProvider>;
}

const MeasuredHost = ({
  name, font, video, onLeave, onChat,
}: {
  name: string; font?: SkFont; video?: React.ReactNode; onLeave: () => void; onChat: () => void;
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View style={styles.fill} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {size.width > 0 ? (
        <HostPlate width={size.width} height={size.height} name={name} font={font} videoSlot={video} />
      ) : null}
      {/* Guests (no local video) still get a Leave/Chat bar. */}
      {!video ? <HostControls onLeave={onLeave} onChat={onChat} floating /> : null}
    </View>
  );
};


/** Self stage inside the plate screen: video 80%, controls 20%. Runs the local
 *  camera for EVERYONE (host and guest) so a guest sees their own feed too; only
 *  the host gets Share / CRT / Mask. */
const HostStage = ({
  orientation, host, onLeave, onChat, onReact,
}: {
  orientation: 'land' | 'port'; host: boolean; onLeave: () => void; onChat: () => void;
  onReact: (kind: ReactionKind) => void;
}) => {
  // Android FGS keeps camera + screen-share capture alive when backgrounded.
  useForegroundService({
    enableCamera: true,
    enableScreenSharing: true,
    channelId: 'danger-room',
    channelName: 'Danger Room',
    notificationTitle: 'Danger Room',
    notificationContent: 'Live in the simulation',
  });
  // Advanced screen share: system audio + HD, the local preview stream, and a
  // middleware slot. `videoTrack` present ⇒ we are actively sharing.
  const {
    startStreaming, stopStreaming, stream: screenStream, videoTrack: screenTrack,
  } = useScreenShare();
  const sharing = !!screenTrack;
  const mask = useFilterStore((s) => s.mask);
  const trackFace = host && mask && !sharing;
  // Frame-sync tracking (FaceBlurApp pattern): detection runs in the publish
  // source's onFrame worklet, gated by this shared value — so the MASK toggle
  // never touches the camera session and the old remount seam (§3.1/§6.2,
  // MaskedCapture/CleanCapture) is gone. §9 still holds: the publish source is
  // owned HERE and never remounts.
  const trackFaceSV = useSharedValue(false);
  useEffect(() => { trackFaceSV.value = trackFace; }, [trackFace, trackFaceSV]);

  // §6.9 — mirror mask state into the native publish-side compositor (Android;
  // no-op elsewhere) so remote peers get the cowl baked into the track.
  useEffect(() => {
    if (trackFace) {
      enablePublishCowl().catch((e) => console.warn('[room] publish cowl failed', e));
    } else {
      disablePublishCowl();
    }
  }, [trackFace]);

  // §6.1 — filtered tracking channels; MaskOverlay derives the transform.
  // ponytail: ONE shared value, not seven. Seven `withTiming` writes per detector
  // tick was ~182 JS→UI animation starts/sec and was a main source of the lag;
  // this is one plain write per tick. One Euro (below) already does the smoothing.
  const face = useSharedValue<FilteredFace>({
    present: false, cx: 0.5, cy: 0.42, iod: 0, aspect: 1, roll: 0, yaw: 0, pitch: 0,
  });
  const filters = useMaskFilters();
  // ponytail: TEMPORARY registration probe. frameToView assumes the DETECTOR's
  // frame and the video well share an orientation; if the detector hands back a
  // landscape frame while the well is portrait, the cover math registers the cowl
  // to the wrong place and it "doesn't fit". Logs once per aspect change, so a
  // mismatch shows up as a= far from well=. Delete once the fit is right.
  const wellRef = useRef({ width: 0, height: 0 }); // assigned below, once vwSize exists
  const maskDbg = useRef('');
  const onFaceTick = useCallback(
    (t: FaceTickPayload) => {
      const f = filters.step(t);
      if (__DEV__ && f.present) {
        const w = wellRef.current;
        const key = `a=${f.aspect.toFixed(2)} well=${(w.width / (w.height || 1)).toFixed(2)}`;
        if (key !== maskDbg.current) {
          maskDbg.current = key;
          console.log(`[mask] ${key} iod=${f.iod.toFixed(3)} cx=${f.cx.toFixed(2)} cy=${f.cy.toFixed(2)}`);
        }
      }
      pushCowlFace(f); // §6.9 — same filtered channels to the native compositor
      face.value = f.present ? f : { ...f, iod: 0 }; // iod 0 ⇒ overlay fades out
    },
    [filters, face],
  );

  const cameraFacing = useFilterStore((s) => s.cameraFacing);
  // Publish source + frame-sync detection in ONE camera output.
  const { frameOutput, stream } = useTrackedGuestCameraSource(trackFaceSV, onFaceTick, cameraFacing);

  const toggleShare = async () => {
    try {
      if (sharing) {
        await stopStreaming();
      } else {
        await startStreaming({
          // Capture the device/system AUDIO alongside the screen.
          audioConstraints: true,
          // Publish the screen in HD at a steady 15fps (crisp text, low bitrate).
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 15, max: 20 },
          },
        });
      }
    } catch (e) {
      console.warn('[room] screen share failed', e);
    }
  };

  const crt = useFilterStore((s) => s.crt);
  const cameraOn = useFilterStore((s) => s.cameraOn);
  const flipCamera = useFilterStore((s) => s.flipCamera);
  const toggleCamera = useFilterStore((s) => s.toggleCamera);
  const [vwSize, setVwSize] = useState({ width: 0, height: 0 });
  wellRef.current = vwSize; // feeds the [mask] registration probe above

  // Audio: start the mic once so the room hears the host; MUTE stops the mic
  // (the RN client drops toggleMicrophoneMute — off === muted, no audio published).
  const { startMicrophone, toggleMicrophone, isMicrophoneOn } = useMicrophone();
  useEffect(() => {
    startMicrophone().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = screenStream ?? stream;
  const front = cameraFacing === 'front';
  return (
    <View style={styles.stage}>
      {/* ONE stable capture driver. Detection lives in the publish worklet
          (useTrackedGuestCameraSource), so there is no mask-keyed remount —
          only a lens flip recreates the session (facing key inside). */}
      <CleanCapture frameOutput={frameOutput} facing={cameraFacing} enabled={cameraOn} />
      <View style={styles.videoWrap} onLayout={(e) => setVwSize(e.nativeEvent.layout)}>
        {active ? (
          <RTCView
            key={`${orientation}-${sharing ? 'screen' : 'cam'}`}
            mediaStream={active}
            style={StyleSheet.absoluteFill}
            objectFit={sharing ? 'contain' : 'cover'}
            mirror={front && !sharing}
          />
        ) : (
          <Skeleton label="OPENING CAMERA…" />
        )}
        {/* Camera OFF — cover the (stopped) feed with an idle placeholder. */}
        {!cameraOn && !sharing ? (
          <View style={styles.camOff} pointerEvents="none">
            <Text style={styles.camOffGlyph}>📷</Text>
            <Text style={styles.camOffText}>CAMERA OFF</Text>
          </View>
        ) : null}
        {/* CRT filter — host only, over the live camera (not a shared screen). */}
        {host && crt && !sharing ? <CRTOverlay width={vwSize.width} height={vwSize.height} /> : null}
        {/* Filter-grade cowl: filtered channels → registered transform (§6.8).
            Only when the native publish compositor ISN'T doing it — the self-view
            renders the publish stream, so with HAS_PUBLISH_COWL the cowl is already
            baked into these pixels and drawing it again gives you two masks. */}
        {trackFace && !HAS_PUBLISH_COWL ? (
          <MaskOverlay
            face={face}
            wellW={vwSize.width}
            wellH={vwSize.height}
            front={front}
          />
        ) : null}
        {sharing ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>SHARING SCREEN</Text>
          </View>
        ) : null}
        {/* Reactions float up INSIDE the host video (dvnt story / sneaky-lynk style). */}
        <ReactionsOverlay />
      </View>
      <ControlsSheet>
        <HostControls
          onLeave={onLeave}
          onChat={onChat}
          onShare={host ? toggleShare : undefined}
          sharing={sharing}
          withFilters={host}
          onReact={onReact}
          onFlip={flipCamera}
          onToggleCam={toggleCamera}
          cameraOn={cameraOn}
          onToggleMic={() => { toggleMicrophone().catch(() => {}); }}
          micMuted={!isMicrophoneOn}
        />
      </ControlsSheet>
    </View>
  );
};

/**
 * Draggable wrapper for the stage's control panel (gorhom BottomSheet, the
 * grab-handle pattern from ChatSheet): pull the handle down to minimise the
 * controls to just the handle bar, pull up to reveal all rows. Non-modal, lives
 * inside the stage so it only covers its own panel.
 */
const ControlsSheet = ({ children }: { children: React.ReactNode }) => {
  // 34 = handle-only (minimised); the second snap fits all control rows.
  const snapPoints = useMemo(() => [34, 208], []);
  return (
    <BottomSheet
      snapPoints={snapPoints}
      index={1}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetView style={styles.sheetContent}>{children}</BottomSheetView>
    </BottomSheet>
  );
};

/** Guest's top panel: shows the HOST's remote feed (camera or shared screen).
 *  Publishes the guest's own camera into the roster grid — EXCEPT on a Horizon
 *  headset, which joins as a watch-only guest (see VIEW_ONLY below). */
const ViewerStage = ({
  hostStream, sharing, onLeave, onChat, onReact,
}: {
  hostStream: MediaStream | null; sharing: boolean; onLeave: () => void; onChat: () => void;
  onReact: (kind: ReactionKind) => void;
}) => {
  // ponytail: Quest/Horizon joins as a viewer — no camera capture, no publish.
  // The headset has no usable selfie camera for a roster plate, and asking for
  // CAMERA there just triggers a permission prompt for a stream nobody sees.
  // Hooks stay unconditional (rules of hooks); the capture is gated by isActive.
  const VIEW_ONLY = isHorizonDevice;
  const { hasPermission, requestPermission } = useCameraPermission();
  useEffect(() => {
    if (!VIEW_ONLY && !hasPermission) requestPermission();
  }, [VIEW_ONLY, hasPermission, requestPermission]);
  useForegroundService({
    enableCamera: !VIEW_ONLY,
    channelId: 'danger-room',
    channelName: 'Danger Room',
    notificationTitle: 'Danger Room',
    notificationContent: 'Live in the simulation',
  });
  // Publish the guest's own camera → their gold plate in the grid shows video.
  // isActive false on Horizon ⇒ the session never starts and nothing publishes.
  const { frameOutput } = useGuestCameraSource();
  useCamera({
    device: 'front',
    isActive: !VIEW_ONLY && hasPermission,
    outputs: [frameOutput as never],
  });

  return (
    <View style={styles.stage}>
      <View style={styles.videoWrap}>
        {hostStream ? (
          <RTCView
            key={sharing ? 'screen' : 'cam'}
            mediaStream={hostStream}
            style={StyleSheet.absoluteFill}
            objectFit={sharing ? 'contain' : 'cover'}
          />
        ) : (
          <Skeleton label="WAITING FOR HOST…" />
        )}
        {sharing ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>HOST SCREEN</Text>
          </View>
        ) : null}
        {/* Reactions float up inside the feed the guest is watching. */}
        <ReactionsOverlay />
      </View>
      <ControlsSheet>
        <HostControls onLeave={onLeave} onChat={onChat} onReact={onReact} />
      </ControlsSheet>
    </View>
  );
};

/** Leave·Share·CRT·Mask·Chat (row 1) · Flip·Cam·Mic (row 2) · Reactions (row 3). */
const HostControls = ({
  onLeave, onChat, onShare, sharing, floating, withFilters, onReact,
  onFlip, onToggleCam, cameraOn, onToggleMic, micMuted,
}: {
  onLeave: () => void; onChat: () => void; onShare?: () => void;
  sharing?: boolean; floating?: boolean; withFilters?: boolean;
  onReact?: (kind: ReactionKind) => void;
  onFlip?: () => void; onToggleCam?: () => void; cameraOn?: boolean;
  onToggleMic?: () => void; micMuted?: boolean;
}) => {
  const unread = useChatStore((s) => s.unread);
  const crt = useFilterStore((s) => s.crt);
  const mask = useFilterStore((s) => s.mask);
  const toggleCrt = useFilterStore((s) => s.toggleCrt);
  const toggleMask = useFilterStore((s) => s.toggleMask);
  return (
    <View style={[styles.controls, floating && styles.controlsFloating]}>
      {/* Row 1: session controls. */}
      <View style={styles.ctrlRow}>
        <CtrlButton label="LEAVE" glyph="◀" onPress={onLeave} tone="red" />
        {onShare ? (
          <CtrlButton label={sharing ? 'STOP' : 'SHARE'} glyph="⧉" onPress={onShare} active={sharing} tone={sharing ? 'red' : undefined} />
        ) : null}
        {withFilters ? <CtrlButton label="CRT" glyph="📺" onPress={toggleCrt} active={crt} /> : null}
        {withFilters ? <CtrlButton label="MASK" glyph="🎭" onPress={toggleMask} active={mask} /> : null}
        <CtrlButton label="CHAT" glyph="💬" onPress={onChat} badge={unread} />
      </View>
      {/* Row 2: device controls — flip lens, camera on/off, mute. */}
      {onFlip ? (
        <View style={styles.ctrlRow}>
          <CtrlButton label="FLIP" glyph="🔄" onPress={onFlip} />
          <CtrlButton
            label={cameraOn ? 'CAM' : 'CAM OFF'}
            glyph={cameraOn ? '📹' : '🚫'}
            onPress={onToggleCam ?? (() => {})}
            active={!cameraOn}
            tone={!cameraOn ? 'red' : undefined}
          />
          <CtrlButton
            label={micMuted ? 'UNMUTE' : 'MUTE'}
            glyph={micMuted ? '🔇' : '🎤'}
            onPress={onToggleMic ?? (() => {})}
            active={!!micMuted}
            tone={micMuted ? 'red' : undefined}
          />
        </View>
      ) : null}
      {/* Row 3: live reactions. */}
      {onReact ? (
        <View style={styles.reactRow}>
          <ReactionsBar onReact={onReact} />
        </View>
      ) : null}
    </View>
  );
};

const CtrlButton = ({
  label, glyph, onPress, tone, badge, active,
}: {
  label: string; glyph: string; onPress: () => void; tone?: 'red'; badge?: number; active?: boolean;
}) => (
  <Pressable
    style={[styles.ctrl, active && styles.ctrlActive, tone === 'red' && styles.ctrlRed]}
    onPress={onPress}
    hitSlop={6}
  >
    <Text style={styles.ctrlGlyph}>{glyph}</Text>
    <Text style={[styles.ctrlLabel, active && styles.ctrlLabelActive]}>{label}</Text>
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    ) : null}
  </Pressable>
);

/** Pulsing loading skeleton (Legend Motion) for slow WebGPU/model loads. */
const Skeleton = ({ label }: { label: string }) => (
  <View style={styles.skeletonWrap}>
    <Motion.View
      style={styles.skeleton}
      animate={{ opacity: 0.55 }}
      initial={{ opacity: 0.2 }}
      transition={{ type: 'timing', duration: 900, loop: -1, repeatReverse: true }}
    />
    <Text style={styles.skeletonLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b3fae' },
  detail: { flex: 1, padding: 12 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0b3fae' },
  fill: { flex: 1 },
  stage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  // 4:3 well (3:4 portrait), matching the camera's native sensor aspect. Measured
  // detector frame is 0.75 against the old 0.60 well, so the cover transform was
  // cropping ~20% off the sides — matching the aspect makes frameToView's crop an
  // identity, which is why the cowl registers better here. Controls still float
  // over the bottom (styles.controlsFloating), unchanged.
  videoWrap: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: '#000' },
  flip180: { transform: [{ rotate: '180deg' }] },
  controls: {
    // Two stacked rows (session controls + reactions). minHeight keeps both rows
    // visible even in a short landscape quadrant; the video shrinks instead.
    flex: 0.38, minHeight: 150, flexDirection: 'column', justifyContent: 'center',
    backgroundColor: '#0a1830', borderTopWidth: 1, borderTopColor: '#2a3b57',
    paddingHorizontal: 8, paddingVertical: 4, gap: 4,
  },
  ctrlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  reactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  camOff: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1830',
  },
  camOffGlyph: { fontSize: 40 },
  camOffText: { color: '#9fc0ff', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 6 },
  // ControlsSheet (grab-handle wrapper around the stage controls)
  sheetBg: { backgroundColor: '#0a1830f2', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  sheetHandle: { backgroundColor: '#eec645', width: 44 },
  sheetContent: { paddingBottom: 6 },
  controlsFloating: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flex: undefined, minHeight: undefined,
    backgroundColor: '#0a1830d9', borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingTop: 8, paddingBottom: 10,
  },
  // flex:1 + minWidth:0 → the buttons share the bar width evenly and always fit,
  // however narrow the host plate gets in portrait (all 5 stay on one screen).
  ctrl: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 2, paddingVertical: 6, borderRadius: 8 },
  ctrlRed: {},
  ctrlActive: { backgroundColor: '#1e3a6e' },
  ctrlGlyph: { color: '#eaf1ff', fontSize: 16, lineHeight: 20 },
  ctrlLabel: { color: '#9fc0ff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 1 },
  ctrlLabelActive: { color: '#ffe680' },
  liveBadge: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#000000aa', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#e6482e' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  badge: {
    position: 'absolute', top: 0, right: 8, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#e6482e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  skeletonWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  skeleton: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#16294d' },
  skeletonLabel: { color: '#5a7fc0', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
});
