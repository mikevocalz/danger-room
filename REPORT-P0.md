# REPORT-P0 — Seam Citation Gate (BLOCKING)

Every claim below is cited to an installed file under `node_modules/` at the repo's
current lockfile state. **Headline: the §6 reference shapes assume _classic_
VisionCamera (frame processors). This repo runs the _Nitro_ rewrite (5.2.1), which
has a different — and, for the prompt's defect-2/defect-5 concerns, strictly better —
frame path. This is a §3.6 / §8 "installed shape differs from §6 → STOP AND REPORT"
condition.** No capability is missing; no new native dep or Expo change is required.
The adaptation is mechanical. Proposed corrected shapes are in §P0.9.

---

## P0.1 — Installed versions (from resolved `node_modules/<pkg>/package.json`)

| Package | Version | Note |
|---|---|---|
| `react-native-vision-camera` | **5.2.1** | **Nitro rewrite**, not classic 3/4 |
| `react-native-vision-camera-face-detector` | **2.0.6** | Nitro-native, MLKit `com.google.mlkit:face-detection:16.1.7` |
| `react-native-worklets-core` | **NOT INSTALLED** | §6/§4 assume it — absent |
| `react-native-worklets` | **0.10.1** | Reanimated-4 worklet runtime (present) |
| `react-native-reanimated` | **4.5.1** | |
| `@fishjam-cloud/react-native-client` | **0.29.0** | |
| `zustand` | **5.0.14** | |
| `react-native-nitro-modules` | **0.36.5** | powers both VisionCamera + the detector |

Babel (`babel.config.js:5-8`): worklets plugin is injected by `babel-preset-expo`
(Reanimated 4), i.e. `react-native-worklets`, **not** `react-native-worklets-core/plugin`.
§4's "confirm `react-native-worklets-core/plugin` present" is moot — the worklet
runtime is present via a different, correct plugin.

---

## P0.2 — VisionCamera API actually present (Nitro)

`node_modules/react-native-vision-camera/lib/index.d.ts` exports: `useCamera`,
`useCameraDevice`, `useFrameOutput`. **Absent:** `useFrameProcessor`, `runAsync`,
`runAtTargetFps`, `useCameraFormat`/`getCameraFormat`, a `<Camera frameProcessor …/>`
component, `VisionCameraProxy`/`initFrameProcessorPlugin`.

Frame path (Nitro) — `lib/hooks/useFrameOutput.d.ts` + `lib/specs/outputs/CameraFrameOutput.nitro.d.ts`:
`useFrameOutput({ onFrame(frame){'worklet'…}, onFrameDropped, ...FrameOutputOptions })`
returns a **`CameraOutput`** you pass to `useCamera({ device, isActive, outputs:[…] })`.
`FrameOutputOptions` fields (cited): `targetResolution: Size`, `pixelFormat`,
`dropFramesWhileBusy`, `enablePhysicalBufferRotation`, `enablePreviewSizedOutputBuffers`,
`enablePhysicalBufferRotation`. **`dropFramesWhileBusy` is the Nitro equivalent of
`runAsync`'s drop-while-busy; `targetResolution` is the Nitro equivalent of
`useCameraFormat({videoResolution})` (§3.13 720p discipline).**

Frame orientation — `lib/specs/instances/Frame.nitro.d.ts` + `common-types/CameraOrientation.d.ts`:
`frame.orientation: CameraOrientation = 'up' | 'down' | 'left' | 'right'`; `frame.isMirrored`.
**Load-bearing, already patched:** the front sensor's computed "up" is 180° inverted on
this device family; corrected via `patches/@fishjam-cloud+react-native-vision-camera-source+0.29.0.patch`
(`rotation = (rotationDegreesFromOrientation(frame.orientation)+180)%360`). Any frame→view
map (§6.7) must be consistent with that.

