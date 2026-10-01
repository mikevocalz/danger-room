# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Fishjam + Viro notes

**Fishjam (live rooms).** Fishjam 0.29.0 publishes the camera via `useVisionCameraSource` (Nitro VisionCamera 5.2.1). Two local patches live in `patches/` and are applied by the `postinstall` patch-package step:

- `@fishjam-cloud/react-native-vision-camera-source` — front-camera 180° rotation fix.
- `@fishjam-cloud/react-native-webrtc` — native GL cowl compositor that bakes the face-tracked cowl into the published track, so guests see it too (Android only; the local preview stays the Reanimated overlay).

Heads-up: the Fishjam free tier can return **HTTP 402** (quota) — room joins fail until the quota resets or you upgrade at [fishjam.io/app](https://fishjam.io/app).

**Viro / XR (Quest).** XR uses `@reactvision/react-viro@2.57.5` with `xRMode: ["QUEST"]` plus `expo-horizon-core@57` — the panel dimensions MUST be dp strings (`1024dp`/`640dp`). ENTER XR on the lobby routes to `/xr`, where `ViroXRSceneNavigator` launches the immersive VRActivity; the app always cold-starts in 2D. The passthrough toggle flips `visible` on a skybox sphere — never unmount Viro texture nodes (SIGSEGV). Viro's GVR audio is silent on Quest, so the spatial theme plays through `react-native-audio-api` (StereoPanner).

Builds:

```bash
# Quest
npx expo prebuild --clean -p android
cd android && ./gradlew :app:assembleQuestDebug -PreactNativeArchitectures=arm64-v8a

# Phones
npx expo run:android
```

Native changes (`patches/`, config plugins) require a rebuild; JS-only changes just need Metro (port 8090).

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
