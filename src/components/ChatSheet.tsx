import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFooter,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDataChannel } from '@fishjam-cloud/react-native-client';
import { useThrottledCallback } from '@tanstack/react-pacer';

import { useChatStore, type ChatMessage } from '@/stores/chatStore';

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Live-chat bottom sheet (gorhom, snap points) over the Fishjam data channel.
 * Sheet-native keyboard handling via BottomSheetTextInput + interactive
 * keyboardBehavior — the send bar tracks the keyboard without jank.
 */
export const ChatSheet = forwardRef<BottomSheetModal, { username: string }>(
  ({ username }, ref) => {
    const insets = useSafeAreaInsets();
    // Compact first snap keeps the input + send bar visible at the bottom;
    // pull up to read history.
    const snapPoints = useMemo(() => ['22%', '92%'], []);
    const { publishData, subscribeData, initializeDataChannel } = useDataChannel();

    const messages = useChatStore((s) => s.messages);
    const add = useChatStore((s) => s.add);
    const clearUnread = useChatStore((s) => s.clearUnread);

    // Uncontrolled input — draft in a ref (no component state).
    const draft = useRef('');
    const inputRef = useRef<{ clear(): void } | null>(null);

    useEffect(() => {
      try {
        initializeDataChannel();
      } catch {}
      const unsub = subscribeData((payload) => {
        try {
          const raw = payload instanceof Uint8Array ? payload : new Uint8Array(payload as ArrayBuffer);
          const parsed = JSON.parse(dec.decode(raw));
          if (parsed?.t === 'r') return; // reaction packet — handled elsewhere
          const { from, text } = parsed;
          add({ id: `${from}-${Date.now()}-${Math.random()}`, from, text, self: false, ts: Date.now() });
        } catch {}
      }, { reliable: true });
      return unsub;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const doSend = useCallback(() => {
      const text = draft.current.trim();
      if (!text) return;
      const msg: ChatMessage = { id: `me-${Date.now()}`, from: username, text, self: true, ts: Date.now() };
      add(msg);
      try {
        publishData(enc.encode(JSON.stringify({ from: username, text })), { reliable: true });
      } catch {}
      draft.current = '';
      inputRef.current?.clear();
    }, [publishData, username, add]);

    // TanStack Pacer throttle — fires immediately, swallows rapid double-sends.
    const send = useThrottledCallback(doSend, { wait: 600, leading: true, trailing: false });

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={insets.bottom}>
          <View style={styles.inputRow}>
            <BottomSheetTextInput
              ref={inputRef as never}
              style={styles.input}
              placeholder="Message the Danger Room…"
              placeholderTextColor="#5a6b8f"
              onChangeText={(t) => (draft.current = t)}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable style={styles.send} onPress={send} hitSlop={8}>
              <Text style={styles.sendText}>SEND</Text>
            </Pressable>
          </View>
        </BottomSheetFooter>
      ),
      [insets.bottom, send],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        index={0}
        onDismiss={clearUnread}
        onChange={(i) => i >= 0 && clearUnread()}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.bg}
        handleIndicatorStyle={styles.handle}
        footerComponent={renderFooter}
      >
        <View style={styles.header}>
          <Text style={styles.title}>LIVE CHAT</Text>
        </View>
        <BottomSheetFlatList
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.self ? styles.mine : styles.theirs]}>
              {!item.self ? <Text style={styles.from}>{item.from}</Text> : null}
              <Text style={styles.msg}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No transmissions yet.</Text>}
        />
      </BottomSheetModal>
    );
  },
);
ChatSheet.displayName = 'ChatSheet';

const styles = StyleSheet.create({
  bg: { backgroundColor: '#101826', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { backgroundColor: '#4a86e0', width: 44 },
  header: { paddingHorizontal: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#243456' },
  title: { color: '#eaf1ff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  list: { padding: 16, gap: 8, paddingBottom: 90 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2f6bd6' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#1c2b46' },
  from: { color: '#8fb0e6', fontSize: 11, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 },
  msg: { color: '#eef4ff', fontSize: 15, fontWeight: '500' },
  empty: { color: '#5a6b8f', textAlign: 'center', marginTop: 40, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#0c1420', borderTopWidth: 1, borderTopColor: '#243456',
  },
  input: {
    flex: 1, backgroundColor: '#16213a', borderRadius: 10, borderWidth: 1, borderColor: '#2f4368',
    paddingHorizontal: 14, paddingVertical: 10, color: '#eaf1ff', fontSize: 15,
  },
  send: {
    backgroundColor: '#eec645', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11,
    borderWidth: 1, borderColor: '#b9821a',
  },
  sendText: { color: '#16294d', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