Current publish/detection code today (`src/roster/camera/usePublishSource.ts:179`,
`src/app/room.tsx:322,340`): host publishes via fishjam `useVisionCameraSource({pixelFormat:'yuv'})`;
detection currently attached as a **`useFaceDetectorOutput` CameraOutput** — i.e. detection
does **not** run synchronously in a JS worklet today, and there is **no** `runAsync`/
`runAtTargetFps` wrapper (they don't exist here). Defect-5's "synchronous processor blocks
the thread" root cause as written **does not apply** in the Nitro model; the equivalent lever
is `targetResolution`+`dropFramesWhileBusy` on the output (see §P0.9).

---

## P0.3 — Face detector API (Nitro) — landmark anchoring IS reachable

`node_modules/react-native-vision-camera-face-detector/lib/typescript/src/`:

- **Integration A (used today):** `useFaceDetectorOutput(opts): CameraOutput`
  (`hooks/useFaceDetectorOutput.d.ts`). `opts` (`specs/FaceDetectorFactory.nitro.d.ts` +
  `specs/ImageFaceDetectorFactory.nitro.d.ts`): `performanceMode: 'fast'|'accurate'`,
  **`runLandmarks?: boolean`**, `runContours?`, `runClassifications?`, `minFaceSize?`,
  `trackingEnabled?`, `cameraFacing?`, `outputResolution?: 'preview'|'full'`,
  `onFacesDetected(faces: Face[])`, `onError`. **No `landmarkMode`/`contourMode`/
  `classificationMode` and no `autoMode`/`windowWidth`/`windowHeight`.**
- **Integration B:** `useFaceDetector(opts): { detectFaces(frame) }` for use inside a
  `useFrameOutput({onFrame})` worklet (`hooks/useFaceDetector.d.ts`).

**§3.3 landmark anchoring resolved:** `runLandmarks: true` → native
`FaceDetectorOptions+toMLFaceDetectorOptions.kt:57-59` sets `LANDMARK_MODE_ALL`;
`HybridFace.kt:148-157` populates `LEFT_EYE, RIGHT_EYE, NOSE_BASE, LEFT_EAR, RIGHT_EAR,
LEFT_CHEEK, RIGHT_CHEEK, MOUTH_LEFT, MOUTH_RIGHT, MOUTH_BOTTOM`. (Default is `LANDMARK_MODE_NONE`
— **current code omits `runLandmarks`, so landmarks are absent today; this is why Tier A
isn't met yet.**)

`Face` shape (`specs/Face.nitro.d.ts`): `bounds: {x,y,width,height}`, `landmarks?: Landmarks`,
`contours?`, `pitchAngle`, `rollAngle`, `yawAngle` (MLKit Euler X/Z/Y, degrees),
`leftEyeOpenProbability?`, `rightEyeOpenProbability?`, `trackingId?`, **`frameWidth`,
`frameHeight`**. `Landmarks` points and `bounds` are in **frame pixels** (0..frameWidth/Height).

---

## P0.4 — Frame→view registration must be done by us (no native view-space mode)

`autoMode`/`windowWidth`/`windowHeight` are **absent** from the installed options (grep of
`specs/FaceDetectorFactory.nitro.d.ts` returns nothing). Therefore §6.7 `frameToView` is
**required** — map frame-pixel bounds/landmarks through the preview's cover/aspect-fill
scale + symmetric crop + front-camera mirror. No eyeballed fudge (§3.4).

---

## P0.5 — Worklet↔JS bridge

`react-native-worklets-core`'s `useRunOnJS`/`Worklets.createRunOnJS` (§6.4) **do not exist**
here. `runOnJS` is available (`react-native-worklets` / reanimated). **But Integration A's
`onFacesDetected` is already a JS-thread callback fired by the native output only when
detection completes — no per-frame `runOnJS` marshalling occurs.** This _structurally
eliminates_ defect-2's "JS thread flooded by per-frame `runOnJS`" without any of §6.4's
worklet plumbing. Recommended: keep Integration A.

---

## P0.6 — Reactions transport (§6.5 decision)

`@fishjam-cloud/react-native-client` exports **`useDataChannel`** (`publishData` /
`subscribeData`, ephemeral) AND `useUpdatePeerMetadata` / `usePeers`. Per §6.5 "swap to a
dedicated event API iff one is cited" — **`useDataChannel` is cited, so use the data channel**
(not the metadata-nonce fallback). Already in use (`src/components/Reactions.tsx`).

---

## P0.7 — Publish path, decisively (v3 §7)

Installed: `@fishjam-cloud/react-native-vision-camera-source@0.29.0` **and**
`@fishjam-cloud/react-native-custom-video-source@0.29.0` (the Tier-B Android candidate, §8).

`useVisionCameraSource(SOURCE_ID,{pixelFormat:'yuv'})`
(`dist/typescript/useVisionCameraSource.d.ts`) returns **`{ frameOutput: CameraFrameOutput,
stream }`** — a **`CameraOutput`**, NOT a `frameProcessor` for a `<Camera>` component. This
**decides §6.4's final form**: there is no worklet `frameProcessor` to compose into. Publish is
one `CameraOutput`; detection (`useFaceDetectorOutput`) is a second `CameraOutput`; **both are
handed to a single `useCamera({ outputs:[frameOutput, faceOutput] })`**.

**§7.1 single owner — defect-5(d) is ABSENT:** VisionCamera (`useCamera`) is the sole camera
owner; Fishjam publishes *through* `frameOutput`, not via any concurrent SDK capture. There is
one `useCamera` per active role (host `HostStage` at `room.tsx:340`, guest `ViewerStage` at
`:480` — mutually exclusive, never both). No dual ownership to unify.

**§3.14 publish-first — structurally satisfied, no worklet ordering needed:** publish and
detection are *independent* `CameraOutput`s fed by the native session. The published frame is
delivered by the pipeline regardless of detector cost; detection can never delay, drop, or gate
a published frame because it is not in the publish frame's path. This is stronger than the
§6.4/§3.14 "call publish first inside the worklet" model (which presumes a single shared
frame processor that does not exist here).

**Remount rebind:** on remount of the capture component the CameraX session is torn down +
rebuilt and the track re-attaches; §3.9's purple SkSL idle plate covers the gap. The publish
source **can** rebind across a remount (no §9 renegotiation trigger). Realized today as
`<CaptureDriver key=…>`.

## P0.8b — Viro / XR (v3 §1, §9)

`grep -rn viro|Viro|reactvision src` → **zero references**. No Viro/XR dependency, import, or
target anywhere. Nothing in this restructure introduces one.

---

## P0.8 — Tooling / Expo (expo-mcp)

`expo-mcp` requires an interactive OAuth handshake (`authenticate` / `complete_authentication`)
that cannot be completed headlessly in this run — flagged, not silently skipped. Static facts
that gate the restructure: this is a pure JS/TS restructure over **already-installed, already-
compiled** native deps (VisionCamera + face-detector were built into the current dev client,
`BUILD SUCCESSFUL`). It touches **no** `app.json`, config plugin, or prebuild input, so no SDK-57
config implication applies. Any claim otherwise will be re-verified via expo-mcp once
authenticated before relying on it.

---

## P0.9 — Corrected reference shapes (Nitro) — the renegotiation §8 asks me to cite

Only the code shapes change; D1–D5 and every §3 non-negotiable still hold.

- **§6.4 `MaskedCapture`** (replaces `useFrameProcessor`+`runAsync`+`runAtTargetFps`+`useRunOnJS`):
  ```tsx
  const { frameOutput } = useGuestCameraSource();            // publish track
  const faceOutput = useFaceDetectorOutput({
    performanceMode: 'fast', cameraFacing: 'front',
    runLandmarks: true,                                       // §3.3 — enables LANDMARK_MODE_ALL
    trackingEnabled: true, minFaceSize: 0.2,
    outputResolution: 'preview',                              // §3.13 detection buffer, not full res
    onFacesDetected: (faces) => onFaceTick(computeTick(faces[0])),  // JS thread, only on detect
    onError: () => {},
  });
  useCamera({ device:'front', isActive, outputs:[frameOutput, faceOutput] });
  ```
  Backpressure is native to the output (drop-while-busy); no `runAtTargetFps`. `computeTick`
  builds the landmark-anchored payload (eye midpoint, IOD, roll/yaw/pitch) on the JS side.
- **§6.2 remount seam:** already realized as `<CaptureDriver key={trackFace?'face':'plain'}/>`
  (equivalent to `HostCapture` → `MaskedCapture`/`CleanCapture`). Phase 1 renames to the §6 file
  layout for fidelity.
- **§6.7 anchoring/registration/One Euro:** unchanged in intent; `computeAnchor` reads
  `f.landmarks.LEFT_EYE/RIGHT_EYE/NOSE_BASE` (frame px), `frameToView` uses `f.frameWidth/Height`
  + preview cover-map + mirror; One Euro on the JS tick; ≤ one-tick linear bridge into shared values.
- **§6.5 transport:** `useDataChannel` (cited), not metadata-nonce.

---

## STOP — per §8

The installed VisionCamera/worklets/detector shapes differ from §6 (classic-vs-Nitro). Per §3.6
and §8 I am reporting rather than silently adapting. **Nothing above needs a new native dep or an
Expo change; the corrected Nitro shapes in §P0.9 meet every deliverable.** Requesting go-ahead to
implement Phases 1–4 against §P0.9 (Phase 5 on-device verification is separately blocked: the test
phone is currently disconnected from adb).
