/**
 * Fishjam camera publish paths (per the Vision Camera + WebGPU-effects
 * tutorials).
 *
 *  - Guests → `useVisionCameraSource` (package root): camera published as-is.
 *  - Host   → `useVisionCameraWebGpuSource` (`/webgpu`, iOS 17+): the feed runs
 *             through a WebGPU CRT filter before it leaves the device.
 *
 * These are two separate hooks; the room renders a host component OR a guest
 * component (never both), so Rules-of-Hooks stay intact and only the host device
 * spins up a WebGPU pipeline. Both drive VisionCamera via the returned
 * `frameOutput` and expose a `stream` for the self-view (`RTCView`).
 */
import { useCallback, useMemo } from 'react';
import { useVisionCameraSource } from '@fishjam-cloud/react-native-vision-camera-source';

import {
  useVisionCameraWebGpuSource,
  type WebGpuFrameRenderFunction,
} from '@fishjam-cloud/react-native-vision-camera-source/webgpu';
import {
  useCameraWebGpuDevice,
  createCameraPassthroughPipeline,
  encodeCameraPassthrough,
  computeAspectFillCrop,
  getOutputSurfaceFormat,
  type CameraPassthroughPipeline,
} from '@fishjam-cloud/react-native-custom-video-source/webgpu';

export const SOURCE_ID = 'vision-camera';

/** Old-TV look for the host: barrel curve, scanlines, chromatic fringe, vignette. */
export const CRT_WGSL = /* wgsl */ `
struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;

@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  var p = array<vec2f,3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));
  var o: VOut;
  o.pos = vec4f(p[i], 0.0, 1.0);
  var uv = p[i] * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  o.uv = uv;
  return o;
}

fn curve(uv: vec2f) -> vec2f {
  var c = uv * 2.0 - 1.0;
  let off = abs(c.yx) / vec2f(6.0, 4.5);
  c = c + c * off * off;
  return c * 0.5 + 0.5;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let uv = curve(in.uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }
  let dims = vec2f(textureDimensions(tex));
  let ca = 1.3 / dims.x;                       // chromatic aberration
  var col = vec3f(
    textureSample(tex, samp, uv + vec2f(ca, 0.0)).r,
    textureSample(tex, samp, uv).g,
    textureSample(tex, samp, uv - vec2f(ca, 0.0)).b,
  );
  let scan = 0.86 + 0.14 * sin(uv.y * dims.y * 3.14159);  // scanlines
  col = col * scan;
  let v = uv * (1.0 - uv);                     // vignette
  col = col * pow(v.x * v.y * 16.0, 0.22);
  col = col * vec3f(1.06, 1.0, 1.06);          // cool phosphor tint
  return vec4f(col, 1.0);
}
`;

interface CrtEffect {
  passthrough: CameraPassthroughPipeline;
  pipeline: GPURenderPipeline;
  interView: GPUTextureView;
  bind: GPUBindGroup;
}

/** Build the passthrough + CRT post pipelines once the device is available. */
function buildCrt(device: GPUDevice, width: number, height: number): CrtEffect {
  const format = getOutputSurfaceFormat();
  const passthrough = createCameraPassthroughPipeline(device, { mirror: true });

  // Camera draws into this; the CRT pass then samples it into the output surface.
  const inter = device.createTexture({
    size: [width, height],
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const interView = inter.createView();
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const module = device.createShaderModule({ code: CRT_WGSL });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: interView },
    ],
  });
  return { passthrough, pipeline, interView, bind };
}

export interface CameraPublish {
  /** Plug into VisionCamera: `useCamera({ device, isActive, outputs: [frameOutput] })`. */
  frameOutput: unknown;
  /** Self-view stream for `<RTCView mediaStream={stream} />`; null until ready. */
  stream: import('@fishjam-cloud/react-native-webrtc').MediaStream | null;
  error: Error | null;
}

/**
 * Host camera published through the CRT filter (iOS 17+). The device resolves
 * asynchronously; until then `onFrame` is a no-op and nothing is published.
 */
export function useHostCrtCameraSource(width = 720, height = 1280): CameraPublish {
  const { device } = useCameraWebGpuDevice();
  const crt = useMemo(
    () => (device ? buildCrt(device, width, height) : null),
    [device, width, height],
  );

  const onFrame = useCallback(
    (_frame: unknown, render: WebGpuFrameRenderFunction) => {
      'worklet';
      if (!crt || !device) return;
      const { passthrough, pipeline, interView, bind } = crt;
      render((context) => {
        // 1. live camera → intermediate texture (cropped to fill, like objectFit:cover)
        const crop = computeAspectFillCrop(
          context.cameraWidth,
          context.cameraHeight,
          context.outputWidth / context.outputHeight,
        );
        encodeCameraPassthrough(
          device,
          passthrough,
          context.cameraTexture,
          interView,
          context.commandEncoder,
          crop,
        );
        // 2. CRT post-pass: intermediate → published output surface
        const pass = context.commandEncoder.beginRenderPass({
          colorAttachments: [
            { view: context.outputView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bind);
        pass.draw(3);
        pass.end();
      });
    },
    [crt, device],
  );

  const { frameOutput, stream, error } = useVisionCameraWebGpuSource(SOURCE_ID, {
    width,
    height,
    device: device ?? undefined,
    onFrame,
  });
  return { frameOutput, stream, error };
}

/** Guest camera published as-is (all platforms).
 *  `pixelFormat: 'yuv'` — the Surface Duo (and some devices) reject the default
 *  native/PRIVATE format at 720p for the ImageAnalysis frame path; YUV_420_888
 *  is universally supported and is the format WebRTC encodes anyway. */
export function useGuestCameraSource(): CameraPublish {
  const { frameOutput, stream, error } = useVisionCameraSource(SOURCE_ID, {
    pixelFormat: 'yuv',
  });
  return { frameOutput, stream, error };
}
