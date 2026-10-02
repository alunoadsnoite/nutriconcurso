/**
 * Cliente HTTP da API do tutor.
 *
 * A API nunca deve devolver stack trace ou detalhe interno: os erros do
 * servidor já chegam traduzidos. Aqui o que sobra é o que o app não consegue
 * resolver sozinho — rede caída, servidor fora do ar, JSON inesperado.
 */

import type {
  ChatRequestBody,
  ChatResponseBody,
  HealthResponseBody,
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
