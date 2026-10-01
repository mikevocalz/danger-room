# XR Pipeline — Phase 0 status (STOP + setup proposal)

Scope: `PROMPT_ViroFishjamStream.md` (native WebRTC→Viro texture) +
`PROMPT_SkiaInViro.md` (offscreen Skia→Viro quad for the roster plates).

## Verdict: STOP at Phase 0 (per Rule 2) — prerequisites absent

Both prompts require Phase 0 to cite **installed** Viro / RN-Skia / Fishjam native seams and to
author the scene through **viro-mcp**. Ground truth in this repo right now:

| Requirement | Status |
|---|---|
| `@reactvision/react-viro` (ViroCore sources to cite) | **NOT INSTALLED** |
| `expo-horizon-core` (Quest/PICO flavors, Rule 8) | **NOT INSTALLED** |
| `app.config.ts` (plugin config) | absent — repo uses `app.json` |
| viro-mcp (`mcp__viro__reactviro_*`) reachable this session | **NO** — tools did not resolve; per the tooling rule, scene authoring is blocked |
| `@fishjam-cloud/react-native-client` (data-plane source) | ✅ 0.29.0 |
| `@fishjam-cloud/react-native-custom-video-source` (Tier-B masked-track path) | ✅ 0.29.0 |
| `@shopify/react-native-skia` (plate draw source, PROMPT 2) | ✅ 2.6.2 |
| Existing roster plates to port (PROMPT 2 P0) | ✅ `src/roster/PlateHeader.tsx`, `RosterTile.tsx`, `HostPlate.tsx`, `ShowcaseCard.tsx` |

The data plane (Fishjam) and the Skia plate sources exist; **the Viro renderer, the Horizon build
integration, and the MCP scene-authoring path do not.** Writing the native texture pipeline against
un-installed ViroCore/`VROTextureSubstrateOpenGL`/`RNSkPlatformContext` symbols would violate Rule 1
(no invented APIs) and Rule 2 (no fabricated shapes). So: **no scene/native code is written until the
setup below lands.**

## What IS delivered now (the concrete ask)

- Lobby 3rd button **“◉ ENTER XR”** under START/JOIN ROOM → routes to `/xr`.
- `/xr` route (`src/app/xr.tsx`): the wired entry point that becomes the `ViroXRSceneNavigator`
  host once the pipeline lands. It states the blocker plainly rather than faking a scene.

## Setup that must precede Phase 0 recon (proposed, not run)

1. **Install** `@reactvision/react-viro`, `expo-horizon-core` (+ `expo-pico` for the PICO flavor).
   Verify pins against RN 0.86 / Expo SDK 57 first — Viro's SDK-57 support is the gating unknown and
   must be confirmed before committing (Viro tracks its own RN support matrix).
2. **Migrate** `app.json` → `app.config.ts`; add `expo-horizon-core` (`horizonAppId`,
   `supportedDevices`, …) + Viro's XR config plugin. `npx expo prebuild --clean`.
3. **Diff** the generated `AndroidManifest.xml` per flavor: prove `com.oculus.feature.PASSTHROUGH`
   is declared, WebRTC perms (`INTERNET`/`RECORD_AUDIO`/`MODIFY_AUDIO_SETTINGS`) survive the strip,
   and expo-horizon-core ↔ Viro plugin keys don't collide.
4. **Native rebuild** the dev client for the `questDebug` flavor.
5. **Then** Phase 0 recon can run: cite the Fishjam native `VideoTrack` holder + `EglBase`
   injectability, Viro's video-texture substrate constructors (Android GLES / iOS driver), the
   component-registration pattern, `ViroXRSceneNavigator` lifecycle + the passthrough seam, and
   enumerate viro-mcp — every seam cited or replaced by a cited alternative.

## Independent blocker (unrelated to XR)

The Fishjam **free-tier quota is exhausted** (`HTTP 402` from the sandbox room-manager). No room —
2D or XR — can join until the account quota resets or the plan is bumped at https://fishjam.io/app.

## Recommendation

This is a genuine multi-phase native project (weeks, on-device gated per phase), not a one-session
task, and it hard-depends on installing Viro + a headset build. Confirm you want Viro added to this
(previously Viro-free) app and that Viro supports SDK 57, then I'll run step 1 → Phase 0 recon and
proceed phase-gated.
