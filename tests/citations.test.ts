import { describe, expect, it } from "vitest";

import { extractCitations, splitCitations, stripCitations } from "@/lib/citations";

/**
 * O texto da resposta carrega `[[fonte:1]]` para o servidor ligar a frase ao
 * documento. Se o app mostrar isso cru, o aluno lê ruído técnico no meio da
 * explicação. Estes testes travam a separação.
 *
 * `splitCitations` é sem estado de propósito: a bolha reparseia o texto inteiro
 * a cada token que chega. É o que o teste do marcador a meio caminho cobre.
 */

describe("splitCitations", () => {
  it("separa texto e citação", () => {
    expect(splitCitations("A UAN vale 1400 kcal. [[fonte:1]]")).toEqual([
      { kind: "text", text: "A UAN vale 1400 kcal. " },
      { kind: "citation", number: 1 },
    ]);
  });

  it("aceita citações no meio da frase", () => {
    expect(splitCitations("A [[fonte:1]] e B [[fonte:2]] fim")).toEqual([
      { kind: "text", text: "A " },
      { kind: "citation", number: 1 },
      { kind: "text", text: " e B " },
      { kind: "citation", number: 2 },
      { kind: "text", text: " fim" },
    ]);
  });

  it("devolve um segmento só quando não há marcador", () => {
    expect(splitCitations("Resposta sem citação")).toEqual([
      { kind: "text", text: "Resposta sem citação" },
    ]);
  });

  it("aceita texto vazio", () => {
    expect(splitCitations("")).toEqual([{ kind: "text", text: "" }]);
  });

  it("não come texto vizinho ao marcador", () => {
    const segmentos = splitCitations("antes [[fonte:1]] depois");
    const juntado = segmentos
      .map((s) => (s.kind === "text" ? s.text : `[[fonte:${s.number}]]`))
      .join("");
    expect(juntado).toBe("antes [[fonte:1]] depois");
  });

  it("trata citation repetida como dois segmentos", () => {
    // O servidor já remove repetição, mas o app não pode supor isso: se um
    // deles passar, o selo some da tela sem o aluno perceber por quê.
    const segmentos = splitCitations("A [[fonte:1]] B [[fonte:1]]");
    expect(segmentos.filter((s) => s.kind === "citation")).toHaveLength(2);
  });

  it("lê número de dois dígitos", () => {
    expect(splitCitations("x [[fonte:12]]")).toEqual([
      { kind: "text", text: "x " },
      { kind: "citation", number: 12 },
    ]);
  });

  it("não se deixa enganar por colchete simples de inciso de lei", () => {
    // `inciso [1] do art. 5º` é redação legal e precisa aparecer inteira.
    const segmentos = splitCitations("conforme o inciso [1] da RDC 275");
    expect(segmentos).toEqual([{ kind: "text", text: "conforme o inciso [1] da RDC 275" }]);
  });

  it("mostra o marcador pela metade como texto até ele fechar", () => {
    // É o que a tela mostra enquanto a frase ainda está chegando: o pedaço
    // `[[fon` não pode virar selo, senão o selo piscaria a cada token.
    const meio = splitCitations("A UAN [[fon");
    expect(meio).toEqual([{ kind: "text", text: "A UAN [[fon" }]);

    const completo = splitCitations("A UAN [[fonte:1]] vale 1400");
    expect(completo).toEqual([
      { kind: "text", text: "A UAN " },
      { kind: "citation", number: 1 },
      { kind: "text", text: " vale 1400" },
    ]);
  });

  it("ignora marcador malformado em vez de sumir com o texto", () => {
    const texto = "antes [[fonte:x]] depois";
    const juntado = splitCitations(texto)
      .map((s) => (s.kind === "text" ? s.text : `[[fonte:${s.number}]]`))
      .join("");
    expect(juntado).toContain("antes");
    expect(juntado).toContain("depois");
  });
});

describe("extractCitations", () => {
  it("lista os números na ordem, sem repetir", () => {
    expect(extractCitations("a [[fonte:3]] b [[fonte:1]] c [[fonte:3]]")).toEqual([3, 1]);
  });

  it("devolve lista vazia quando não há citação", () => {
    expect(extractCitations("nada aqui")).toEqual([]);
  });
});

describe("stripCitations", () => {
  it("tira os marcadores para o leitor de tela", () => {
    expect(stripCitations("A [[fonte:1]] e B [[fonte:2]]")).toBe("A  e B ");
  });

  it("devolve o texto intacto quando não há marcador", () => {
    expect(stripCitations("texto puro")).toBe("texto puro");
  });
});
