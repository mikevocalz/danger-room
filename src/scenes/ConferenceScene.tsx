import React, { useEffect, useState } from 'react';
import {
  ViroARScene,
  ViroController,
  ViroNode,
  ViroQuad,
  ViroBox,
  ViroText,
  ViroSphere,
  Viro3DObject,
  ViroMaterials,
  ViroAnimations,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroExternalVideo,
  ViroRivePanel,
  useAnySourceHover,
} from '@reactvision/react-viro';

import type { RiveCanvasOptions } from 'nitro-canvas-in-Vision';

import { updateListener, restartTheme, getThemeState, onThemeState } from './xrThemeAudio';
import { useDangerRoomRiveSources } from './rive/useDangerRoomRiveSources';

/**
 * Spatial conference scene — cloned from Viro's shipped `vr-quest-scene.tsx`
 * (360 skybox + in-scene passthrough toggle), styled to the app's roster-console
 * plates (cream frame · cobalt screen · gold header).
 *
 * WHY THE TOGGLE WORKS NOW (previous attempts didn't):
 *  - `<ViroController>` provides the pointer + reticle; without it a `ViroNode
 *    onClick` never fires on Quest — that's why passthrough "did nothing".
 *  - the button calls `VRModuleOpenXR.setPassthroughEnabled(viewTag, next)`
 *    (viewTag from `useVRViewTag`) directly in onClick AND unmounts the 360 so
 *    the projection layer clears transparent and the passthrough (real room)
 *    shows through. IMMERSIVE = 360 shown + passthrough off; PASSTHROUGH =
 *    360 gone + passthrough on. A console.log lands in logcat for diagnosis.
 *  - navigator runs hdr/bloom/pbr OFF (xr.tsx) to keep that transparent clear.
 *
 * ViroText: fontSize is point-like, so `Label` lays text out in a LARGE logical
 * box then scales down (the idiom from quest-passthrough-style) — a sub-meter
 * width overflows. Spatial theme plays ONCE on entry (react-native-audio-api,
 * head-tracked; Viro GVR audio is silent on Quest); REPLAY re-triggers it.
 * Geometry stand-ins until the Skia→Viro plate/video pipeline (PROMPT 2).
 */
const BG = require('../../assets/images/danger-room.jpg');

ViroMaterials.createMaterials({
  frame: { diffuseColor: '#d8d2c0', lightingModel: 'Constant' },
  screen: { diffuseColor: '#16294d', lightingModel: 'Constant' },
  // Live host feed: ViroExternalVideo rebinds this material's diffuse channel to
  // the WebRTC-fed ExternalSurfaceTexture at runtime; the color is the pre-video
  // placeholder tint.
  hostVideo: { diffuseColor: '#0a1830', lightingModel: 'Constant' },
  header: { diffuseColor: '#eec645', lightingModel: 'Constant' },
  toggle: { diffuseColor: '#3b1f7a', lightingModel: 'Constant' },
  toggleOn: { diffuseColor: '#7c4dff', lightingModel: 'Constant' },
  btnHover: { diffuseColor: '#00d2ff', lightingModel: 'Constant' },
  replay: { diffuseColor: '#123a94', lightingModel: 'Constant' },
  dnaRung: { diffuseColor: '#dbe9ff', lightingModel: 'Constant' }, // rungs, like mobile
  // Manual skybox: the danger-room equirect on the INSIDE of a big ViroSphere.
  // A sphere is a real NODE (ViroBase) so it has `visible` — the crash-free way
  // to toggle the environment (Viro360Image is not a node and must be unmounted,
  // which SIGSEGVs).
  skybox: { diffuseTexture: BG, lightingModel: 'Constant' },
});

// storm.glb ships with NO textures inside (its 5 materials are just NAMED for the
// jpgs in assets/models/textures — the mobile app maps them at runtime, three.js
// side). storm_textured.glb is the same model with those 5 jpgs EMBEDDED as
// baseColorTexture (scripted, verified) — Viro's GLB loader picks them up with no
// material overrides. All primitives carry TEXCOORD_0 (verified).
const XMEN_MODEL = require('../../assets/models/storm_textured.glb');

// DNA double-helix — mirrors mobile showcaseScene makeHelix: two sphere strands
// with a blue→purple gradient (#59c2ff bottom → #b18cff top, one material per pair)
// + a rung (thin box) spanning each pair. Spun by helixSpin.
// Mobile makeHelix proportions (turns 2, h 3.4, r 0.85, sphere 0.13, rung 0.03,
// 17 pairs) scaled by 1.35/3.4 — same fat ladder look, XR-sized.
const HELIX = { pairs: 17, turns: 2, height: 1.35, radius: 0.34, sphere: 0.052, rung: 0.024 };
const lerpHex = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0'));
  return `#${c.join('')}`;
};
ViroMaterials.createMaterials(
  Object.fromEntries(
    Array.from({ length: HELIX.pairs }, (_, i) => [
      `dna${i}`,
      { diffuseColor: lerpHex('#59c2ff', '#b18cff', i / (HELIX.pairs - 1)), lightingModel: 'Constant' },
    ]),
  ),
);

