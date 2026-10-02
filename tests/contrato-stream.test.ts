import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractCitations, splitCitations } from "@/lib/citations";
import { SseParser } from "@/lib/sse";

/**
 * Teste de contrato com a API real.
 *
 * A resposta gravada em `fixtures/stream-exemplo.txt` saiu da rota
 * `/api/v1/chat/stream` do repositório `nutriconcurso-bot`, com o dublê de
 * OpenAI devolvendo a resposta pedaço por pedaço. Não é um exemplo inventado: é a saída
 * que o app vai encontrar em produção.
 *
 * Existe porque os dois lados são repositórios separados e ninguém valida o
 * formato junto. Um campo renomeado, um evento a mais, uma vírgula a menos no
 * JSON — e o app passa a ignorar a resposta em silêncio, que é a pior falha
 * possível: tela em branco sem erro nenhum.
 *
 * Para regerar o arquivo depois de mexer no formato do servidor:
 *   cd ../nutriconcurso-bot
 *   python -m scripts.gerar_fixture_stream
 */

const STREAM = readFileSync(
  fileURLToPath(new URL("./fixtures/stream-exemplo.txt", import.meta.url)),
  "utf8"
);

function coletar(pedacos: string[]): { event: string; data: unknown }[] {
  const parser = new SseParser();
  const eventos = pedacos.flatMap((pedaco) => parser.push(pedaco));
  return [...eventos, ...parser.flush()].map((e) => ({
    event: e.event,
    data: JSON.parse(e.data) as unknown,
  }));
}

describe("stream real da API", () => {
  const eventos = coletar([STREAM]);

  it("traz os eventos na ordem esperada", () => {
    expect(eventos.map((e) => e.event)).toEqual([
      "sources",
      "token",
      "token",
      "token",
      "token",
      "suggestions",
      "done",
    ]);
  });

  it("anuncia as fontes antes do texto", () => {
    // O app mostra os documentos consultados enquanto a frase ainda chega. Se
    // essa ordem inverter, o efeito de mostrar o que foi consultado se perde.
    expect(eventos[0].event).toBe("sources");
    const fontes = eventos[0].data as { sources: { source: string; page: number }[] };
    expect(fontes.sources).toHaveLength(3);
    expect(fontes.sources[0]).toEqual({ source: "manual-1.pdf", page: 1 });
  });

  it("monta o texto certinho, com o marcador partido entre dois tokens", () => {
    const texto = eventos
      .filter((e) => e.event === "token")
      .map((e) => (e.data as { t: string }).t)
      .join("");

    // `[[fon` + `te:1]]` chegou em dois eventos e virou um marcador só.
    expect(texto).toContain("[[fonte:1]]");
    // A citação para o bloco 9 não existia no contexto; o servidor já removeu.
    expect(texto).not.toContain("fonte:9");
    // `[1]` de inciso de lei não é marcador e tem de sobreviver.
    expect(texto).toContain("[1] do inciso continua.");
  });

  it("entrega sugestões prontas para virar chip", () => {
    const evento = eventos.find((e) => e.event === "suggestions");
    const lista = (evento?.data as { suggestions: string[] }).suggestions;
    expect(lista).toHaveLength(3);
    expect(lista.every((s) => s.trim() !== "")).toBe(true);
  });

  it("fecha com as citações que a resposta realmente usou", () => {
    const ultimo = eventos.at(-1);
    expect(ultimo?.event).toBe("done");
    expect((ultimo?.data as { citations: number[] }).citations).toEqual([1]);
  });

  it("aguenta o mesmo stream cortado de qualquer jeito", () => {
    // O corte é o que decide se o parser funciona; testar só com a resposta
    // inteira não prova nada sobre streaming.
    for (const tamanho of [1, 3, 7, 17, 64, 200]) {
      const pedacos = STREAM.match(new RegExp(`.{1,${tamanho}}`, "gs")) ?? [];
      const coletados = coletar(pedacos);

      expect(coletados.map((e) => e.event)).toEqual(eventos.map((e) => e.event));
      expect(coletados.at(-1)?.data).toEqual({ citations: [1] });
    }
  });
});

describe("resposta real renderizada", () => {
  const texto = coletar([STREAM])
    .filter((e) => e.event === "token")
    .map((e) => (e.data as { t: string }).t)
    .join("");

  it("desenha um selo só, que é o que existe no documento", () => {
    const segmentos = splitCitations(texto);
    expect(segmentos.filter((s) => s.kind === "citation")).toEqual([
      { kind: "citation", number: 1 },
    ]);
  });

  it("bate com o citations do done", () => {
    const ultimo = coletar([STREAM]).at(-1);
    const doServidor = (ultimo?.data as { citations: number[] }).citations;
    expect(extractCitations(texto)).toEqual(doServidor);
  });

  it("não deixa resíduo de marcador na tela", () => {
    expect(texto).not.toMatch(/\[\[fonte:(\d+)\]\]?\s*\[\[fonte/);
    expect(texto.replace(/\[\[fonte:\d+\]\]/g, "").replace(/\[\[fonte[^\]]*$/, "")).not.toMatch(
      /\[\[fonte/
    );
  });
});