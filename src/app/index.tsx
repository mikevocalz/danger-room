import React, { useEffect, useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  Shadow,
  SweepGradient,
  Text as SkText,
  useFont,
  vec,
} from '@shopify/react-native-skia';

import { isHorizonDevice } from '@/horizon';
import { makeCircledX } from '@/roster/glyphs';
import { useJoinDangerRoom, type Role } from '@/fishjam/room';
import { PermissionsChecklist } from '@/components/PermissionsChecklist';
import { useSplashStore } from '@/stores/splashStore';

const MEGALOPOLIS = require('../../assets/fonts/MegalopolisX.ttf');

// X-Men emblem for the lobby crest.
const mark = makeCircledX({
  ringRadius: 42,
  ringWidth: 7,
  ringGap: 0,
  armSpan: 34,
  armWidthCenter: 6,
  armWidthOuter: 12,
});

const CREST = 132;

/**
 * Danger Room lobby: the entry screen. The host STARTS the room; guests joining
 * the same room name are added after. Both routes lead to /room once connected.
 */
export default function Lobby() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const titleFont = useFont(MEGALOPOLIS, 30);
  const { join } = useJoinDangerRoom();
  const permRef = useRef<BottomSheetModal>(null);

  // Surface the permissions checklist on the JOIN screen — only once the Cerebro
  // splash has cleared, never underneath it.
  const splashDone = useSplashStore((s) => s.done);
  useEffect(() => {
    if (splashDone) permRef.current?.present();
  }, [splashDone]);

  const [room, setRoom] = useState('danger-room');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (role: Role) => {
    if (busy) return;
    const username = name.trim() || (role === 'host' ? 'PROFESSOR X' : 'GUEST');
    setError(null);
    setBusy(role);
    try {
      await join(room, username, role);
      router.push({ pathname: '/room', params: { role, username } });
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not reach the Danger Room.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Brushed-metal circled-X crest */}
      <Canvas style={styles.crest}>
        <Group transform={[{ translateX: CREST / 2 - (CREST * 0.42) }, { translateY: CREST / 2 - (CREST * 0.42) }, { scale: (CREST * 0.42) / 50 }]}>
          <Path path={mark.path} color="#20242a" transform={[{ translateX: 1.4 }, { translateY: 1.6 }]} />
          <Path path={mark.path}>
            <SweepGradient c={vec(50, 50)} colors={['#cfd4da', '#ffffff', '#aeb4bc', '#ffffff', '#cfd4da']} />
            <Shadow dx={0} dy={2} blur={6} color="#00000088" />
          </Path>
        </Group>
      </Canvas>

      {/* Liquid-gold DANGER ROOM wordmark */}
      <Canvas style={styles.titleCanvas}>
        {titleFont ? <Title font={titleFont} /> : null}
      </Canvas>

      <Text style={styles.tagline}>LIVE COMBAT SIMULATION</Text>

      <View style={styles.form}>
        <Field label="ROOM" value={room} onChangeText={setRoom} placeholder="danger-room" autoCapitalize="none" />
        <Field label="CALLSIGN" value={name} onChangeText={setName} placeholder="your name" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.host, busy === 'guest' && styles.dim]}
          onPress={() => enter('host')}
          disabled={!!busy}
        >
          {busy === 'host' ? <ActivityIndicator color="#16294d" /> : <Text style={styles.hostLabel}>START ROOM</Text>}
          <Text style={styles.hostSub}>Host the simulation</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.guest, busy === 'host' && styles.dim]}
          onPress={() => enter('guest')}
          disabled={!!busy}
        >
          {busy === 'guest' ? <ActivityIndicator color="#e6eaf0" /> : <Text style={styles.guestLabel}>JOIN ROOM</Text>}
          <Text style={styles.guestSub}>Enter as a mutant</Text>
        </Pressable>

        {isHorizonDevice && (
          <Pressable
            style={[styles.btn, styles.xr, !!busy && styles.dim]}
            onPress={() => router.push({ pathname: '/xr', params: { room, username: name.trim() || 'QUEST' } })}
            disabled={!!busy}
          >
            <Text style={styles.xrLabel}>◉ ENTER XR</Text>
            <Text style={styles.xrSub}>Immersive conference</Text>
          </Pressable>
        )}

        <Pressable style={styles.permLink} onPress={() => permRef.current?.present()} hitSlop={8}>
          <Text style={styles.permLinkText}>◇ PERMISSIONS CHECKLIST</Text>
        </Pressable>
      </View>

      <PermissionsChecklist ref={permRef} />
    </View>
  );
}

// Liquid-metal gold wordmark, centred in the 320-wide canvas.
const Title = ({ font }: { font: import('@shopify/react-native-skia').SkFont }) => {
  const title = 'DANGER ROOM';
  const w = font.measureText(title).width;
  const x = (320 - w) / 2;
  const y = 34;
  return (
    <Group>
      <SkText x={x + 1.5} y={y + 1.5} text={title} font={font} color="#3a2708" />
      <SkText x={x} y={y} text={title} font={font}>
        <LinearGradient
          start={vec(x, y - 26)}
          end={vec(x + w, y)}
          colors={['#8a5c0c', '#ffe680', '#9a6a10']}
        />
        <Shadow dx={0} dy={2} blur={5} color="#00000099" />
      </SkText>
    </Group>
  );
};

const Field = ({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor="#5a6b8f"
      autoCorrect={false}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b3fae', alignItems: 'center', paddingHorizontal: 28 },
  crest: { width: CREST, height: CREST },
  titleCanvas: { width: 320, height: 46, marginTop: 4 },
  tagline: { color: '#9fc0ff', letterSpacing: 3, fontSize: 11, fontWeight: '700', marginTop: 2 },
  form: { width: '100%', maxWidth: 420, marginTop: 16, gap: 10 },
  field: { gap: 6 },
  fieldLabel: { color: '#cfe0ff', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  input: {
    backgroundColor: '#0a2f82',
    borderColor: '#3a6bd6',
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#eaf1ff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: { color: '#ffb4a8', marginTop: 14, textAlign: 'center', fontWeight: '600' },
  actions: { width: '100%', maxWidth: 420, marginTop: 12, gap: 8 },
  btn: { borderRadius: 12, paddingVertical: 9, alignItems: 'center', borderWidth: 2 },
  dim: { opacity: 0.5 },
  host: { backgroundColor: '#eec645', borderColor: '#b9821a' },
  hostLabel: { color: '#16294d', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  hostSub: { color: '#5b4a1a', fontSize: 12, fontWeight: '700', marginTop: 2 },
  guest: { backgroundColor: '#123a94', borderColor: '#4a86e0' },
  guestLabel: { color: '#eaf1ff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  guestSub: { color: '#9fc0ff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  xr: { backgroundColor: '#3b1f7a', borderColor: '#7c4dff' },
  xrLabel: { color: '#e9ddff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  xrSub: { color: '#b79dff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  permLink: { alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  permLinkText: { color: '#9fc0ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
});
