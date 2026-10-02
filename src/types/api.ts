/** Contratos espelhados da API (repositório `nutriconcurso-bot`). */

export interface ChatRequestBody {
  message: string;
  user_id?: string;
}

export interface ChatResponseBody {
  reply: string;
  has_history: boolean;
}

export interface HealthResponseBody {
  status: string;
  configured: boolean;
  model: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Mensagem que o servidor recusou ou que a API não respondeu. */
  failed?: boolean;
}
