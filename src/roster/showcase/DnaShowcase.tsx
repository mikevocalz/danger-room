import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
// Seam B: react-native-webgpu's Canvas + useCanvasRef, per SWM's three example.
import { Canvas, useCanvasRef } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { buildShowcaseScene, type ShowcaseScene } from './showcaseScene';
import { createThreeSurface } from './wgpuThreeBridge';
import { MATERIAL_TEXTURES } from './materialTextures';

declare const createImageBitmap: (data: ArrayBuffer) => Promise<unknown>;

/** Decode a bundled base-color texture. react-native-webgpu's createImageBitmap
 *  takes an ArrayBuffer (not a blob: URL, which is why embedded GLB textures
 *  can't load) — so fetch the bundled PNG/JPG bytes and decode those. */
async function loadTexture(uri: string): Promise<THREE.Texture> {
  const buf = await (await fetch(uri)).arrayBuffer();
  const bitmap = await createImageBitmap(buf);
  const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // glTF UV convention
  tex.needsUpdate = true;
  return tex;
}

/** Assign each material its base-color texture (matched by material name).
 *  Awaited before the model is shown, so it's never white-then-textured. */
async function applyTextures(root: THREE.Object3D): Promise<void> {
  const tasks: Promise<void>[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial;
      // glTF materials default to metalness 1 → dark/flat without an env map.
      // The costumes are fabric/skin, so make them diffuse and let the lights work.
      std.metalness = 0.0;
      std.roughness = 0.72;
      // Force OPAQUE + single-sided + depth-write. Some rips (e.g. Spider-Man)
      // carry an alpha channel that three treats as transparent → the faces get
      // depth-sorted and flicker "in and out" as the model turns. Opaque fixes it.
      std.transparent = false;
      std.alphaTest = 0;
      std.depthWrite = true;
      std.depthTest = true;
      std.side = THREE.FrontSide;
      std.needsUpdate = true;
      const mod = MATERIAL_TEXTURES[std.name];
      if (!mod) return;
      const textureAsset = Image.resolveAssetSource(mod);
      if (!textureAsset?.uri) return;
      tasks.push(
        loadTexture(textureAsset.uri)
          .then(tex => {
            std.map = tex;
            std.needsUpdate = true;
          })
          .catch(e => console.warn('[showcase] tex fail', std.name, e)),
      );
    });
  });
  await Promise.allSettled(tasks);
}

export interface DnaShowcaseProps {
  /** Which roster character stands on the DNA stage. */
  character?: string;
  onReady?: (api: { setModel: (o: import('three/webgpu').Object3D) => void }) => void;
  /** Fired once, when the FIRST character is actually on the DNA stage (models
   *  load slowly — the room waits on this to reveal everything at once). */
  onModelReady?: () => void;
  /** Frame cap. The room shares the GPU with video decode + Skia. */
  maxFps?: number;
}

// GLBs converted from the X-Men '97 FBX (assets/models). Static requires.
const MODELS: Record<string, number> = {
  Cyclops: require('../../../assets/models/cyclops.glb'),
  Magneto: require('../../../assets/models/magneto.glb'),
  Morph: require('../../../assets/models/morph.glb'),
  Apocalypse: require('../../../assets/models/apocalypse.glb'),
  Spiderman: require('../../../assets/models/spiderman.glb'),
  Beast: require('../../../assets/models/beast.glb'),
  Storm: require('../../../assets/models/storm.glb'),
  Sunspot: require('../../../assets/models/sunspot.glb'),
};

// Model world-height by canvas shape — taller when the panel is wide (landscape),
// a touch shorter when it's narrow (portrait). Re-fit live on rotation.
const HEIGHT_LAND = 2.7; // full head in frame — taller values clip the crown up top
const HEIGHT_PORT = 2.8; // portrait features the model alone (no DNA) → a bit larger
const targetFor = (w: number, h: number) => (w > h ? HEIGHT_LAND : HEIGHT_PORT);

const cache = new Map<string, THREE.Group>();

/** Wrap the loaded scene in a group normalised to exactly 1 world-unit tall with
 * feet at the group origin. Measured ONCE — Box3.setFromObject is unreliable on
 * skinned meshes if re-measured after a scale change, so height is controlled
 * afterwards purely via the group's own scale (see setHeight), never re-measured. */
function normalise(scene: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.add(scene);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  scene.scale.setScalar(1 / (size.y || 1)); // model is now 1 unit tall
  const box2 = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box2.min.y; // feet at group origin
  group.rotation.y = Math.PI; // face the camera
  return group;
}

/** Final on-stage height = the group's own scale (model is 1 unit tall). */
function setHeight(group: THREE.Object3D, targetHeight: number): void {
  group.scale.setScalar(targetHeight);
}

