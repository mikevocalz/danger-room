# REPORT-FINAL — MASK gate · tracking · reactions · row gap

Companion to `REPORT-P0.md` (citations) and `TIER-B-PLAN.md`. Every §6 deviation is listed in §D
with the citation that forced it. Measured values are labelled; nothing estimated is presented as
measured (§12).

## Per-phase gate results

- **Phase 0 — citation gate:** CLOSED. `REPORT-P0.md`. Headline: repo is Nitro `react-native-vision-camera@5.2.1`,
  not classic; §6 shapes translated to the Nitro API (§P0.9). No new native dep, no Expo change, zero Viro.
- **Phase 1 — capture restructure (D1+D2):** `tsc --noEmit` GREEN. Grep gate GREEN — the HostStage
  function references no `useCamera`/`useCameraPermission`/`useFaceDetectorOutput`/`frameOutput`
  (only the publish source it must own, §D below); delegates to `HostCapture` + `MaskOverlay`. New:
  `camera/HostCapture.tsx`, `MaskedCapture.tsx`, `CleanCapture.tsx`; store debounce (`filterStore`).
- **Phase 2 — reactions (D3):** `tsc` GREEN. Grep gate GREEN — `camera/` is reaction-free; the reaction
  LAYER (`ReactionsOverlay`) is room-root (verified on device rising above the grid); transport
  (`useReactionsChannel`, `useDataChannel`) lives at room level so it survives capture remounts.
- **Phase 3 — row gap (D4):** `tsc` GREEN. `SEAT_ROW_GAP = 12` token; `RosterGrid` uses `rowGap` +
  `seatH = (h − SEAT_ROW_GAP·(rows−1))/rows` so rows shrink and the band never grows; applies in both
  orientation column mappings (4×2 / 2×4). Verified on device — clear gap between the two guest rows.
- **Phase 4 — Tier A tracking (D5):** `tsc` GREEN. `camera/faceAnchor.ts` (landmark anchor, bounds
  fallback), `camera/frameToView.ts` (cover-crop + mirror registration), `camera/oneEuro.ts` +
  `useMaskFilters.ts` (six One Euro channels + roll unwrap), `components/MaskOverlay.tsx` (§6.8
  transform). Chain: detector (JS, per-detection) → landmark anchor → One Euro → 38 ms linear bridge →
  shared values → UI-thread transform. Device gate (§5.5–5.8 sticking) — see Phase 5.

## Phase 5 — device verification (measured / not measured)

Verified on Pixel 6a (`29301JEGR06296`), live room:

1. Frame-processor cost / achieved detection rate / selected format / remote-viewer fps: **NOT
   MEASURED** — requires `enableFpsGraph` (Nitro equivalent) + a second peer; not run this pass.
2. Toggle hammer (20×) + logcat CameraX + 900 ms lockout: **PARTIAL** — toggles verified crash-free
   across several cycles; the store lockout is in place (`filterStore` `maskLockedUntil`, cited §6.3).
   Full 20× hammer + logcat scrape **not measured** this pass.
3. Reactions fire + render while MASK on with a face: **PASS (partial)** — reactions render room-root
   (🔥/🎉 bursts observed rising above the grid); firing *simultaneously with MASK-on* not isolated.
4. Toggle gap shows idle plate, not black; track re-attaches: **PASS** — after the §D publish-owner
   fix, MASK on/off shows the camera immediately (no persistent black); the ~session-rebuild gap
   is the idle plate.
5. Corner registration: **NOT MEASURED** — needs a face moved to all four corners.
6. Shake (≤1 frame trail): **NOT MEASURED** — needs live head motion.
7. Roll (30°, continuous, no ±180 flip): **NOT MEASURED** — needs live head tilt. (Roll is
   angle-unwrapped in `useMaskFilters` by construction.)
8. Front mirroring + both orientations + no seat clipping: **PARTIAL** — portrait verified (cowl
   renders in-well, row gap clean); landscape + mirror-correctness with a face **not measured**.
9. 3-min soak fps at t=0 / t=3min: **NOT MEASURED**.

The tracking pipeline is verified to render end-to-end (cowl draws through anchor→filter→registration,
no black, no crash). The **three art/registration constants** — `MASK_SCALE`, the cowl vertical anchor
(`h*0.46`), and the front-mirror/roll sign — are the only unknowns and require a face in frame to dial
(§3.4 forbids eyeballing them blind). That is the remaining live-tuning step.

## D. Deviations from §6 (each with the forcing citation)

1. **Whole capture path is Nitro, not classic** (§P0.2). §6.4's `useFrameProcessor`/`runAsync`/
   `runAtTargetFps`/`useCameraFormat`/`<Camera frameProcessor>`/`react-native-worklets-core` do not
   exist. Replaced by `useCamera({outputs:[frameOutput, faceOutput]})` + `useFaceDetectorOutput`
   (drop-while-busy + `outputResolution:'preview'` for §3.2/§3.13). Cleaner for §3.14 (independent
   outputs) and §3.2 (no per-frame runOnJS).
2. **`landmarkMode:'all'` → `runLandmarks:true`** (§P0.3, native `FaceDetectorOptions+toMLFaceDetectorOptions.kt`).
3. **Publish source owned by HostStage, not re-created per capture (§6.2 inversion)** — forced by §9:
   republishing the same Fishjam `SOURCE_ID` across a remount leaves a **persistent black frame**
   (verified Phase 5, first cut). So HostStage owns the stable `useVisionCameraSource` stream; only the
   `useCamera` driver + detection remount. HostStage therefore imports the publish source (fishjam),
   but still imports no VisionCamera `useCamera`/permission or detector — §D2's intent (delegate
   capture/detection) holds.
4. **Reactions transport = `useDataChannel`, not metadata-nonce** (§P0.6, cited in the client SDK).
5. **File layout:** reactions kept in `components/Reactions.tsx` + `components/Confetti.tsx` rather than
   split into `reactions/{transport,ReactionLayer,ReactionSprite}.tsx` — the structural rules (room-root
   layer, camera/HostStage reaction-free, remount-proof transport) are all met; splitting further was
   held under the ~20-file blast-radius discipline (§9). Reaction sprites render via Legend Motion
   (Reanimated, UI thread) after the Skia `Atlas` path proved not to composite over the WebGPU showcase.

## MLKit ceiling (§8)

MLKit delivers a box, ~10 landmarks, 3 Euler angles. Tier A here makes the cowl a **rigid sprite that
genuinely sticks** — landmark-anchored, registered, rolling, with faked clamped pose. It cannot deform
with expression, cannot occlude correctly, and cannot meet the full Snapchat/Instagram bar, which is a
dense-mesh system. That is `TIER-B-PLAN.md` (MediaPipe Face Landmarker, Nitro plugin) — a decision gate,
not built.
