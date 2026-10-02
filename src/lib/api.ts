/**
 * Cliente HTTP da API do tutor.
 *
 * A API nunca deve devolver stack trace ou detalhe interno: os erros do
 * servidor já chegam traduzidos. Aqui o que sobra é o que o app não consegue
 * resolver sozinho — rede caída, servidor fora do ar, JSON inesperado.
 */

import { SseParser } from "@/lib/sse";
import type {
  ChatRequestBody,
  ChatResponseBody,
  HealthResponseBody,
  HistoryResponseBody,
  Source,
  SourceItemBody,
} from "@/types/api";

export class ApiError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

/** `AbortError` do fetch é lançado quando a tela desmonta no meio da chamada. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const detail = (data as { detail?: unknown }).detail;

    if (typeof detail === "string") return detail;
    // 422 traz uma lista de erros de validação do FastAPI.
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (typeof first?.msg === "string") return first.msg;
    }
  } catch {
    // Corpo não era JSON; cai no texto genérico abaixo.
  }

  if (response.status === 401) return "Chave de API inválida. Confira em Configurações.";
  if (response.status === 429) return "Limite de requisições atingido. Aguarde um instante.";
  if (response.status === 503) {
    return "O servidor está sem configuração, ou a base vetorial está indisponível.";
  }
  if (response.status >= 500) return "O servidor falhou ao responder. Tente de novo.";

  return `Erro ${response.status} ao falar com o servidor.`;
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (apiKey) headers["X-API-Key"] = apiKey;

  let response: Response;
  try {
    response = await fetch(joinUrl(baseUrl, path), { ...init, headers, signal });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique o endereço nas Configurações.",
      null,
      true
    );
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status, response.status >= 500);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("Resposta inesperada do servidor.", response.status, true);
  }
}

export async function sendMessage(
  baseUrl: string,
  apiKey: string,
  body: ChatRequestBody,
  signal?: AbortSignal
): Promise<ChatResponseBody> {
  return request<ChatResponseBody>(
    baseUrl,
    apiKey,
    "/api/v1/chat",
    { method: "POST", body: JSON.stringify(body) },
    signal
  );
}

/**
 * Histórico guardado no servidor.
 *
 * Existe para o caso mais comum de uso do app: o aluno fecha o aplicativo no
 * metrô e abre de novo no mesmo turno. Sem isto, a conversa começa vazia de novo
 * e o modelo perde todo o contexto.
 *
 * Falha aqui não é erro de tela: uma rede instável não pode impedir o aluno de
 * perguntar. Quem chama decide o que fazer com o `null`.
 */