ViroAnimations.registerAnimations({
  helixSpin: { properties: { rotateY: '+=360' }, duration: 12000 },
  modelSpin: { properties: { rotateY: '+=360' }, duration: 9000 },
});

const DnaHelix = () => {
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < HELIX.pairs; i++) {
    const t = i / (HELIX.pairs - 1);
    const y = (t - 0.5) * HELIX.height;
    const ang = t * HELIX.turns * Math.PI * 2;
    const x = Math.cos(ang) * HELIX.radius;
    const z = Math.sin(ang) * HELIX.radius;
    const angDeg = (ang * 180) / Math.PI;
    parts.push(
      <ViroSphere key={`a${i}`} radius={HELIX.sphere} position={[x, y, z]} materials={[`dna${i}`]} />,
      <ViroSphere key={`b${i}`} radius={HELIX.sphere} position={[-x, y, -z]} materials={[`dna${i}`]} />,
      // rung: thin box spanning the two strands (length 2·radius), along the pair axis
      <ViroBox
        key={`r${i}`}
        position={[0, y, 0]}
        rotation={[0, -angDeg, 0]}
        width={HELIX.radius * 2}
        height={HELIX.rung}
        length={HELIX.rung}
        materials={['dnaRung']}
      />,
    );
  }
  return <ViroNode animation={{ name: 'helixSpin', loop: true, run: true }}>{parts}</ViroNode>;
};

/** DNA + tall spinning Storm — the app's DnaShowcase in 3D, standing LEFT of host,
 *  clear of it (host is at x=-1.05).
 *
 *  Orientation is NOT guessed: parsing storm.glb's node hierarchy shows the model
 *  is authored STANDING (world long axis = Y, height 2.01m, feet at y=0). So the
 *  rotation is [0,0,0] — the earlier X-rotations (from raw accessor bounds that
 *  ignored node transforms) were the face-down/inverted bug. scale 0.8 → 1.6m. */
/** Small square control plate used in the showcase's one-row button strip. */
const MiniBtn = ({ text, x, onClick }: { text: string; x: number; onClick: () => void }) => (
  <ViroNode position={[x, 0.1, 0.4]} onClick={onClick}>
    <ViroQuad width={0.18} height={0.12} materials={['toggle']} />
    <Label text={text} pw={0.16} ph={0.12} fontSize={22} color="#ffffff" z={0.01} />
  </ViroNode>
);

const Showcase = () => {
  const [scale, setScale] = useState(0.8);
  const bump = (f: number) => setScale((s) => Math.min(1.6, Math.max(0.4, +(s * f).toFixed(3))));
  return (
    // Whole showcase (DNA + Storm + button strip) drags as one — grab and move.
    // Re-renders from scale/rotY don't snap the drag back: the position PROP never
    // changes, so RN's diff sends nothing and the native node stays put.
    <ViroNode position={[-3.1, -0.6, -1.2]} rotation={[0, 34, 0]} dragType="FixedToWorld" onDrag={() => {}}>
      {/* Helix CLEARLY behind Storm: z=-1.0, front edge -0.66 vs her back -0.35
          → 0.31m of air (mobile's model-in-front-of-helix composition). */}
      <ViroNode position={[-0.15, 0.85, -1.0]}>
        <DnaHelix />
      </ViroNode>
      {/* Feet at model y=0 → node on the floor. Turntable spin; onPinch = phone AR. */}
      <ViroNode animation={{ name: 'modelSpin', loop: true, run: true }}>
        <Viro3DObject
          source={XMEN_MODEL}
          type="GLB"
          scale={[scale, scale, scale]}
          onPinch={(state, factor) => {
            if (state === 3) setScale((s) => Math.min(1.6, Math.max(0.4, s * factor)));
          }}
        />
      </ViroNode>
      {/* Size strip — gentle 6% steps */}
      <MiniBtn text="−" x={-0.15} onClick={() => bump(1 / 1.06)} />
      <MiniBtn text="+" x={0.15} onClick={() => bump(1.06)} />
    </ViroNode>
  );
};

