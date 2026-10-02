/**
 * Separa o texto da resposta dos marcadores de citação.
 *
 * O tutor responde com `[[fonte:1]]` no meio da frase, e o servidor só aceita
 * marcador que aponte para um bloco que veio na busca. Se o app mostra isso
 * literalmente, o aluno lê `... vale 1400 kcal [[fonte:1]].` — ruído técnico no
 * meio da explicação, e o pior: ele não sabe o que fazer com aquilo.
 *
 * Aqui o marcador vira segmento próprio, para a interface desenhar o número como
 * um selo. Texto sem marcador nenhum é o caso comum e volta inteiro, em um
 * segmento só.
 *
 * O servidor já validou os números, mas o app não pode confiar nisso: se a
 * API for atualizada e o texto mudar de formato, o ideal é o texto com as
 * aspas sumirem, e não um selo com número que não corresponde a fonte nenhuma.
 */

import type { TextSegment } from "@/types/api";

/** Mesmo formato do servidor: número entre colchetes duplos. */
const MARCADOR = /\[\[fonte:(\d{1,4})\]\]/gi;

export function splitCitations(text: string): TextSegment[] {
  if (!text || !text.includes("[[")) {
    return [{ kind: "text", text }];
  }

  const segmentos: TextSegment[] = [];
  let cursor = 0;

  MARCADOR.lastIndex = 0;
  let achado = MARCADOR.exec(text);

  while (achado !== null) {
    if (achado.index > cursor) {
      segmentos.push({ kind: "text", text: text.slice(cursor, achado.index) });
    }

    segmentos.push({ kind: "citation", number: Number.parseInt(achado[1], 10) });

    cursor = achado.index + achado[0].length;
    achado = MARCADOR.exec(text);
  }

  if (cursor < text.length) {
    segmentos.push({ kind: "text", text: text.slice(cursor) });
  }

  return segmentos;
}

/** Os números citados, na ordem em que aparecem. */
export function extractCitations(text: string): number[] {
  const numeros: number[] = [];

  for (const segmento of splitCitations(text)) {
    if (segmento.kind === "citation" && !numeros.includes(segmento.number)) {
      numeros.push(segmento.number);
    }
  }

  return numeros;
}

/** Texto sem nenhum marcador. Usado no resumo de acessibilidade. */
export function stripCitations(text: string): string {
  return splitCitations(text)
    .filter((segmento): segmento is { kind: "text"; text: string } => segmento.kind === "text")
    .map((segmento) => segmento.text)
    .join("");
}