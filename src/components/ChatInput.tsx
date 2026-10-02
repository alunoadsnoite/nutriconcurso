import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

const MAX_LENGTH = 4000;

interface Props {
  onSend: (text: string) => void;
  sending: boolean;
}

export function ChatInput({ onSend, sending }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState("");

  const canSend = text.trim().length > 0 && !sending;
  const remaining = MAX_LENGTH - text.length;

  function handleSend() {
    if (!canSend) return;
    onSend(text);
    setText("");
  }

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Pergunte sobre PNAE, UAN, RDC 216..."
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        multiline
        maxLength={MAX_LENGTH}
        editable={!sending}
        accessibilityLabel="Mensagem para o tutor"
        accessibilityHint="Descreva sua dúvida sobre concursos de Nutrição"
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={handleSend}
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Enviar pergunta"
        accessibilityHint={sending ? "Aguarde a resposta" : "Envia sua pergunta ao tutor"}
        accessibilityState={{ disabled: !canSend, busy: sending }}
        style={({ pressed }) => [
          styles.sendButton,
          {
            backgroundColor: canSend ? colors.accent : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.sendLabel, { color: canSend ? colors.accentText : colors.textSecondary }]}>
          {sending ? "…" : "Enviar"}
        </Text>
      </Pressable>

      {remaining < 400 && (
        <Text style={[styles.counter, { color: colors.textSecondary }]}>
          {remaining} caracteres restantes
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
  },
  sendLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  counter: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
});
