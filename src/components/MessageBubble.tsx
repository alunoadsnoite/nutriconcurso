import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

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

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}
      accessible
      accessibilityLabel={
        isUser
          ? `Você perguntou: ${message.text}`
          : message.failed
            ? `Mensagem não enviada: ${message.text}`
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
});

export const MessageBubble = memo(MessageBubbleComponent);
