import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SourceBadges } from "@/components/SourceBadges";
import { useTheme } from "@/hooks/useTheme";
import { splitCitations, stripCitations } from "@/lib/citations";
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

  // Só faz sentido separar marcador em mensagem do tutor: o modelo só cita
  // quando tem documento de apoio.
  const segmentos = useMemo(
    () => (isUser ? [{ kind: "text" as const, text: message.text }] : splitCitations(message.text)),
    [isUser, message.text]
  );

  // `grounded === false` é a API dizendo que respondeu sem documento nenhum.
  // O aviso importa: sem ele o estudante lê memória do modelo como se fosse
  // norma, que é o erro que o RAG existe para reduzir.
  const ungrounded = !isUser && message.grounded === false && sources.length === 0;

  // O leitor de tela não deve ler `[[fonte:1]]` nem o texto ainda a meio
  // caminho. Fala o conteúdo sem os marcadores, e cita a fonte em separado.
  const falado = stripCitations(message.text);

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
              ? `Resposta do tutor: ${falado}. ${sources.length} fonte(s) citada(s).`
              : `Resposta do tutor: ${falado}`
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
        {isUser ? (
          <Text
            style={[styles.text, { color: colors.accentText }, message.failed && styles.failed]}
          >
            {message.text}
          </Text>
        ) : (
          <Text
            style={[styles.text, { color: colors.text }]}
            // `selectable` para o aluno poder copiar trecho da resposta, que é
            // como ele monta o resumo de estudo.
            selectable
          >
            {segmentos.map((segmento, indice) =>
              segmento.kind === "citation" ? (
                <Text
                  // A lista de segmentos nunca é reordenada, então o índice é
                  // chave estável aqui.
                  key={`citacao-${indice}`}
                  style={[
                    styles.citation,
                    { color: colors.accent, backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  {` ${segmento.number} `}
                </Text>
              ) : (
                <Text key={`texto-${indice}`}>{segmento.text}</Text>
              )
            )}
            {message.streaming ? <Text style={styles.caret}>▍</Text> : null}
          </Text>
        )}

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
  failed: { textDecorationLine: "line-through" },
  citation: {
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  caret: {
    color: "#888888",
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