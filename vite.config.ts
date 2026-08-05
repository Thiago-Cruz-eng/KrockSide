import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta fixa em 3000 de propósito: a política de CORS do backend libera
    // exatamente http://localhost:3000 (Program.cs, "AllowReactDevelopment"), e a
    // suíte Playwright aponta para lá. O padrão do Vite (5173) quebraria os dois.
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: false,
    // Só os testes unitários/integração de src. tests-e2e/ é do Playwright, que tem
    // runner próprio: sem este recorte o Vitest tenta coletar os .spec.ts de lá e
    // falha em test.describe().
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // cobertura entra para o diff-cover do CI ler; os outros dois são para humano.
      reporter: ['text', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mocks/**', 'src/test-utils/**'],

      /**
       * Piso, não meta.
       *
       * Os números são o que a suíte cobre hoje (74,16% linhas / 84,10% ramos / 80,24% funções),
       * arredondados para baixo. Não são um alvo a perseguir: são uma catraca que impede a
       * cobertura de CAIR. Subiu? Suba o piso junto, no mesmo PR.
       *
       * Histórico, que mostra a catraca funcionando:
       *   61,25%  ->  72,62%   testes de ChessLobby (2026-08-01)
       *   72,62%  ->  74,16%   quebra do ChessBoard em useSquareSelection / useLastMove /
       *                        useBoardOrientation / PlayerCard / GameResult (2026-08-03).
       *                        A cobertura subiu sem um único teste novo: os mesmos 72 casos
       *                        passaram a exercer unidades menores e nomeadas, em vez de um
       *                        componente de 302 linhas.
       *
       * Deliberadamente não é um número redondo tipo 80%: limiar absoluto acima do real ou
       * bloqueia todo mundo até alguém pagar a dívida de uma vez, ou é frouxo o bastante para
       * nunca disparar. Os dois destinos são inúteis.
       *
       * O gate que realmente cobra qualidade do código NOVO é o diff-cover no CI. Este aqui só
       * garante que ninguém apague testes existentes.
       */
      thresholds: {
        lines: 74,
        statements: 74,
        branches: 84,
        functions: 80,
      },
    },
  },
});
