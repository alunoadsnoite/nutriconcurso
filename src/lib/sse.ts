/**
 * Leitor de Server-Sent Events, sem dependência de navegador.
 *
 * Existe como módulo isolado por dois motivos:
 *
 * 1. O React Native não dá para ler o corpo da resposta em fatias pelo `fetch`.
 *    O `fetch` do RN é sobre XHR e não expõe `response.body` como
 *    `ReadableStream`. A saída é ler `xhr.responseText` a cada `onprogress` e
 *    entregar aqui só o pedaço novo. Isso é um autômato de estados com regra de
 *    quebra de linha, e testar autômato por rede é teste lento e instável;
 *    testar direto é instantâneo.
 *
 * 2. A fronteira de um evento é a linha em branco. Metade de um evento pode
 *    chegar num `onprogress` e a outra no seguinte, então sobra sempre precisa
 *    ficar guardada para o próximo pedaço.
 *
 * A especificação permite `\n\n` e `\r\n\r\n` como separadores, e os proxies
 * não sempre usam o mesmo. Ambos são aceitos.
 */

export interface SseEvent {
  /** Nome do evento. Vazio quando a linha `event:` não veio. */
  event: string;
  /** Linhas `data:` concatenadas com `\n`. */
  data: string;
}

/** Remove o `\r` que sobra quando o proxy usa CRLF. */
function normalizar(texto: string): string {
  return texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export class SseParser {
  private buffer = "";

  /** Recebe um pedaço e devolve os eventos que ficaram completos. */
  push(pedaco: string): SseEvent[] {
    if (!pedaco) return [];

    this.buffer += normalizar(pedaco);

    const eventos: SseEvent[] = [];
    let separador = this.encontrarSeparador();

    while (separador >= 0) {
      const bruto = this.buffer.slice(0, separador);
      // `normalizar` já trocou CRLF por LF, então o separador tem 2 bytes.
      this.buffer = this.buffer.slice(separador + 2);
      const evento = lerEvento(bruto);
      if (evento) eventos.push(evento);
      separador = this.encontrarSeparador();
    }

    return eventos;
  }

  /** Descarrega o que sobrou. Só use quando o servidor fechou a conexão. */
  flush(): SseEvent[] {
    const bruto = this.buffer;
    this.buffer = "";
    const evento = lerEvento(bruto);
    return evento ? [evento] : [];
  }

  private encontrarSeparador(): number {
    return this.buffer.indexOf("\n\n");
  }
}

function lerEvento(bruto: string): SseEvent | null {
  let evento = "";
  const dados: string[] = [];

  for (const linha of bruto.split("\n")) {
    // Linha vazia é o que fecha o evento; comentário é heartbeat.
    if (linha === "" || linha.startsWith(":")) continue;

    const doisPontos = linha.indexOf(":");
    const campo = doisPontos < 0 ? linha : linha.slice(0, doisPontos);
    // A especificação manda pular UM espaço depois do `:`.
    let valor = doisPontos < 0 ? "" : linha.slice(doisPontos + 1);
    if (valor.startsWith(" ")) valor = valor.slice(1);

    if (campo === "event") evento = valor;
    else if (campo === "data") dados.push(valor);
  }

  if (evento === "" && dados.length === 0) return null;
  return { event: evento, data: dados.join("\n") };
}