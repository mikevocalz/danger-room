import * as THREE from 'three/webgpu';
import {
  color,
  mix,
  positionLocal,
  sin,
  time,
  uv,
  vec3,
} from 'three/tsl';

/**
 * Builds the showcase scene: an animated blue shader backdrop, a circulating
 * double-helix, and a pedestal slot for a GLB model in front of it.
 *
 * Pure scene construction — no renderer, no RN imports — so it can be unit
 * tested and reused if the surface ever changes.
 */

export interface ShowcaseScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Advance animation. dt in seconds. */
  tick: (dt: number) => void;
  /** Swap the front model in. Replaces the placeholder. */
  setModel: (object: THREE.Object3D) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

/** The model + DNA stay aligned in 3D (model in front of the helix); the camera
 * is shifted right so they render on the LEFT of the panel with no parallax and
 * the profile card sits at the right. The shift SCALES with panel aspect (see
 * resize) — a fixed world-shift lands the model off-screen in a narrow panel. */
const MODEL_X = 0;
/** Wide (landscape) panel: shift right so the model+DNA sit on the LEFT and the
 * profile card fills the right. Narrow (portrait 40%) panel: the card is a
 * compact bottom overlay, so CENTER the model+DNA (no shift). */
const SHIFT_K = 0.72;
const camShift = (aspect: number) => (aspect > 1 ? SHIFT_K * aspect : 0);

const HELIX = {
  turns: 2,
  height: 3.4,
  radius: 0.85,
  pairs: 17,
  sphere: 0.13,
  rungRadius: 0.03,
  /** Radians per second around Y. */
  spin: 0.45,
};

/** Animated deep-blue backdrop: layered sine bands drifting through two blues. */
function makeBackdrop(): THREE.Mesh {
  const mat = new THREE.MeshBasicNodeMaterial();
  const p = uv();
  const wave =
    sin(p.y.mul(9).add(time.mul(0.6)))
      .add(sin(p.x.mul(5).sub(time.mul(0.35))))
      .mul(0.25)
      .add(0.5);
  mat.colorNode = mix(
    color('#1c4a9e'),
    color('#4a86e0'),
    wave.mul(p.y.oneMinus().mul(0.8).add(0.2)),
  );
  const geo = new THREE.PlaneGeometry(30, 18);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -6;
  return mesh;
}

/** Instanced double helix with rungs, centred at origin. */
function makeHelix(): THREE.Group {
  const group = new THREE.Group();

  const strandMat = new THREE.MeshStandardNodeMaterial({
    metalness: 0.4,
    roughness: 0.35,
  });
  strandMat.colorNode = mix(
    color('#59c2ff'),
    color('#b18cff'),
    positionLocal.y.add(HELIX.height / 2).div(HELIX.height),
  );

  const rungMat = new THREE.MeshStandardMaterial({
    color: '#dbe9ff',
    metalness: 0.2,
    roughness: 0.5,
    transparent: true,
    opacity: 0.85,
  });

  const sphereGeo = new THREE.SphereGeometry(HELIX.sphere, 12, 12);
  const spheres = new THREE.InstancedMesh(sphereGeo, strandMat, HELIX.pairs * 2);
  const rungGeo = new THREE.CylinderGeometry(
    HELIX.rungRadius,
    HELIX.rungRadius,
    1,
    6,
  );
  const rungs = new THREE.InstancedMesh(rungGeo, rungMat, HELIX.pairs);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < HELIX.pairs; i++) {
    const t = i / (HELIX.pairs - 1);
    const angle = t * HELIX.turns * Math.PI * 2;
    const y = (t - 0.5) * HELIX.height;

    const a = new THREE.Vector3(
      Math.cos(angle) * HELIX.radius,
      y,
      Math.sin(angle) * HELIX.radius,
    );
    const b = new THREE.Vector3(-a.x, y, -a.z);

    m.compose(a, q.identity(), s);
    spheres.setMatrixAt(i * 2, m);
    m.compose(b, q.identity(), s);
    spheres.setMatrixAt(i * 2 + 1, m);

    // Rung: unit cylinder stretched between the strands.
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    m.compose(mid, q, new THREE.Vector3(1, len, 1));
    rungs.setMatrixAt(i, m);
  }
  spheres.instanceMatrix.needsUpdate = true;
  rungs.instanceMatrix.needsUpdate = true;

  group.add(spheres, rungs);
  return group;
}

/** Neutral placeholder figure until a GLB is provided. */
function makePlaceholder(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffd75e',
    metalness: 0.1,
    roughness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 14), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), mat);
  head.position.y = 0.95;
  g.add(body, head);
  g.position.set(0, -1.1, 1.6);
  return g;
}

export function buildShowcaseScene(): ShowcaseScene {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  // Shifted right + looking straight ahead: the origin (model + DNA) renders on
  // the left, and because the view is parallel to Z the model stays exactly in
  // front of the helix (no sideways parallax). x is set for real in resize().
  camera.position.set(camShift(1), 0.2, 6.4);
  camera.lookAt(camShift(1), 0.2, 0);

  scene.add(new THREE.AmbientLight('#6f86c9', 1.5));
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#12204a', 1.4));
  const key = new THREE.DirectionalLight('#ffffff', 3.4);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#cfe0ff', 2.0);
  fill.position.set(0, 1.5, 6); // front fill toward the camera-facing side
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#7ea6ff', 2.2);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  const backdrop = makeBackdrop();
  const helix = makeHelix(); // behind the model (model at z=1.6)
  helix.position.x = -0.3; // nudged a little left of the model
  // No stand-in figure — an empty node until the real model loads in.
  let front: THREE.Object3D = new THREE.Group();
  scene.add(backdrop, helix, front);

  // Feet height. Raised further in the narrow (portrait) panel so the centred
  // model sits higher and uses the vertical space. Set per aspect in resize.
  let frontY = -1.25;
  let clock = 0;

  return {
    scene,
    camera,
    tick(dt) {
      clock += dt;
      helix.rotation.y += HELIX.spin * dt;
      // Full turntable — ~one complete 360° revolution per 7s on-stage cycle.
      front.rotation.y += 0.9 * dt;
      front.position.y = frontY + Math.sin(clock * 1.5) * 0.05;
      front.rotation.z = Math.sin(clock * 0.9) * 0.015;
    },
    setModel(object) {
      scene.remove(front);
      front = object;
      front.position.set(MODEL_X, frontY, 1.6);
      scene.add(front);
    },
    resize(width, height) {
      const aspect = width / Math.max(1, height);
      camera.aspect = aspect;
      // Wide panel: shift right (model+DNA left, card right) with the helix nudged
      // a touch left of the model. Narrow panel: centre both, DNA directly behind.
      const shift = camShift(aspect);
      camera.position.x = shift;
      camera.lookAt(shift, 0.2, 0);
      helix.position.x = aspect > 1 ? -0.3 : 0;
      // Narrow (portrait 40%) panel: centre the model + DNA and raise the model a
      // little so it sits higher in the panel.
      frontY = aspect > 1 ? -1.25 : -1.1;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach(x => x.dispose());
        else m?.dispose?.();
      });
    },
  };
}