export async function fetchHistory(
  baseUrl: string,
  apiKey: string,
  userId: string,
  signal?: AbortSignal
): Promise<HistoryResponseBody | null> {
  try {
    const data = await request<HistoryResponseBody>(
      baseUrl,
      apiKey,
      `/api/v1/chat?user_id=${encodeURIComponent(userId)}`,
      { method: "GET" },
      signal
    );

    return {
      messages: Array.isArray(data?.messages)
        ? data.messages.filter(
            (m): m is HistoryResponseBody["messages"][number] =>
              typeof m?.role === "string" && typeof m?.content === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
}

export interface StreamCallbacks {
  /** Documentos consultados. Chega antes de qualquer letra da resposta. */
  onSources?: (sources: SourceItemBody[]) => void;
  onToken?: (text: string) => void;
  onSuggestions?: (suggestions: string[]) => void;
  onDone?: (citations: number[]) => void;
}

/**
 * Envia a pergunta e recebe a resposta em fatias.
 *
 * Por que `XMLHttpRequest` e não `fetch`: o `fetch` do React Native não expõe o
 * corpo da resposta como stream legível, então a resposta inteira só chegaria
 * no fim — e streaming seria apenas `fetch` com outro nome. O XHR entrega
 * `responseText` creciente a cada `onprogress`, que é o que permite mostrar a
 * frase aparecendo enquanto o modelo ainda escreve.
 *
 * Se o stream não funcionar, o app continua funcionando: quem chama deve cair
 * para `sendMessage`. Por isso os erros de transporte aqui viram `ApiError` com
 * `retryable`, e não uma exceção solta.
 */
export async function streamMessage(
  baseUrl: string,
  apiKey: string,
  body: ChatRequestBody,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = joinUrl(baseUrl, "/api/v1/chat/stream");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = new SseParser();
    let lido = 0;
    let falhou = false;

    const abortar = () => xhr.abort();
    signal?.addEventListener("abort", abortar);

    const limpar = () => signal?.removeEventListener("abort", abortar);

    const concluir = () => {
      limpar();
      resolve();
    };

    const falhar = (erro: ApiError) => {
      if (falhou) return;
      falhou = true;
      limpar();
      reject(erro);
    };

    const tratar = (eventos: { event: string; data: string }[]) => {
      for (const { event, data } of eventos) {
        // Evento sem nome e sem dado é heartbeat; descartado pelo próprio parser.
        let corpo: unknown;
        try {
          corpo = JSON.parse(data);
        } catch {
          continue;
        }

        switch (event) {
          case "sources":
            callbacks.onSources?.(normalizarSourcesBrutos(corpo));
            break;
          case "token": {
            const texto = (corpo as { t?: unknown }).t;
            if (typeof texto === "string" && texto !== "") callbacks.onToken?.(texto);
            break;
          }
          case "suggestions":
            callbacks.onSuggestions?.(normalizarSugestoes(corpo));
            break;
          case "done":
            callbacks.onDone?.(normalizarCitacoes(corpo));
            break;
          case "error": {
            const detalhe = (corpo as { detail?: unknown }).detail;
            falhar(new ApiError(
              typeof detalhe === "string" && detalhe
                ? detalhe
                : "Falha durante a geração da resposta.",
              null,
              true
            ));
            return;
          }
          default:
            // Evento de versão futura da API: ignorar é a resposta correta.
            break;
        }
      }
    };

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (apiKey) xhr.setRequestHeader("X-API-Key", apiKey);

    xhr.onprogress = () => {
      if (!xhr.responseText) return;
      // `responseText` é sempre o acumulado; o parser só pode ver o que é novo,
      // senão o mesmo evento sairia várias vezes.
      const novo = xhr.responseText.slice(lido);
      lido = xhr.responseText.length;
      if (novo) tratar(parser.push(novo));
    };

    xhr.onload = () => {
      if (xhr.status >= 400) {
        falhar(new ApiError(erroDeStatus(xhr.status), xhr.status, xhr.status >= 500));
        return;
      }
      tratar(parser.flush());
      concluir();
    };

    xhr.onerror = () => {
      falhar(
        new ApiError(
          "Não foi possível conectar ao servidor. Verifique o endereço nas Configurações.",
          null,
          true
        )
      );
    };

    xhr.ontimeout = () => falhar(new ApiError("O servidor demorou demais para responder.", null, true));

    // O `onabort` não vira erro: cancelar é ação do usuário, não falha.
    xhr.onabort = () => concluir();

    xhr.send(JSON.stringify(body));
  });
}

function erroDeStatus(status: number): string {
  if (status === 401) return "Chave de API inválida. Confira em Configurações.";
  if (status === 429) return "Limite de requisições atingido. Aguarde um instante.";
  if (status === 503) {
    return "O servidor está sem configuração, ou a base vetorial está indisponível.";
  }
  if (status >= 500) return "O servidor falhou ao responder. Tente de novo.";
  return `Erro ${status} ao falar com o servidor.`;
}

function normalizarCitacoes(corpo: unknown): number[] {
  const lista = (corpo as { citations?: unknown })?.citations;
  if (!Array.isArray(lista)) return [];

  return lista.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

function normalizarSugestoes(corpo: unknown): string[] {
  const lista = (corpo as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(lista)) return [];

  const perguntas = lista
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  return [...new Set(perguntas)];
}

function normalizarSourcesBrutos(corpo: unknown): SourceItemBody[] {
  const lista = (corpo as { sources?: unknown })?.sources;
  if (!Array.isArray(lista)) return [];

  return lista.filter((item): item is SourceItemBody => typeof item === "object" && item !== null);
}

/**
 * Converte `page` para número, aceitando o que a API e o banco podem mandar.
 * `metadata.page` vira `jsonb`: se quem inseriu gravou `"4"` em vez de `4`, o
 * valor chega como texto e a interface precisa lidar com os dois.
 */
function toPageNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function normalizeSource(raw: SourceItemBody): Source {
  const label =
    typeof raw.source === "string" && raw.source.trim() !== ""
      ? raw.source
      : typeof raw.title === "string" && raw.title.trim() !== ""
        ? raw.title
        : "Documento oficial";

  return { source: label, page: toPageNumber(raw.page) };
}

export function normalizeSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is SourceItemBody => typeof item === "object" && item !== null)
    .map(normalizeSource);
}

export async function clearConversation(
  baseUrl: string,
  apiKey: string,
  userId: string
): Promise<void> {
  const query = `?user_id=${encodeURIComponent(userId)}`;
  await request<{ cleared: boolean }>(
    baseUrl,
    apiKey,
    `/api/v1/chat${query}`,
    { method: "DELETE" }
  );
}

export async function checkHealth(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<HealthResponseBody> {
  return request<HealthResponseBody>(baseUrl, apiKey, "/health", { method: "GET" }, signal);
}
