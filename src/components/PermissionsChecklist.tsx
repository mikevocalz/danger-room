import React, { forwardRef, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

/**
 * Detached bottom-sheet popover (gorhom) listing the room's device permissions
 * with live grant status and a per-item Grant action. Present it with
 * `ref.current?.present()`.
 * @see https://gorhom.dev/react-native-bottom-sheet/detach-modal
 */
export const PermissionsChecklist = forwardRef<BottomSheetModal>((_props, ref) => {
  const insets = useSafeAreaInsets();
  const cam = useCameraPermission();
  const mic = useMicrophonePermission();

  const allGranted = cam.hasPermission && mic.hasPermission;

  // Keep a local handle (merged with the forwarded ref) so we can auto-dismiss.
  const localRef = useRef<BottomSheetModal>(null);
  const setRefs = (node: BottomSheetModal | null) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  // Once the last permission is granted, close the sheet.
  useEffect(() => {
    if (allGranted) localRef.current?.dismiss();
  }, [allGranted]);

  return (
    <BottomSheetModal
      ref={setRefs}
      // Detached: floats above the bottom edge with side margins.
      detached
      bottomInset={insets.bottom + 24}
      enableDynamicSizing
      style={styles.sheet}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.emblem}>
            <Text style={styles.emblemX}>X</Text>
          </View>
          <View>
            <Text style={styles.title}>DANGER ROOM ACCESS</Text>
            <Text style={styles.sub}>
              {allGranted ? 'All systems cleared for combat.' : 'Grant access to publish your seat.'}
            </Text>
          </View>
        </View>

        <PermRow
          label="Camera"
          hint="Publish your live video to the room"
          granted={cam.hasPermission}
          onGrant={cam.requestPermission}
        />
        <PermRow
          label="Microphone"
          hint="Publish your audio to the room"
          granted={mic.hasPermission}
          onGrant={mic.requestPermission}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
PermissionsChecklist.displayName = 'PermissionsChecklist';

const PermRow = ({
  label,
  hint,
  granted,
  onGrant,
}: {
  label: string;
  hint: string;
  granted: boolean;
  onGrant: () => void;
}) => (
  <View style={styles.row}>
    <View style={[styles.status, granted ? styles.statusOk : styles.statusOff]}>
      <Text style={styles.statusMark}>{granted ? '✓' : '!'}</Text>
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.rowHint}>{hint}</Text>
    </View>
    {granted ? (
      <Text style={styles.granted}>GRANTED</Text>
    ) : (
      <Pressable style={styles.grantBtn} onPress={onGrant} hitSlop={8}>
        <Text style={styles.grantLabel}>GRANT</Text>
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 20 },
  bg: { backgroundColor: '#101826', borderRadius: 20, borderWidth: 2, borderColor: '#2a3b57' },
  handle: { backgroundColor: '#4a86e0', width: 44 },
  content: { padding: 20, paddingBottom: 26, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  emblem: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#eec645',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#b9821a',
  },
  emblemX: { color: '#16294d', fontWeight: '900', fontSize: 20 },
  title: { color: '#eaf1ff', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  sub: { color: '#8fb0e6', fontSize: 12, fontWeight: '600', marginTop: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#16213a', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#243456',
  },
  status: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusOk: { backgroundColor: '#1f7a4d' },
  statusOff: { backgroundColor: '#8a5a12' },
  statusMark: { color: '#fff', fontWeight: '900', fontSize: 14 },
  rowText: { flex: 1 },
  rowLabel: { color: '#eaf1ff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  rowHint: { color: '#7d97c4', fontSize: 12, fontWeight: '500' },
  granted: { color: '#3fbf7a', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  grantBtn: {
    backgroundColor: '#eec645', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#b9821a',
  },
  grantLabel: { color: '#16294d', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
