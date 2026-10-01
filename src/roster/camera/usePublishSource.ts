/**
 * Danger Room camera publishing.
 *
 * Guests use Fishjam's copy-friendly VisionCamera source.
 * The host uses Fishjam's official WebGPU VisionCamera source so the pixels
 * published to WebRTC are also the source of truth for the self-view and XR.
 *
 * One render() call may contain:
 *   1. camera passthrough OR CRT pass
 *   2. face-attached cowl blend pass
 *
 * Fishjam owns output surfaces, timestamps, encoder fencing and frame lifetime.
 */
import 'react-native-webgpu';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { Frame } from 'react-native-vision-camera';
import { GPUTextureUsage } from 'react-native-webgpu';
import { useVisionCameraSource } from '@fishjam-cloud/react-native-vision-camera-source';
import {
  computeAspectFillCrop,
  createCameraPassthroughPipeline,
  encodeCameraPassthrough,
  getOutputSurfaceFormat,
  useCameraWebGpuDevice,
  useVisionCameraWebGpuSource,
  type CameraPassthroughPipeline,
  type WebGpuFrameRenderFunction,
} from '@fishjam-cloud/react-native-vision-camera-source/webgpu';

import { COWL } from './cowlTemplate';
import { coverScale, frameToView } from './frameToView';
import type { FaceTickPayload } from './faceAnchor';
import {
  createCowlGpuEffect,
  encodeCowlGpuEffect,
  type CowlGpuEffect,
} from './fishjamWebGpuEffects';

export const SOURCE_ID = 'vision-camera';

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 1280;

