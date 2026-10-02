import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";

interface Props {
  suggestions: string[];
  onPick: (question: string) => void;
}

/**
 * Perguntas de continuação.
 *
 * Vem da ideia da landing page: em vez de a tela terminar com o campo de
 * digitação vazio, ela oferece por onde seguir. Para quem estuda para prova, a
 * pergunta seguinte quase nunca é "o que eu pergunto agora", e é aí que o aluno
 * trava.
 *
 * Some assim que o aluno pergunta alguma coisa: sugestão que não corresponde à
 * conversa vira ruído.
 */
export function SuggestionChips({ suggestions, onPick }: Props) {
  const { colors } = useTheme();

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Você pode perguntar</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // Sem isto o ScrollView horizontal dentro de uma coluna rouba o gesto
        // vertical da lista de mensagens.
        style={styles.scroll}
      >
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onPick(suggestion)}
            accessibilityRole="button"
            accessibilityLabel={`Sugerir pergunta: ${suggestion}`}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: colors.accent, backgroundColor: colors.surface },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.accent }]} numberOfLines={2}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#88888833",
    paddingTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  track: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 260,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});