/** Contratos espelhados da API (repositório `nutriconcurso-bot`). */

export interface ChatRequestBody {
  message: string;
  user_id?: string;
}

/**
 * Documento consultado pelo RAG. `page` chega como número quando o ingestion a
 * guardou assim, mas pode vir como texto se outro inseridor gravou a chave
 * como string — daí a normalização em `normalizeSource`.
 */
export interface SourceItemBody {
  source?: unknown;
  title?: unknown;
  page?: unknown;
}

export interface ChatResponseBody {
  reply: string;
  has_history: boolean;
  /** Vazio quando o RAG está desligado ou nada passou do limiar. */
  sources?: SourceItemBody[];
  /** A resposta saiu de documento oficial, ou do modelo sem contexto? */
  rag_used?: boolean;
}

export interface HealthResponseBody {
  status: string;
  configured: boolean;
  model: string;
  rag_configured?: boolean;
  embedding_model?: string | null;
}

export type ChatRole = "user" | "assistant";

/** Fonte normalizada, pronta para a interface. */
export interface Source {
  source: string;
  page: number | null;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Mensagem que o servidor recusou ou que a API não respondeu. */
  failed?: boolean;
  /** Documentos que fundamentaram a resposta. Só em mensagens do tutor. */
  sources?: Source[];
  /** `false` quando a resposta saiu do modelo sem documento de apoio. */
  grounded?: boolean;
}