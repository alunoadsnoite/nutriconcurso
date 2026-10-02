import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SourceBadges } from "@/components/SourceBadges";
import { useTheme } from "@/hooks/useTheme";
import type { ChatMessage } from "@/types/api";

interface Props {
  message: ChatMessage;
}

/**
 * Bolha de mensagem. As do usuário ficam à direita e as do tutor à esquerda,
 * para que a origem da resposta fique óbvia sem precisar ler o texto.
 */
function MessageBubbleComponent({ message }: Props) {
  const { colors } = useTheme();
  const isUser = message.role === "user";
  const sources = isUser ? [] : (message.sources ?? []);

  // `grounded === false` é a API dizendo que respondeu sem documento nenhum.
  // O aviso importa: sem ele o estudante lê memória do modelo como se fosse
  // norma, que é o erro que o RAG existe para reduzir.
  const ungrounded = !isUser && message.grounded === false && sources.length === 0;

  return (
    <View
      style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}
      accessible
      accessibilityLabel={
        isUser
          ? `Você perguntou: ${message.text}`
          : message.failed
            ? `Mensagem não enviada: ${message.text}`
            : sources.length > 0
              ? `Resposta do tutor: ${message.text}. ${sources.length} fonte(s) citada(s).`
              : `Resposta do tutor: ${message.text}`
      }
    >
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.accent }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: isUser ? colors.accentText : colors.text },
            message.failed && { textDecorationLine: "line-through" },
          ]}
        >
          {message.text}
        </Text>

        {ungrounded ? (
          <View style={[styles.warn, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.warnText, { color: colors.textSecondary }]}>
              Resposta sem documento oficial de apoio. Confirme na legislação.
            </Text>
          </View>
        ) : null}

        <SourceBadges sources={sources} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 12,
  },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  warn: {
    marginTop: 10,
    borderRadius: 10,
    padding: 8,
  },
  warnText: {
    fontSize: 12,
    lineHeight: 17,
  },
});

export const MessageBubble = memo(MessageBubbleComponent);