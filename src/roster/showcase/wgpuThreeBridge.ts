/**
 * react-native-webgpu ⇄ three.js bridge (Seam B — closed).
 *
 * The supported hand-off, per Software Mansion's ThreeJS example
 * (react-native-webgpu-main): take the GPUCanvasContext from the RN canvas and
 * hand its `.canvas` + itself to three's WebGPURenderer, then `context.present()`
 * after each render. Requires three r168+ resolved to its WebGPU build (metro
 * aliases `three` → `three/webgpu`).
 */
import * as THREE from 'three/webgpu';
import type { NativeCanvas, RNCanvasContext } from 'react-native-webgpu';

export interface ThreeSurface {
  renderer: THREE.WebGPURenderer;
  /** Flush the frame to screen — RN webgpu requires an explicit present. */
  present: () => void;
  dispose: () => void;
}

export async function createThreeSurface(
  context: RNCanvasContext,
): Promise<ThreeSurface> {
  const canvas = context.canvas as unknown as NativeCanvas;
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    canvas: canvas as unknown as HTMLCanvasElement,
    context: context as unknown as GPUCanvasContext,
  });
  await renderer.init();
  renderer.setSize(canvas.width, canvas.height, false);

  return {
    renderer,
    present: () => context.present(),
    dispose: () => renderer.dispose(),
  };
}
