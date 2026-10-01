# TIER-B-PLAN — True filter-grade deformation (DECISION GATE · plan only)

> Per §8/§3.7: this is a **written plan and a decision gate**, not an implementation.
> It names a new native dependency, so nothing here is installed. **No Viro / XR — ever** (§9).

## 0. Why Tier A is not the ceiling

Tier A (shipped) makes a **rigid sprite genuinely stick**: landmark-anchored, cover-crop-registered,
One-Euro-filtered, rolling with the eye line, with faked clamped yaw/pitch. That is glasses / hat /
mask-plate grade. MLKit gives a bounding box, ~10 landmarks, and 3 Euler angles — it **cannot**
deform with the jaw/brows, drive expressions, or occlude correctly. The full Snapchat/Instagram bar
is a **dense-mesh** system. That is Tier B.

## 1. Dependency (the gate)

- **MediaPipe Face Landmarker** (`com.google.mediapipe:tasks-vision`, Android; `MediaPipeTasksVision`
  CocoaPod, iOS). 478 landmarks + 52 blendshapes + a 4×4 facial transformation matrix per face.
  License **Apache-2.0**; task model `face_landmarker.task` (~3.7 MB) shipped as a bundled asset.
- Wrapped as a **Nitro frame-processor plugin** — the same HybridObject shape VisionCamera 5.2.1 and
  `react-native-vision-camera-face-detector` already use (`com.margelo.nitro.*`), so it composes as a
  second `CameraOutput` on the existing single `useCamera`, exactly like today's detector. No second
  camera owner (§7.1 holds).
- **This is the gate:** a new native dep + `expo prebuild` + rebuild. Do not install without sign-off.

## 2. Data discipline

- The 478×vec3 landmark buffer and the blendshape/matrix data stay **native/GPU-resident**. Never
  marshal per-frame into JS (that is the defect-2 flood at 30×). JS receives only what the renderer
  can't: nothing on the hot path; at most a low-rate "face present / trackingId" tick for lifecycle.
- Mesh vertices are written into a GPU vertex buffer on the native/worklet side each frame.

## 3. Mesh + render

- Face mesh built at runtime from the landmarks with **UVs/topology inherited from the canonical
  MediaPipe face model** (fixed index list). Rigid attachments (ears/fangs/cowl-shell) **parent to the
  4×4 transformation matrix**; soft features driven by **blendshapes**.
- Render order: **depth-prepass occluder** (the face writes depth so the mesh self-occludes and the
  real face occludes attachments correctly) → mesh color pass → attachments.

## 4. Publish-path integration — the hard question, answered per platform (§7.4)

- **iOS 17+:** publish through `useVisionCameraWebGpuSource` (`@fishjam-cloud/react-native-vision-camera-source/webgpu`,
  already installed). The mesh composites in the **TypeGPU/WebGPU pass before publish**, so **remote
  viewers receive the mask baked into the track**. This is the clean answer and the reason to prefer
  the WebGpu source on iOS. WGSL compositing is NOT implemented in this restructure — it is Tier B.
- **Android (no WebGPU publish source):** two candidates, cost stated:
  1. **`@fishjam-cloud/react-native-custom-video-source`** (installed, `0.29.0`) as the *masked-track
     publisher* — the Tier B mesh renderer becomes the frame source, so viewers receive the mask.
     Cost: the renderer must produce publish frames (a full offscreen GPU pass feeding the custom
     source's lifecycle), and it must reconcile with the Skia "Roster Console" chassis (the mesh is
     GPU, the chassis is Skia — composited as sibling native views under `pointerEvents="none"`).
  2. **Sender-side overlay only** (Tier A's model extended) — the mesh renders as a local overlay;
     viewers see the *unmasked* track. Cheapest, but fails the "viewers see my mask" goal on Android.
  - Recommendation to evaluate first: (1), because it matches the 0.29.0 custom-sources thesis
    ("AR filters, on-device ML overlays"); fall back to (2) if the offscreen-publish cost or the
    Skia/GPU compositing proves too heavy on mid-tier phones.

## 5. Per-frame budget (targets to MEASURE before commit — not promises)

On a Pixel 6a / iPhone 13-class target, MASK-on: Landmarker inference ≤ ~12 ms (GPU delegate), mesh
build + upload ≤ ~3 ms, render pass ≤ ~4 ms — leaving headroom under a 33 ms (30 fps) frame. These are
**targets to measure in a spike**, never shipped as measured numbers.

## 6. Risks

- Model load + first-inference warmup (mask "pops in" ~1 s after toggle) — mitigate with the idle plate.
- Thermal: dense inference + GPU render sustained is the real soak risk (measure, don't tune away).
- Android publish-path (§4.2.1) is the largest unknown — spike it first.
- Occlusion depth-prepass correctness across the mirrored front-camera space.

## 7. Tier B's own phases (only after sign-off)

1. **Spike:** Landmarker Nitro plugin, landmarks → shared buffer, on-device inference budget measured.
2. **Mesh:** canonical topology + matrix-parented attachments + blendshapes, sender-side overlay.
3. **Occlusion:** depth-prepass.
4. **Publish path:** iOS WebGpu compositing; Android custom-video-source spike → decision.
5. **Verify:** the §5 Phase-5 protocol re-run at Tier B fidelity.

**STOP for sign-off before Phase 1.**
