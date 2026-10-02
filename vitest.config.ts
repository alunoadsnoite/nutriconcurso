import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Runner de teste só para a lógica pura de TypeScript.
 *
 * Não entra `react-native` nem componente nenhum: testar bolster de interface
 * exigiria ambiente de render, e o custo de manter isso não paga a 영상 de
 * bugs. O que fica testado é onde o defeito mora de verdade — o parser de SSE e
 * o de citações, que são código de máquina de estados e quebram em silêncio
 * quando um pedaço chega na fronteira errada.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});