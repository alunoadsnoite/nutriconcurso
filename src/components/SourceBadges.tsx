import React, { memo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { Source } from "@/types/api";

interface Props {
  sources: Source[];
}

function labelOf(source: Source): string {
  return source.page === null ? source.source : `${source.source} · p. ${source.page}`;
}

/**
 * Badges de fonte sob a resposta do tutor.
 *
 * Um badge por documento+página, tocável. O objetivo é o estudante conseguir
 * chegar no PDF oficial sem sair do app — por isso o toque mostra o documento e
 * a página, e não só o nome.
 */
function SourceBadgesComponent({ sources }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState<Source | null>(null);

  if (sources.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.heading, { color: colors.textSecondary }]}>
        {sources.length === 1 ? "Fonte consultada" : `${sources.length} fontes consultadas`}
      </Text>

      <View style={styles.badges}>
        {sources.map((source) => {
          const key = `${source.source}::${source.page ?? "s/n"}`;
          return (
            <Pressable
              key={key}
              onPress={() => setOpen(source)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir detalhe da fonte ${labelOf(source)}`}
              accessibilityHint="Mostra o documento e a página citados"
              style={({ pressed }) => [
                styles.badge,
                { backgroundColor: colors.accent },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.accentText }]} numberOfLines={1}>
                {labelOf(source)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={open !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(null)}
          accessibilityRole="button"
          accessibilityLabel="Fechar detalhe da fonte"
        >
          {/* Impede que o toque no cartão feche o modal. */}
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <Text style={[styles.sheetTitle, { color: colors.text }]}>Fonte oficial</Text>

            <ScrollView style={styles.sheetBody}>
              <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Documento</Text>
              <Text style={[styles.sheetValue, { color: colors.text }]}>
                {open?.source ?? ""}
              </Text>

              <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Página</Text>
              <Text style={[styles.sheetValue, { color: colors.text }]}>
                {open?.page === null || open === null ? "Não informada" : String(open.page)}
              </Text>

              <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  Trecho recuperado por similaridade em uma base vetorial de legislação
                  (ANVISA, PNAE, PNAN e tabelas oficiais). Confira o documento original antes
                  de usar a resposta em prova.
                </Text>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setOpen(null)}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: colors.accent },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={[styles.closeText, { color: colors.accentText }]}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  heading: {
    fontSize: 12,
    fontWeight: "600",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  badge: {
    maxWidth: "100%",
    minHeight: 28,
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetBody: {
    gap: spacing.xs,
  },
  sheetLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: spacing.sm,
  },
  sheetValue: {
    fontSize: 16,
  },
  notice: {
    marginTop: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
  },
  close: {
    marginTop: spacing.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  closeText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export const SourceBadges = memo(SourceBadgesComponent);