// Viro fontSize is point-like: keep text INSIDE a physical (meters) box by laying
// it out in a big logical box (pw/SCALE) then scaling the node down + centering.
const SCALE = 0.25;
const Label = ({
  text, pw, ph, fontSize, color, y = 0, z = 0.012,
}: {
  text: string; pw: number; ph: number; fontSize: number; color: string; y?: number; z?: number;
}) => (
  <ViroText
    text={text}
    position={[0, y, z]}
    scale={[SCALE, SCALE, SCALE]}
    width={pw / SCALE}
    height={ph / SCALE}
    textClipMode="ClipToBounds"
    textLineBreakMode="None"
    style={{
      fontFamily: 'Arial',
      fontSize,
      color,
      fontWeight: '900',
      textAlign: 'center',
      textAlignVertical: 'center',
    }}
  />
);

/** A roster-console plate: cream frame, cobalt screen, gold header, name centred. */
const Plate = ({
  w, h, name, headerH, fontSize, role = 'guest', riveSource,
}: {
  w: number;
  h: number;
  name: string;
  headerH: number;
  fontSize: number;
  role?: 'host' | 'guest';
  riveSource?: RiveCanvasOptions | null;
}) => {
  const inset = 0.02;
  const screenH = h - headerH - inset;
  const headerY = h / 2 - headerH / 2 - inset;
  const screenY = -(headerH + inset) / 2 - inset / 2;
  const resolutionWidth = 768;
  const resolutionHeight = Math.max(256, Math.round((resolutionWidth * h) / w));

  return (
    <ViroNode>
      <ViroQuad width={w} height={h} materials={['frame']} />
      <ViroQuad width={w - inset * 2} height={headerH} position={[0, headerY, 0.006]} materials={['header']} />
      <ViroQuad width={w - inset * 2} height={screenH} position={[0, screenY, 0.004]} materials={['screen']} />
      <Label text={name.toUpperCase()} pw={w - 0.1} ph={headerH} fontSize={fontSize} color="#16294d" y={headerY - headerH * 0.22} />
      {riveSource ? (
        <ViroRivePanel
          source={riveSource}
          width={w - inset * 2}
          height={h - inset * 2}
          position={[0, 0, 0.01]}
          resolution={{ width: resolutionWidth, height: resolutionHeight }}
          androidRoute="ahb"
          fallbackColor="#16294d"
          bindings={{
            'participant.name': name.toUpperCase(),
            'participant.role': role,
            'participant.active': true,
          }}
          onError={(error) => console.warn('[xr/rive] participant panel failed', error.message)}
        />
      ) : null}
    </ViroNode>
  );
};

/** Hover-aware UI button (per-source hover so both pointers behave). */
const Btn = ({
  label, y, onClick, on = false, fontSize,
}: {
  label: string; y: number; onClick: () => void; on?: boolean; fontSize: number;
}) => {
  const [hovered, onHover] = useAnySourceHover();
  const mat = hovered ? 'btnHover' : on ? 'toggleOn' : 'toggle';
  return (
    <ViroNode position={[0, y, -1.35]} rotation={[10, 0, 0]} onHover={onHover} onClick={onClick}>
      <ViroQuad width={0.5} height={0.18} materials={[mat]} />
      <Label text={label} pw={0.46} ph={0.18} fontSize={fontSize} color={hovered ? '#04122e' : '#ffffff'} z={0.01} />
    </ViroNode>
  );
};

const GUEST_NAMES = ['WOLVERINE', 'STORM', 'ROGUE', 'GAMBIT'];
const GUEST_CENTERS: [number, number][] = [
  [-0.36, 0.215],
  [0.36, 0.215],
  [-0.36, -0.215],
  [0.36, -0.215],
];

const onCam = (t: unknown) => {
  const cam = t as { position: number[]; forward: number[] };
  if (cam?.position && cam?.forward) updateListener(cam.position, cam.forward);
};

/**
 * ONE stable scene — nothing is ever unmounted or remounted, which is what kept
 * crashing (unmount-360, key-remount, and scene-stack push/pop all tear down
 * textures/scenes mid-render → SIGSEGV). The environment toggle is purely the
 * `visible` prop on the skybox sphere: visible=false stops it rendering (texture
 * stays alive) → transparent clear → the REAL ROOM (navigator: passthroughEnabled
 * + hdr/bloom/pbr off). visible=true → the Danger Room wraps back around you.
 */