/** Old-TV treatment. This pass runs only while CRT is actually enabled. */
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
  let ca = 1.3 / dims.x;
  var col = vec3f(
    textureSample(tex, samp, uv + vec2f(ca, 0.0)).r,
    textureSample(tex, samp, uv).g,
    textureSample(tex, samp, uv - vec2f(ca, 0.0)).b,
  );
  let scan = 0.86 + 0.14 * sin(uv.y * dims.y * 3.14159);
  col = col * scan;
  let v = uv * (1.0 - uv);
  col = col * pow(max(v.x * v.y * 16.0, 0.0), 0.22);
  col = col * vec3f(1.06, 1.0, 1.06);
  return vec4f(col, 1.0);
}
`;

interface CrtEffect {
  passthrough: CameraPassthroughPipeline;
  pipeline: GPURenderPipeline;
  intermediate: GPUTexture;
  interView: GPUTextureView;
  bind: GPUBindGroup;
}

function buildCrt(
  device: GPUDevice,
  width: number,
  height: number,
): CrtEffect {
  const format = getOutputSurfaceFormat();
  // Do not mirror the published camera. RTCView owns selfie mirroring locally.
  const passthrough = createCameraPassthroughPipeline(device);

  const intermediate = device.createTexture({
    label: 'danger-room-crt-intermediate',
    size: [width, height],
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const interView = intermediate.createView();
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  const module = device.createShaderModule({
    label: 'danger-room-crt',
    code: CRT_WGSL,
  });
  const pipeline = device.createRenderPipeline({
    label: 'danger-room-crt',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: interView },
    ],
  });
  return { passthrough, pipeline, intermediate, interView, bind };
}

export interface CameraPublish {
  frameOutput: unknown;
  stream: import('@fishjam-cloud/react-native-webrtc').MediaStream | null;
  error: Error | null;
  /** Safe to start the CameraSession. GPU uploads are complete. */
  ready?: boolean;
}

interface HostEffectsOptions {
  crtOn: SharedValue<boolean>;
  maskOn: SharedValue<boolean>;
  face: SharedValue<FaceTickPayload>;
  width?: number;
  height?: number;
}

interface PoseState {
  initialized: boolean;
  cx: number;
  cy: number;
  iod: number;
  roll: number;
}

function approach(
  current: number,
  target: number,
  response: number,
  minAlpha: number,
  maxAlpha: number,
): number {
  'worklet';
  const delta = target - current;
  const motion = Math.min(Math.abs(delta) / response, 1);
  const alpha = minAlpha + motion * (maxAlpha - minAlpha);
  return current + delta * alpha;
}

function approachAngle(current: number, target: number): number {
  'worklet';
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const motion = Math.min(Math.abs(delta) / 0.35, 1);
  const alpha = 0.35 + motion * 0.5;
  return current + delta * alpha;
}

/**
 * Official Fishjam VisionCamera + WebGPU publish path.
 *
 * The cowl texture is uploaded before the camera starts. During capture there
 * are no JS-thread GPU uploads and no custom WebRTC compositor. Pose updates are
 * a tiny uniform write from the frame worklet.
 */
export function useHostEffectsCameraSource({
  crtOn,
  maskOn,
  face,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: HostEffectsOptions): CameraPublish {
  const { device, error: deviceError } = useCameraWebGpuDevice();
  const crt = useMemo(
    () => (device ? buildCrt(device, width, height) : null),
    [device, width, height],
  );

  const [cowl, setCowl] = useState<CowlGpuEffect | null>(null);
  const [assetSettled, setAssetSettled] = useState(false);
  const [assetError, setAssetError] = useState<Error | null>(null);

  useEffect(() => {
    if (!device) {
      setCowl(null);
      setAssetSettled(false);
      setAssetError(null);
      return;
    }

    let live = true;
    setAssetSettled(false);
    setAssetError(null);

    void (async () => {
      const asset = Image.resolveAssetSource(
        require('../../../assets/models/wolverine_cowl.png'),
      );
      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error(`Cowl asset request failed: HTTP ${response.status}`);
      }
      const bitmap = await createImageBitmap(await response.arrayBuffer());
      const next = createCowlGpuEffect(device, bitmap, width, height);
      bitmap.close?.();

      if (!live) {
        next.texture.destroy();
        return;
      }
      setCowl(next);
      setAssetSettled(true);
    })().catch((cause) => {
      if (!live) return;
      setCowl(null);
      setAssetSettled(true);
      setAssetError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    });

    return () => {
      live = false;
    };
  }, [device, width, height]);

  // This is deliberately mutable worklet-local state, the same pattern Fishjam
  // uses for its pooled-surface cursor. It smooths sparse detector targets at
  // the actual camera publish cadence without any JS/RN round-trip.
  const poseState = useMemo<PoseState>(
    () => ({
      initialized: false,
      cx: 0.5,
      cy: 0.42,
      iod: 0,
      roll: 0,
    }),
    [device],
  );

  const onFrame = useCallback(
    (_frame: Frame, render: WebGpuFrameRenderFunction) => {
      'worklet';
      if (!device || !crt) return;

      render((context) => {
        const crop = computeAspectFillCrop(
          context.cameraWidth,
          context.cameraHeight,
          context.outputWidth / context.outputHeight,
        );

        if (crtOn.value) {
          // CRT is opt-in, so the normal camera path remains one render pass.
          encodeCameraPassthrough(
            device,
            crt.passthrough,
            context.cameraTexture,
            crt.interView,
            context.commandEncoder,
            crop,
          );
          const crtPass = context.commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: context.outputView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
              },
            ],
          });
          crtPass.setPipeline(crt.pipeline);
          crtPass.setBindGroup(0, crt.bind);
          crtPass.draw(3);
          crtPass.end();
        } else {
          encodeCameraPassthrough(
            device,
            crt.passthrough,
            context.cameraTexture,
            context.outputView,
            context.commandEncoder,
            crop,
          );
        }

        const target = face.value;
        if (
          !maskOn.value ||
          !cowl ||
          !target.present ||
          target.iod <= 0.02
        ) {
          poseState.initialized = false;
          return;
        }

        if (!poseState.initialized) {
          poseState.cx = target.cx;
          poseState.cy = target.cy;
          poseState.iod = target.iod;
          poseState.roll = target.roll;
          poseState.initialized = true;
        } else {
          poseState.cx = approach(poseState.cx, target.cx, 0.07, 0.36, 0.86);
          poseState.cy = approach(poseState.cy, target.cy, 0.07, 0.36, 0.86);
          poseState.iod = approach(poseState.iod, target.iod, 0.04, 0.3, 0.76);
          poseState.roll = approachAngle(poseState.roll, target.roll);
        }

        const cameraAspect = context.cameraWidth / context.cameraHeight;
        const center = frameToView(
          poseState.cx,
          poseState.cy,
          cameraAspect,
          context.outputWidth,
          context.outputHeight,
          context.cameraIsMirrored,
        );
        const viewIod =
          poseState.iod *
          coverScale(
            cameraAspect,
            context.outputWidth,
            context.outputHeight,
          );

        encodeCowlGpuEffect(
          device,
          cowl,
          {
            centerX: center.x,
            centerY: center.y,
            scale: viewIod / COWL.iod,
            roll: context.cameraIsMirrored
              ? -poseState.roll
              : poseState.roll,
          },
          context.outputView,
          context.commandEncoder,
        );
      });
    },
    [device, crt, cowl, crtOn, maskOn, face, poseState],
  );

  const gpuReady = Boolean(device && crt && assetSettled);
  const { frameOutput, stream, error } = useVisionCameraWebGpuSource(
    SOURCE_ID,
    {
      enabled: gpuReady,
      width,
      height,
      poolSize: 3,
      device: device ?? undefined,
      onFrame,
    },
  );

  return {
    frameOutput,
    stream,
    ready: gpuReady,
    error: error ?? deviceError ?? assetError,
  };
}

/**
 * Guest camera publishes without effects. YUV stays explicit because this app
 * supports foldables whose CameraX PRIVATE/native analysis combinations have
 * been unreliable; the host WebGPU path always uses Fishjam's required native
 * zero-copy format internally.
 */
export function useGuestCameraSource(): CameraPublish {
  const { frameOutput, stream, error } = useVisionCameraSource(SOURCE_ID, {
    pixelFormat: 'yuv',
  });
  return { frameOutput, stream, error, ready: true };
}
