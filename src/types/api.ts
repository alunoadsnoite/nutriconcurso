/** Contratos espelhados da API (repositório `nutriconcurso-bot`). */

export interface ChatRequestBody {
  message: string;
  user_id?: string;
  /**
   * Pede as perguntas sugeridas. Só desliga se o app souber o que fazer sem
   * elas; ligada por padrão, porque o servidor trata a falha como não fatal.
   */
  include_suggestions?: boolean;
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
  /**
   * Números dos blocos citados, na ordem. Vem junto porque o texto traz
   * `[[fonte:N]]` que o app desenha, e a lista fecha o par fonte ↔ documento.
   */
  citations?: number[];
  /** Perguntas de continuação. Vazio quando desligado ou quando falhou. */
  suggestions?: string[];
}

export interface HealthResponseBody {
  status: string;
  configured: boolean;
  model: string;
  rag_configured?: boolean;
  embedding_model?: string | null;
  /** O servidor aceita `/api/v1/chat/stream`. */
  streaming?: boolean;
}

/** Uma mensagem guardada no servidor, para restaurar a tela. */
export interface HistoryMessageBody {
  role: string;
  content: string;
}

export interface HistoryResponseBody {
  messages: HistoryMessageBody[];
}

export type ChatRole = "user" | "assistant";

/** Fonte normalizada, pronta para a interface. */
export interface Source {
  source: string;
  page: number | null;
}

/**
 * Trecho de texto entre dois marcadores de citação.
 *
 * `text` e `citation` não se misturam porque o app precisa desenhar o número
 * como um selo clicável no meio da frase, e não como texto solto. Se o modelo
 * emite a resposta sem marcador nenhum, vem um único segmento de texto.
 */
export type TextSegment =
  | { kind: "text"; text: string }
  | { kind: "citation"; number: number };

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
  /** Blocos citados, como a API informou. */
  citations?: number[];
  /** A resposta ainda está chegando. */
  streaming?: boolean;
}