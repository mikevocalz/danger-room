# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Fishjam + Viro notes

**Fishjam (live rooms).** Fishjam is intentionally pinned at 0.29.0 because this repo carries versioned `patch-package` patches for that release. The camera path now uses VisionCamera 5.2.3. Two local Fishjam patches live in `patches/` and are applied by the `postinstall` step:

- `@fishjam-cloud/react-native-vision-camera-source` — front-camera 180° rotation fix.
- `@fishjam-cloud/react-native-webrtc` — native GL cowl compositor that bakes the face-tracked cowl into the published track, so guests see it too (Android only; the local preview stays the Reanimated overlay).

Heads-up: the Fishjam free tier can return **HTTP 402** (quota) — room joins fail until the quota resets or you upgrade at [fishjam.io/app](https://fishjam.io/app).

**Viro / XR (Quest).** The Expo 58 migration pins the current private `mikevocalz/viro` fork at `b4cd6aaf62ecc5f004f53da6ef271654cd19d044` (`3.0.1-moyo.0`) plus the paired `nitro-canvas-in-Vision` Rive/AHardwareBuffer runtime. `xRMode: ["QUEST"]` remains enabled with `expo-horizon-core@57.0.2` — currently the latest published Horizon package — and panel dimensions MUST be dp strings (`1024dp`/`640dp`). ENTER XR routes to `/xr`, where `ViroXRSceneNavigator` launches the immersive VRActivity; the app always cold-starts in 2D. The passthrough toggle flips `visible` on the skybox sphere — never unmount Viro texture nodes (SIGSEGV). Viro's GVR audio is silent on Quest, so the spatial theme plays through `react-native-audio-api` (StereoPanner).

Builds:

```bash
npm install
npm run doctor
npm run typecheck
npx expo prebuild --clean

# Standard Android / foldables
npm run android

# Meta Quest / Horizon
npm run quest
```

`npm run android` explicitly targets `mobileDebug`; `npm run quest` targets `questDebug`. This matters because `expo-horizon-core` creates both product flavors and a bare `expo run:android` can be ambiguous.

**Rive spatial skin.** Danger Room keeps the existing Viro geometry as a fallback, then overlays the fork's GPU-backed `ViroRivePanel` surfaces when a compiled Rive file is configured. The native deferred Rive path currently targets Android 14/API 34+ (Quest) and uses AHardwareBuffer rather than a JS pixel-copy loop.

```bash
EXPO_PUBLIC_DANGER_ROOM_RIVE_URL=https://your-cdn.example/danger-room.riv
EXPO_PUBLIC_DANGER_ROOM_RIVE_PLATE_ARTBOARD=ParticipantPlate
EXPO_PUBLIC_DANGER_ROOM_RIVE_HUD_ARTBOARD=DangerRoomHUD
EXPO_PUBLIC_DANGER_ROOM_RIVE_STATE_MACHINE=Main
```

The authored Rive View Model should expose `participant.name`, `participant.role`, `participant.active`, `hud.title`, `hud.mode`, `hud.themePlaying`, and `hud.guestCount`. See `docs/SDK58-SPLIT-VIRO-RIVE.md` for the full migration and foldable/Quest acceptance checklist.

Native changes (`patches/`, local modules, config plugins, Viro/Nitro SHAs) require a rebuild; JS-only changes just need Metro (port 8090).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