export const ConferenceScene = (props: {
  sceneNavigator?: { viroAppProps?: { hostStreamTag?: string | null } };
}) => {
  const [passthrough, setPassthrough] = useState(false);
  const [theme, setTheme] = useState(getThemeState());
  const { plateSource, hudSource, error: riveError } = useDangerRoomRiveSources();

  useEffect(() => onThemeState(setTheme), []);
  useEffect(() => {
    if (riveError) console.warn('[xr/rive] falling back to native geometry:', riveError);
  }, [riveError]);
  // Host's RN-webrtc stream tag, delivered from xr.tsx via viroAppProps (a
  // string, so it crosses the navigator boundary regardless of React roots).
  const hostStreamTag = props.sceneNavigator?.viroAppProps?.hostStreamTag ?? null;

  return (
    <ViroARScene onCameraTransformUpdate={onCam}>
      {/* Pointer + reticle — REQUIRED for onClick to fire on Quest (proven in
          the damaged-helmet ViroARScene example). */}
      <ViroController controllerVisibility reticleVisibility />

      {/* Lighting rig (like mobile showcase) so the model's Lambert textures read. */}
      <ViroAmbientLight color="#6f86c9" intensity={300} />
      <ViroDirectionalLight color="#ffffff" intensity={800} direction={[-0.4, -1, -0.5]} />
      <ViroDirectionalLight color="#cfe0ff" intensity={350} direction={[0.6, -0.3, -0.4]} />

      {/* Danger Room skybox: equirect texture on the INSIDE of a big sphere.
          Always mounted; `visible` is the whole toggle. */}
      <ViroSphere
        radius={40}
        widthSegmentCount={30}
        heightSegmentCount={30}
        facesOutward={false}
        materials={['skybox']}
        visible={!passthrough}
      />

      {/* DNA + X-Men showcase centrepiece (like the mobile DnaShowcase). */}
      <Showcase />

      {/* Host stage — LEFT, large — grab anywhere to drag (FixedToWorld). */}
      <ViroNode position={[-1.05, -0.05, -1.5]} rotation={[0, 26, 0]} dragType="FixedToWorld" onDrag={() => {}}>
        <Plate w={1.5} h={0.85} name="HOST" role="host" headerH={0.16} fontSize={40} riveSource={plateSource} />
        {/* Live host feed over the cobalt screen. ALWAYS mounted, `visible`
            toggled (the scene's one-stable-mount rule — same as the skybox);
            16:9 inside the plate screen area, nudged forward past the plate. */}
        <ViroQuad
          width={1.42}
          height={0.62}
          position={[0, -0.09, 0.012]}
          materials={['hostVideo']}
          visible={!!hostStreamTag}
        />
      </ViroNode>

      {/* WebRTC → hostVideo material bridge (no geometry). Mounted only once a
          host stream exists; sourceKey swap rebinds the sink on peer change. */}
      {hostStreamTag ? (
        <ViroExternalVideo
          material="hostVideo"
          sourceKey={hostStreamTag}
          pixelSize={{ width: 1280, height: 720 }}
          onError={(e) => console.warn('[xr] host video bind failed', e.nativeEvent?.error)}
        />
      ) : null}

      {/* Guest grid — RIGHT (2×2) — whole grid drags as one panel. */}
      <ViroNode position={[1.05, -0.05, -1.5]} rotation={[0, -26, 0]} dragType="FixedToWorld" onDrag={() => {}}>
        {GUEST_CENTERS.map(([x, y], i) => (
          <ViroNode key={i} position={[x, y, 0]}>
            <Plate w={0.66} h={0.37} name={GUEST_NAMES[i]} role="guest" headerH={0.085} fontSize={20} riveSource={plateSource} />
          </ViroNode>
        ))}
      </ViroNode>

      {hudSource ? (
        <ViroRivePanel
          source={hudSource}
          width={0.86}
          height={0.28}
          position={[0, 0.35, -1.36]}
          rotation={[10, 0, 0]}
          resolution={{ width: 1024, height: 336 }}
          androidRoute="ahb"
          fallbackColor="#16294d"
          bindings={{
            'hud.title': 'DANGER ROOM',
            'hud.mode': { kind: 'enum', value: passthrough ? 'passthrough' : 'immersive' },
            'hud.themePlaying': theme === 'playing',
            'hud.guestCount': GUEST_NAMES.length,
          }}
          onError={(error) => console.warn('[xr/rive] HUD failed', error.message)}
        />
      ) : null}

      {/* Env toggle + theme — CENTER. Theme button reflects live play state. */}
      <Btn
        label={passthrough ? 'IMMERSIVE' : 'PASSTHROUGH'}
        y={-0.3}
        on={passthrough}
        onClick={() => setPassthrough((p) => !p)}
        fontSize={18}
      />
      <Btn
        label={theme === 'playing' ? 'PLAYING...' : 'REPLAY THEME'}
        y={-0.52}
        on={theme === 'playing'}
        onClick={() => restartTheme()}
        fontSize={16}
      />
    </ViroARScene>
  );
};