async function loadCharacter(name: string, targetHeight: number): Promise<THREE.Group | null> {
  const mod = MODELS[name];
  if (!mod) return null;
  let group = cache.get(name);
  if (!group) {
    const asset = Image.resolveAssetSource(mod);
    if (!asset?.uri) return null;
    const uri = asset.uri;
    // three's FileLoader uses browser XHR/ProgressEvent (absent in RN); fetch the
    // GLB ourselves and hand the ArrayBuffer to GLTFLoader.parse instead.
    const buffer = await (await fetch(uri)).arrayBuffer();
    const gltf = await new Promise<{
      scene: THREE.Object3D;
      animations: THREE.AnimationClip[];
    }>((resolve, reject) =>
      new GLTFLoader().parse(buffer, '', resolve as (g: unknown) => void, reject),
    );
    group = normalise(gltf.scene);
    await applyTextures(gltf.scene); // textured before the model is shown
    cache.set(name, group);
    // NOTE: no skeletal AnimationMixer — Cyclops's hair is weighted off the head
    // bone, so any bone motion tears his scalp off. The rigid turntable + bob
    // (showcaseScene.tick) is the motion; a skeletal idle needs a Blender re-weight.
  }
  setHeight(group, targetHeight);
  return group;
}

/**
 * The 40% showcase panel: blue TSL backdrop, circulating DNA, the current
 * character in front. Loop capped (default 30fps), paused on background,
 * resizes with the panel.
 */
export const DnaShowcase = ({
  character,
  onReady,
  onModelReady,
  maxFps = 30,
}: DnaShowcaseProps) => {
  const ref = useCanvasRef();
  const running = useRef(true);
  const worldRef = useRef<ShowcaseScene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  // Current target height, driven by the live canvas shape (re-fit on rotation).
  const targetHRef = useRef(HEIGHT_PORT);
  // onModelReady in a ref (applyModel has [] deps) + fire-once guard.
  const modelReadyRef = useRef(onModelReady);
  modelReadyRef.current = onModelReady;
  const shownRef = useRef(false);

  const applyModel = useCallback(async (name?: string) => {
    if (!name) return;
    try {
      const model = await loadCharacter(name, targetHRef.current);
      if (model && worldRef.current) {
        worldRef.current.setModel(model);
        modelRef.current = model;
        if (!shownRef.current) {
          shownRef.current = true;
          modelReadyRef.current?.();
        }
      }
    } catch (e) {
      console.warn('[showcase] model load failed', name, e);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const context = ref.current?.getContext('webgpu');
      if (!context) return;

      const surface = await createThreeSurface(context);
      if (disposed) {
        surface.dispose();
        return;
      }
      const world = buildShowcaseScene();
      world.resize(context.canvas.width, context.canvas.height);
      worldRef.current = world;
      targetHRef.current = targetFor(context.canvas.width, context.canvas.height);
      onReady?.({ setModel: world.setModel });
      applyModel(character); // initial character

      const minFrame = 1000 / maxFps;
      let last = 0;
      let lastW = context.canvas.width;
      let lastH = context.canvas.height;

      // renderer.setAnimationLoop is driven by react-native-webgpu's present
      // cycle — a manual requestAnimationFrame loop only ran a handful of frames.
      const frame = (now: number) => {
        if (disposed || !running.current) return;
        if (now - last < minFrame) return;
        const cw = context.canvas.width;
        const ch = context.canvas.height;
        if (cw !== lastW || ch !== lastH) {
          surface.renderer.setSize(cw, ch, false);
          world.resize(cw, ch);
          // Rotation reflows the panel — re-scale the model to the new shape so it
          // isn't stuck at the previous orientation's height.
          const th = targetFor(cw, ch);
          if (th !== targetHRef.current) {
            targetHRef.current = th;
            if (modelRef.current) setHeight(modelRef.current, th);
          }
          lastW = cw;
          lastH = ch;
        }
        const dt = last ? (now - last) / 1000 : 0;
        last = now;
        world.tick(Math.min(dt, 0.1));
        // Guard the GPU calls: on Fast Refresh the WebGPU device is torn down
        // under us — stop the loop instead of rendering into a dead surface.
        if (disposed) return;
        try {
          surface.renderer.render(world.scene, world.camera);
          surface.present();
        } catch (e) {
          disposed = true;
          console.warn('[showcase] render halted (surface lost)', e);
        }
      };
      surface.renderer.setAnimationLoop(frame);

      cleanup = () => {
        disposed = true;
        worldRef.current = null;
        modelRef.current = null;
        running.current = false;
        // Stop the render loop, but do NOT dispose the WebGPU world/surface here:
        // the native device teardown SIGSEGVs when the room unmounts (e.g. on
        // LEAVE). Leaking the GPU surface on exit is fine (reclaimed with the
        // context); a native crash is not. A try/catch can't catch a SIGSEGV.
        try {
          surface.renderer.setAnimationLoop(null);
        } catch (e) {
          console.warn('[showcase] stop-loop error', e);
        }
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the figure whenever the roster advances.
  useEffect(() => {
    applyModel(character);
  }, [character, applyModel]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      running.current = s === 'active';
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.fill}>
      <Canvas ref={ref} style={styles.fill} />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
