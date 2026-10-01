import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { FishjamProvider } from '@fishjam-cloud/react-native-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { DangerRoomSplash } from '@/components/DangerRoomSplash';
import { startTheme } from '@/components/splashAudio';
import { useSplashStore } from '@/stores/splashStore';
import { FISHJAM_ID } from '@/fishjam/room';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const splashDone = useSplashStore((s) => s.done);
  const markSplashDone = useSplashStore((s) => s.markDone);

  // Theme audio lives at the root — starts under the splash and keeps playing
  // into the room (independent of the splash lifecycle).
  useEffect(() => {
    startTheme();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <FishjamProvider fishjamId={FISHJAM_ID}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <BottomSheetModalProvider>
            {/* index = lobby (host starts / guests join) → room. */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="room" options={{ animation: 'fade' }} />
            </Stack>
            {/* Cerebro splash + theme, above everything until it clears. */}
            {!splashDone ? <DangerRoomSplash onDone={markSplashDone} /> : null}
          </BottomSheetModalProvider>
        </ThemeProvider>
      </FishjamProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
