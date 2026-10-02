/** Estado da conversa: mensagens, envio em andamento e erro corrente. */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, clearConversation, sendMessage } from "@/lib/api";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChatMessage } from "@/types/api";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}-${counter}`;
}

export function useChat() {
  const apiUrl = useSettingsStore((s) => s.apiUrl);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const userId = useSettingsStore((s) => s.userId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryOf, setRetryOf] = useState<ChatMessage | null>(null);

  // Evita setState depois que a tela desmontou.
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setRetryOf(null);
    setSending(false);
  }, []);

  const startNewConversation = useCallback(async () => {
    reset();
    // Falha ao limpar o servidor não impede o usuário de começar outra
    // conversa: o histórico antigo só será reenviado se ele usar o mesmo
    // userId, e a tela já está limpa.
    try {
      await clearConversation(apiUrl, apiKey, userId);
    } catch {
      // Silencioso de propósito: a limpeza é cortesia, não pré-requisito.
    }
  }, [apiUrl, apiKey, userId, reset]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const outgoing: ChatMessage = { id: nextId(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, outgoing]);
      setError(null);
      setRetryOf(null);
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await sendMessage(
          apiUrl,
          apiKey,
          { message: trimmed, user_id: userId },
          controller.signal
        );

        if (!mounted.current) return;
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: data.reply }]);
      } catch (caught) {
        if (!mounted.current) return;
        if (caught instanceof Error && caught.name === "AbortError") return;

        const message =
          caught instanceof ApiError
            ? caught.message
            : "Algo deu errado ao enviar a mensagem.";

        setError(message);
        setRetryOf(outgoing);

        // A mensagem que não deu certo fica marcada na bolha para o usuário
        // ver o que precisa reenviar, em vez de sumir sozinha.
        setMessages((prev) =>
          prev.map((m) => (m.id === outgoing.id ? { ...m, failed: true } : m))
        );
      } finally {
        if (mounted.current) setSending(false);
      }
    },
    [apiUrl, apiKey, userId, sending]
  );

  const retry = useCallback(async () => {
    if (!retryOf) return;
    const text = retryOf.text;
    setMessages((prev) => prev.filter((m) => m.id !== retryOf.id));
    setRetryOf(null);
    await send(text);
  }, [retryOf, send]);

  return { messages, sending, error, retryOf, send, retry, reset, startNewConversation };
}
