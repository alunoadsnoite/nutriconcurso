import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { checkHealth } from "@/lib/api";
import { useSettingsStore } from "@/stores/settingsStore";

type Status = "idle" | "checking" | "ok" | "error";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const apiUrl = useSettingsStore((s) => s.apiUrl);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const userId = useSettingsStore((s) => s.userId);
  const setApiUrl = useSettingsStore((s) => s.setApiUrl);
  const setApiKey = useSettingsStore((s) => s.setApiKey);

  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [draftKey, setDraftKey] = useState(apiKey);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const testConnection = useCallback(async () => {
    setStatus("checking");
    setMessage(null);

    const trimmedUrl = draftUrl.trim();
    if (!trimmedUrl) {
      setStatus("error");
      setMessage("Informe o endereço do servidor.");
      return;
    }

    try {
      const health = await checkHealth(trimmedUrl, draftKey.trim());
      setStatus("ok");

      // Uma linha por condição, para o usuário saber exatamente o que falta.
      const linhas: string[] = [];
      linhas.push(
        health.configured
          ? `Servidor ok — modelo ${health.model}.`
          : "Servidor ok, mas sem OPENAI_API_KEY: as perguntas vão falhar."
      );
      if (health.rag_configured) {
        linhas.push(
          `Base oficial ativa${health.embedding_model ? ` (${health.embedding_model})` : ""}: as respostas vêm com fonte citada.`
        );
      } else {
        linhas.push(
          "Sem base vetorial: as respostas vêm do modelo, sem documento de apoio. Ver README da API."
        );
      }
      setMessage(linhas.join("\n"));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao contatar o servidor.");
    }
  }, [draftKey, draftUrl]);

  function save() {
    setApiUrl(draftUrl);
    setApiKey(draftKey);
    setStatus("idle");
    setMessage(null);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.label, { color: colors.text }]}>Endereço da API</Text>
      <TextInput
        value={draftUrl}
        onChangeText={setDraftUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="http://10.0.2.2:8000"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        accessibilityLabel="Endereço da API"
        accessibilityHint="No emulador use 10.0.2.2. Em aparelho físico use o IP da rede local"
      />
      <Text style={[styles.help, { color: colors.textSecondary }]}>
        No emulador Android, `10.0.2.2` aponta para o computador. Em aparelho físico, use o IP da
        rede local (ex: `http://192.168.0.10:8000`) e deixe o servidor escutando em `0.0.0.0`.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>Chave de API (opcional)</Text>
      <TextInput
        value={draftKey}
        onChangeText={setDraftKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder="Deixe vazio se o servidor não exigir"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        accessibilityLabel="Chave de API"
        accessibilityHint="Envie como X-API-Key. Necessária apenas se o servidor exigir"
      />
      <Text style={[styles.help, { color: colors.textSecondary }]}>
        A chave fica guardada no aparelho. Ela viaja dentro do APK, então não é segredo: use
        apenas com servidor de teste.
      </Text>

      <Pressable
        onPress={testConnection}
        disabled={status === "checking"}
        accessibilityRole="button"
        accessibilityLabel="Testar conexão"
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: colors.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {status === "checking" ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Testar conexão</Text>
        )}
      </Pressable>

      <Pressable
        onPress={save}
        accessibilityRole="button"
        accessibilityLabel="Salvar configurações"
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Salvar</Text>
      </Pressable>

      {message && (
        <View
          style={[
            styles.statusBox,
            {
              backgroundColor: status === "ok" ? colors.surfaceAlt : colors.errorSurface,
              borderColor: status === "ok" ? colors.border : colors.error,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text
            style={[
              styles.statusText,
              { color: status === "ok" ? colors.text : colors.error },
            ]}
          >
            {message}
          </Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Identidade da conversa</Text>
      <Text
        style={[styles.mono, { backgroundColor: colors.surfaceAlt, color: colors.textSecondary }]}
        selectable
      >
        {userId}
      </Text>
      <Text style={[styles.help, { color: colors.textSecondary }]}>
        O servidor guarda o histórico por usuário. Apagar os dados do app gera um id novo e a
        conversa recomeça sem histórico.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  help: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 48,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: "600" },
  primaryButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
  statusBox: { borderRadius: 12, borderWidth: 1, marginTop: 16, padding: 12 },
  statusText: { fontSize: 14, lineHeight: 20 },
  mono: { borderRadius: 8, fontSize: 13, padding: 12 },
});
