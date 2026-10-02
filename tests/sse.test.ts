import { describe, expect, it } from "vitest";

import { SseParser } from "@/lib/sse";

/**
 * O defeito clássico de parser de stream: a fronteira de um evento cai no meio
 * de um `onprogress`. Cada teste abaixo corta a mesma resposta em lugares
 * diferentes, porque o corte é o que faz o parser passar ou falhar.
 */
const RESPOSTA =
  'event: sources\ndata: {"sources":[{"source":"manual.pdf"}]}\n\n' +
  'event: token\ndata: {"t":"A UAN "}\n\n' +
  'event: token\ndata: {"t":"vale 1400"}\n\n' +
  'event: done\ndata: {"citations":[1]}\n\n';

function coletar(pedacos: string[]): { event: string; data: string }[] {
  const parser = new SseParser();
  const eventos = pedacos.flatMap((pedaco) => parser.push(pedaco));
  return [...eventos, ...parser.flush()];
}

describe("SseParser", () => {
  it("lê uma resposta inteira de uma vez", () => {
    const eventos = coletar([RESPOSTA]);
    expect(eventos.map((e) => e.event)).toEqual(["sources", "token", "token", "done"]);
    expect(JSON.parse(eventos[3].data)).toEqual({ citations: [1] });
  });

  it("lê com a resposta cortada byte a byte", () => {
    const eventos = coletar(RESPOSTA.split(""));
    expect(eventos.map((e) => e.event)).toEqual(["sources", "token", "token", "done"]);
    expect(JSON.parse(eventos[1].data)).toEqual({ t: "A UAN " });
  });

  it("lê com o corte no meio de cada linha", () => {
    const eventos = coletar(RESPOSTA.match(/.{1,7}/gs) ?? []);
    expect(eventos.map((e) => e.event)).toEqual(["sources", "token", "token", "done"]);
  });

  it("aceita CRLF, que é o que alguns proxies devolvem", () => {
    const comCrlf = RESPOSTA.replace(/\n/g, "\r\n");
    const eventos = coletar([comCrlf]);
    expect(eventos.map((e) => e.event)).toEqual(["sources", "token", "token", "done"]);
    expect(JSON.parse(eventos[0].data)).toEqual({ sources: [{ source: "manual.pdf" }] });
  });

  it("junta várias linhas data do mesmo evento", () => {
    const eventos = coletar(["event: done\ndata: {\"citations\":\ndata: [1]}\n\n"]);
    expect(eventos).toHaveLength(1);
    expect(JSON.parse(eventos[0].data)).toEqual({ citations: [1] });
  });

  it("descarta comentário de heartbeat", () => {
    const eventos = coletar([": ping\n\n", "event: done\ndata: {}\n\n"]);
    expect(eventos.map((e) => e.event)).toEqual(["done"]);
  });

  it("não emite evento incompleto antes do fim", () => {
    const parser = new SseParser();
    expect(parser.push("event: token\ndata: {\"t\":\"oi\"}")).toEqual([]);
    expect(parser.push("\n\n")).toHaveLength(1);
  });

  it("ignora o que não tem evento nem dado", () => {
    expect(coletar(["\n\n", "   \n\n"])).toEqual([]);
  });

  it("aceita evento sem a linha event", () => {
    const eventos = coletar(['data: {"t":"oi"}\n\n']);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].event).toBe("");
  });

  it("ignora campo desconhecido em vez de quebrar", () => {
    const eventos = coletar(["event: token\nid: 7\ndata: {\"t\":\"oi\"}\n\n"]);
    expect(JSON.parse(eventos[0].data)).toEqual({ t: "oi" });
  });

  it("recupera evento que veio sem linha em branco no fim", () => {
    const parser = new SseParser();
    expect(parser.push("event: done\ndata: {}")).toEqual([]);
    const sobra = parser.flush();
    expect(sobra).toHaveLength(1);
    expect(sobra[0].event).toBe("done");
  });

  it("não devolve nada quando não recebeu nada", () => {
    const parser = new SseParser();
    expect(parser.push("")).toEqual([]);
    expect(parser.flush()).toEqual([]);
  });

  it("preserva a ordem dos tokens", () => {
    const eventos = coletar([RESPOSTA]);
    const texto = eventos
      .filter((e) => e.event === "token")
      .map((e) => JSON.parse(e.data).t as string)
      .join("");
    expect(texto).toBe("A UAN vale 1400");
  });
});