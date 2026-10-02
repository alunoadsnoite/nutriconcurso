/** Estado da conversa: mensagens, envio em andamento e erro corrente. */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  clearConversation,
  fetchHistory,
  normalizeSources,
  sendMessage,
  streamMessage,
} from "@/lib/api";
import { extractCitations } from "@/lib/citations";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ChatMessage, ChatRole, Source } from "@/types/api";

let counter = 0;
function nextId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}-${counter}`;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Uma resposta do servidor vira mensagem de tela.
 *
 * `citations` é lida do texto e não do campo da API: o selo desenhado no corpo
 * da mensagem precisa bater com o que está escrito nela, e o texto é a fonte da
 * verdade. O campo serve de conferência, não de direção.
 */
function fromServer(
  role: ChatRole,
  content: string,
  extras: Partial<ChatMessage> = {}
): ChatMessage {
  return {
    id: nextId(),
    role,
    text: content,
    citations: extractCitations(content),
    ...extras,
  };
}

export function useChat() {
  const apiUrl = useSettingsStore((s) => s.apiUrl);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const userId = useSettingsStore((s) => s.userId);
  const hydrated = useSettingsStore((s) => s.hydrated);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryOf, setRetryOf] = useState<ChatMessage | null>(null);

  // Evita setState depois que a tela desmontou.
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  // Guarda as fontes que chegam antes do texto, para anexar à mensagem no fim.
  const pendingSources = useRef<Source[]>([]);

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
    setSuggestions([]);
    setError(null);
    setRetryOf(null);
    setSending(false);
  }, []);

  // Restaura a conversa ao abrir o app. Espera `hydrated` porque até lá o
  // `userId` ainda é o padrão, e buscar com o id errado traria a conversa de
  // outro aluno.
  useEffect(() => {
    if (!hydrated || messages.length > 0) return;

    const controller = new AbortController();
    let cancelado = false;

    void fetchHistory(apiUrl, apiKey, userId, controller.signal).then((data) => {
      if (cancelado || !mounted.current || !data) return;
      if (data.messages.length === 0) return;

      const restauradas = data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => fromServer(m.role as ChatRole, m.content));

      setMessages(restauradas);
    });

    return () => {
      cancelado = true;
      controller.abort();
    };
    // `messages` entra só como guarda, e não como dependência: o efeito tem de
    // rodar uma vez quando o app abre. Se entrasse na lista, ele dispararia de
    // novo a cada resposta e recarregaria o histórico no meio da conversa.
  }, [hydrated, apiUrl, apiKey, userId]);

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
      // Sugestões da resposta anterior deixam de valer assim que o aluno
      // pergunta outra coisa.
      setSuggestions([]);
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;
      pendingSources.current = [];

      const assistantId = nextId();
      // A bolha do tutor entra vazia e cresce com os tokens. Sem isto a resposta
      // apareceria inteira de uma vez e o streaming não valeria nada.
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", streaming: true },
      ]);

      const setText = (texto: string) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: texto } : m)));
      };

      const finish = (finalText: string, extras: Partial<ChatMessage>) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: finalText,
                  streaming: false,
                  citations: extractCitations(finalText),
                  ...extras,
                }
              : m
          )
        );
      };

      const falha = (caught: unknown) => {
        if (!mounted.current || isAbort(caught)) return;

        const message =
          caught instanceof ApiError ? caught.message : "Algo deu errado ao enviar a mensagem.";

        setError(message);
        setRetryOf(outgoing);
        // Some a bolha vazia do tutor e marca a pergunta como não enviada.
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantId)
            .map((m) => (m.id === outgoing.id ? { ...m, failed: true } : m))
        );
      };

      try {
        // `acumulado` é a fonte da verdade do texto. Cada token reescreve a
        // bolha inteira a partir dele, porque o `setState` fecha sobre o estado
        // antigo e dois tokens no mesmo tick se perderiam.
        let acumulado = "";
        let recebeuDone = false;

        try {
          await streamMessage(
            apiUrl,
            apiKey,
            { message: trimmed, user_id: userId },
            {
              onSources: (raw) => {
                if (!mounted.current) return;
                const fontes = normalizeSources(raw);
                pendingSources.current = fontes;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, sources: fontes } : m))
                );
              },
              onToken: (piece) => {
                if (!mounted.current) return;
                acumulado += piece;
                setText(acumulado);
              },
              onSuggestions: (lista) => {
                if (mounted.current) setSuggestions(lista);
              },
              onDone: (citacoes) => {
                if (!mounted.current) return;
                recebeuDone = true;
                const fontes = pendingSources.current;
                finish(acumulado, {
                  sources: fontes,
                  grounded: fontes.length > 0,
                  citations: citacoes,
                });
              },
            },
            controller.signal
          );
        } catch (caught) {
          // Streaming novo numa API velha: 404, ou um proxy que não repassou o
          // corpo em fatias. Cai para a chamada normal em vez de falhar.
          if (!(caught instanceof ApiError) || !isFallbackWorthy(caught.status)) throw caught;

          const data = await sendMessage(
            apiUrl,
            apiKey,
            { message: trimmed, user_id: userId },
            controller.signal
          );

          if (!mounted.current) return;
          finish(data.reply, {
            sources: normalizeSources(data.sources),
            grounded: data.rag_used ?? undefined,
          });
          if (data.suggestions?.length) setSuggestions(data.suggestions);
          recebeuDone = true;
          return;
        }

        // O stream fechou sem `done`: a conexão caiu no meio da resposta. Mostra
        // o que chegou, que é melhor do que uma tela vazia, e avisa que ficou
        // incompleto.
        if (mounted.current && !recebeuDone) {
          if (acumulado.trim() === "") {
            falha(new ApiError("Resposta vazia do servidor.", null, true));
          } else {
            finish(acumulado, {
              sources: pendingSources.current,
              grounded: pendingSources.current.length > 0,
            });
          }
        }
      } catch (caught) {
        falha(caught);
      } finally {
        if (mounted.current) setSending(false);
        abortRef.current = null;
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

  return {
    messages,
    suggestions,
    sending,
    error,
    retryOf,
    send,
    retry,
    reset,
    startNewConversation,
  };
}

/**
 * O streaming deu certo mas o servidor respondeu outra coisa?
 *
 * 404 é API velha sem a rota. 405 é proxy que barrou o POST. Nenhum dos dois é
 * erro do aluno, e nos dois a chamada normal funciona — cair para ela é melhor
 * do que mostrar "erro" para quem não errou nada.
 */
function isFallbackWorthy(status: number | null): boolean {
  return status === 404 || status === 405 || status === 501;
}