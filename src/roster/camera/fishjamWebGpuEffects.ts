import {
  GPUBufferUsage,
  GPUShaderStage,
  GPUTextureUsage,
} from 'react-native-webgpu';
import { getOutputSurfaceFormat } from '@fishjam-cloud/react-native-vision-camera-source/webgpu';

import { COWL } from './cowlTemplate';

export interface CowlGpuEffect {
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  poseBuffer: GPUBuffer;
  texture: GPUTexture;
}

export interface CowlGpuPose {
  centerX: number;
  centerY: number;
  scale: number;
  roll: number;
}

const POSE_BYTES = 16;

function packPose(pose: CowlGpuPose): ArrayBuffer {
  'worklet';
  const buffer = new ArrayBuffer(POSE_BYTES);
  const values = new Float32Array(buffer);
  values[0] = pose.centerX;
  values[1] = pose.centerY;
  values[2] = pose.scale;
  values[3] = pose.roll;
  return buffer;
}

/**
 * One uploaded cowl texture + one static WebGPU pipeline.
 *
 * The only per-frame data is a 16-byte uniform:
 *   centerX px, centerY px, template scale, roll radians.
 */
export function createCowlGpuEffect(
  device: GPUDevice,
  bitmap: ImageBitmap,
  outputWidth: number,
  outputHeight: number,
): CowlGpuEffect {
  const texture = device.createTexture({
    label: 'danger-room-cowl',
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [bitmap.width, bitmap.height],
  );

  const bindGroupLayout = device.createBindGroupLayout({
    label: 'danger-room-cowl-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const poseBuffer = device.createBuffer({
    label: 'danger-room-cowl-pose',
    size: POSE_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shader = device.createShaderModule({
    label: 'danger-room-cowl-shader',
    code: /* wgsl */ `
struct Pose {
  value: vec4f,
}

@group(0) @binding(0) var cowlTexture: texture_2d<f32>;
@group(0) @binding(1) var cowlSampler: sampler;
@group(0) @binding(2) var<uniform> pose: Pose;

struct VOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VOut {
  var uvs = array<vec2f, 4>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0),
  );

  let uv = uvs[index];
  let center = pose.value.xy;
  let imageScale = pose.value.z;
  let roll = pose.value.w;

  let q = vec2f(
    uv.x * 370.0 - 184.54,
    uv.y * 468.0 - 302.45,
  );
  let cs = cos(roll);
  let sn = sin(roll);
  let rotated = vec2f(
    cs * q.x - sn * q.y,
    sn * q.x + cs * q.y,
  ) * imageScale;
  let pixel = center + rotated;

  var out: VOut;
  out.position = vec4f(
    pixel.x * (2.0 / ${outputWidth}.0) - 1.0,
    1.0 - pixel.y * (2.0 / ${outputHeight}.0),
    0.0,
    1.0,
  );
  out.uv = uv;
  return out;
}

@fragment
fn fs(input: VOut) -> @location(0) vec4f {
  return textureSample(cowlTexture, cowlSampler, input.uv);
}
`,
  });

  const pipeline = device.createRenderPipeline({
    label: 'danger-room-cowl-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module: shader, entryPoint: 'vs' },
    fragment: {
      module: shader,
      entryPoint: 'fs',
      targets: [
        {
          format: getOutputSurfaceFormat(),
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-strip' },
  });

  const bindGroup = device.createBindGroup({
    label: 'danger-room-cowl-bind-group',
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: texture.createView() },
      {
        binding: 1,
        resource: device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      },
      { binding: 2, resource: { buffer: poseBuffer } },
    ],
  });

  return { pipeline, bindGroup, poseBuffer, texture };
}

export function encodeCowlGpuEffect(
  device: GPUDevice,
  effect: CowlGpuEffect,
  pose: CowlGpuPose,
  outputView: GPUTextureView,
  commandEncoder: GPUCommandEncoder,
): void {
  'worklet';
  device.queue.writeBuffer(effect.poseBuffer, 0, packPose(pose));

  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: outputView,
        loadOp: 'load',
        storeOp: 'store',
      },
    ],
  });
  pass.setPipeline(effect.pipeline);
  pass.setBindGroup(0, effect.bindGroup);
  pass.draw(4);
  pass.end();
}
