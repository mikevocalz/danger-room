# Roster Console — BIGO-style seat grid over Fishjam

Skia-drawn broadcast chassis for a live room: seat grid with full-bleed
animated marks on open seats, host-plate-ready bevel primitive, and a
capability-gated publish pipeline for Fishjam 0.29.0.

## Requirements

- react-native >= 0.79, react >= 19
- @shopify/react-native-skia >= 2.x
- @fishjam-cloud/react-native-client
- @fishjam-cloud/react-native-vision-camera-source (0.29.0) + VisionCamera
  — only imported by `camera/usePublishSource.ts`

## Architecture

Skia cannot sample a live video track. Every tile is therefore:

1. **Native layer** — Fishjam's video renderer, absolutely positioned into
   the cutout rect from `tokens.cutout()`.
2. **Chrome layer** — a pointerEvents="none" Canvas over it. The chassis is
   one even-odd path (outer rrect minus cutout), so the centre is genuinely
   transparent and the feed shows through.

Both layers derive their geometry from the same `cutout()` call — the feed
cannot drift out of its hole.

## Seat states (`RosterTile.state`)

| state      | interior                                             |
|------------|------------------------------------------------------|
| `empty`    | SkSL void ambience + full-bleed neon sweep mark; tappable via `onPress` |
| `joining`  | same layer, sweep frozen, pending amber              |
| `occupied` | video feed; if `videoSlot` is absent, small static red mark on plain void |

Occupied-camera-off deliberately does NOT look like an open seat.

## Shader split

- **SkSL (`shaders.ts`)** — the room's presentation: seat ambience, mark
  sweep, halos. Runs on every viewer's device, identical everywhere.
- **WGSL (`camera/roomGrade.ts`)** — the *feed's* look, baked into the
  published track on WebGPU-capable publishers (iOS 17+). Kept subtle so
  graded and ungraded feeds share a grid cleanly.

## Wiring

```tsx
import {
  RosterGrid,
  makeCircledX,
  usePublishSource,
} from './roster';

const mark = makeCircledX({ armSpan: 52, armWidthOuter: 16, ringGap: 9 });

function Room({ peers, localId }) {
  const { pipeline } = usePublishSource(); // pipeline.reason → debug panel

  return (
    <RosterGrid
      columns={3}
      slots={12}
      glyph={mark}
      peers={peers.map(p => ({
        id: p.id,
        name: p.metadata.username,
        state: 'occupied',
        videoSlot: p.cameraTrack
          ? <VideoRendererView trackId={p.cameraTrack.id} />
          : undefined,
        speaking: p.isSpeaking,
        level: p.audioLevel,
        isSelf: p.id === localId,
      }))}
    />
  );
}
```

`RosterGrid` pads to `slots` with `state: 'empty'` seats automatically.

## Device-test gate

1. Install the Fishjam camera-source package.
2. Remove the `@ts-expect-error` in `camera/usePublishSource.ts`.
3. `tsc --noEmit` — the import line is the verification gate; a failure
   there means 0.29.0's shipped types differ from the release-note names,
   and only that file needs to change.
4. iOS 17+ → expect `pipeline.kind === 'webgpu'`; elsewhere `'plain'`.

Open seam: where 0.29.0 accepts a custom TypeGPU pipeline is unconfirmed —
`roomGrade` exports the WGSL + params ready to bind once the package's
`.d.ts` confirms the hand-off point.

## Demo-only

The circled-X mark evokes a trademarked design; this set is for a private
demo and not for distribution.
