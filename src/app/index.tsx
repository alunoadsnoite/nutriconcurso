import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { useChat } from "@/hooks/useChat";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChatMessage } from "@/types/api";

export default function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { messages, sending, error, retryOf, send, retry, startNewConversation } = useChat();
  const hydrated = useSettingsStore((s) => s.hydrated);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  if (!hydrated) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={startNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Nova conversa"
          accessibilityHint="Limpa as mensagens desta conversa"
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.headerButtonText, { color: colors.accent }]}>Nova conversa</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Abrir configurações"
          accessibilityHint="Ajuste o endereço do servidor e a chave de API"
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.headerButtonText, { color: colors.accent }]}>Configurações</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Tutor de Nutrição</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Pergunte sobre PNAE, PNAN, SUS, RDC 216/2004, UAN, Fator de Correção, Nutrição
              Clínica, Materno-Infantil, Esportiva e Saúde Coletiva — ou peça questões de FGV,
              Vunesp, Cebraspe, IBFC e FCC.
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              As respostas citam a legislação quando aplicável, mas são material de estudo:
              confira sempre a fonte oficial.
            </Text>
          </View>
        }
      />

      {error && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.errorSurface, borderColor: colors.error },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          {retryOf && (
            <Pressable
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Tentar enviar de novo"
            >
              <Text style={[styles.retryText, { color: colors.error }]}>Tentar de novo</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <ChatInput onSend={send} sending={sending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", flex: 1, justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerButtonText: { fontSize: 15, fontWeight: "600" },
  listContent: { flexGrow: 1, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { flex: 1, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  emptyBody: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  emptyHint: { fontSize: 13, lineHeight: 19 },
  errorBox: { borderRadius: 12, borderWidth: 1, margin: 12, padding: 12 },
  errorText: { fontSize: 14, lineHeight: 20 },
  retryText: { fontSize: 14, fontWeight: "700", marginTop: 8, minHeight: 44 },
});
