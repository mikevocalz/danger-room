# Realtime media architecture — mobile filters, Fishjam, RTMP and XR

## Decision

Danger Room keeps **Fishjam/WebRTC** as the interactive room transport.

- Mobile camera capture is owned by VisionCamera.
- Fishjam's VisionCamera custom source is the room publisher.
- Face inference runs in a separate low-resolution analysis output.
- Published visual effects should move to Fishjam's official WebGPU source path.
- Viro consumes received Fishjam video tracks through `ViroExternalVideo`.
- Rive is the transparent interactive chrome layered in front of those video surfaces.
- `react-native-nitro-rtmp` is optional **broadcast egress**, never the room transport.

## Why Fishjam remains the transport

The current Fishjam VisionCamera integration is already the low-copy native path.
It owns track timestamps, orientation, frame lifetime, GPU/encoder synchronization
and publishing to the room. Remote peers arrive as real MediaStreams and remain
compatible with screen share, microphone audio, room membership and the existing
Viro WebRTC Surface bridge.

For camera filters, use `useVisionCameraWebGpuSource` rather than adding another
overlay inside the WebRTC encoder. The WebGPU source gives each worklet a camera
GPU texture and an encoder-backed output texture; Fishjam owns the fencing and
submission lifecycle. One render graph can perform:

1. camera aspect-fill / passthrough
2. CRT or other full-frame shader
3. face-attached PNG/mesh overlay
4. future segmentation/background pass

The result is the actual published custom video track, so mobile, web and XR see
the same pixels.

## Face analysis lane

The face detector remains `react-native-vision-camera-face-detector`.

```
VisionCamera CameraSession
├─ Fishjam publish output (native/copy-free or WebGPU)
└─ 640x480 YUV analysis output
   └─ ML Kit FAST + landmarks + tracking
      ├─ dropFramesWhileBusy
      └─ <=24 Hz detector target
          ├─ Android/WebGPU publish overlay target
          └─ Reanimated display-rate interpolation (60/90/120 Hz)
```

Contours are not requested on the always-on path because ML Kit tracking and
contours are a poor pairing and contours add inference cost. Head-turn scale is
approximated from eye distance + face-box width. Dense geometry belongs to the
precision tier below.

## MediaPipe precision tier

MediaPipe Face Landmarker is useful when a filter actually needs dense 3D face
geometry rather than just a stable rigid attachment:

- dense face landmarks / face mesh
- facial transformation matrix for effect rendering
- blendshapes / expression-driven effects

Do **not** run MediaPipe and ML Kit at full rate simultaneously. The intended
tiering is:

- ordinary helmet/mask/glasses filter: ML Kit fast path only
- precision 3D filter: MediaPipe owns precision tracking, with detector cadence
  reduced/disabled while its track is healthy
- face recognition/liveness: a separate opt-in capability, never part of the
  ordinary AR filter loop

The Margelo face-recognition demo's useful lesson is its architecture, not its
models. YuNet detects faces, SFace performs identity embeddings, and MiniFASNet
does liveness; those models do not replace a face-mesh/AR tracking model.

## Why Nitro RTMP does not replace Fishjam

`react-native-nitro-rtmp` is a strong native broadcast stack: VisionCamera
output, native GPU mixer/layers, hardware H.264/AAC and RTMP/RTMPS publishing.
It is built to send a composed program feed to an RTMP server.

That is different from an interactive room:

| Capability | Fishjam/WebRTC | Nitro RTMP |
| --- | --- | --- |
| bidirectional room participants | yes | no |
| per-peer incoming tracks | yes | no |
| low-latency conversation | yes | broadcast-oriented |
| screen share / room membership | yes | not a room protocol |
| Viro remote-track Surface bridge | already implemented | no subscriber/decoder path |
| direct RTMP/RTMPS broadcast | not its role | yes |
| hardware H.264/AAC egress | WebRTC encoder path | yes |

If Danger Room later gets a **Broadcast to YouTube/Twitch/custom RTMP** button,
Nitro RTMP is a good optional output from the same VisionCamera session. Running
it beside Fishjam means a second encoder/network path, so enable it only while
broadcasting and do not let it own the room microphone at the same time.

## XR composition

The Quest path now uses the same live Fishjam participant streams as mobile.

```
Fishjam remote MediaStream
  -> stream.toURL() tag
  -> ViroExternalVideo
  -> ExternalSurfaceTexture / Android Surface
  -> Viro material
  -> video quad
  -> transparent Rive participant plate in front
```

`ViroExternalVideo` resolves the RN-webrtc stream tag natively through the
patched `ExternalVideoSurfaces` registry. Video frames therefore do not bounce
through JS or get copied into a React texture.

Each plate is layered:

1. fallback/background
2. live video material
3. Rive plate artboard (transparent media viewport)
4. optional Rive controls/status badges

The Rive artboard must leave the media viewport alpha-transparent. The current
Viro fork's `ViroRivePanel` uses the AHardwareBuffer route on Android and
supports direct Data Binding values, so participant name, role, mute/speaking
state and controls can update without recreating the video Surface.

## Platform note

`ViroExternalVideo` is currently Android-only. Quest/Horizon is therefore the
first production target for spatial remote video. Vision Pro needs the matching
CVPixelBuffer/IOSurface producer path before the same bridge can be claimed
there.
