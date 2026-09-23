import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content-Security-Policy do build de produção.
 *
 * Só no `vite build`: o dev server precisa de `<script>` inline (preamble do plugin React para o
 * Fast Refresh) e de `ws:` para o HMR, e os dois violariam esta política. Em produção o Vite emite
 * só `<script type="module" src>` e `<link rel="stylesheet">` externos, então `'self'` basta.
 *
 * O que a meta tag NÃO consegue fazer, e precisa vir como header HTTP do host que serve o build:
 * `frame-ancestors` (a meta tag ignora esta diretiva por especificação), `report-uri`, e todos os
 * outros headers de endurecimento — HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
 * `Referrer-Policy`, `Permissions-Policy`. A lista completa, com exemplo para nginx e para Azure
 * Static Web Apps, está em `docs/seguranca.md`.
 *
 * `connect-src 'self' https: wss:` é deliberadamente amplo porque a URL da API vem de
 * `VITE_API_BASE_URL` em tempo de build e varia por ambiente. Ao publicar, troque por
 * `connect-src 'self' https://api.seu-dominio wss://api.seu-dominio` (checklist em
 * `docs/seguranca.md`). `img-src data:` cobre ícone inline; as peças vêm de `/public`, logo `'self'`.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'krockside:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: PRODUCTION_CSP },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: {
    // Porta fixa em 3000 de propósito: a política de CORS do backend libera
    // exatamente http://localhost:3000 (Program.cs, "AllowReactDevelopment"), e a
    // suíte Playwright aponta para lá. O padrão do Vite (5173) quebraria os dois.
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    // `hidden`: os .map são gerados (para subir num serviço de erro, ou para depurar localmente)
    // mas o bundle NÃO aponta para eles com `//# sourceMappingURL`. Com `true`, qualquer visitante
    // abria o DevTools e lia o código-fonte original, com comentários e nomes. Ninguém deve subir
    // os .map junto com o build para o host público — ver `docs/seguranca.md`.
    sourcemap: 'hidden',
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
    // 15s em vez dos 5s padrão. Não é indulgência com teste lento: os testes de fluxo digitam
    // com `userEvent.type` (caractere a caractere) e o primeiro request que o MSW intercepta
    // num arquivo paga o aquecimento do interceptor. Em máquina ocupada, com 12 arquivos em
    // paralelo, isso passava de 5s e reprovava teste que passa em 1s isolado — vermelho falso,
    // que ensina a ignorar o vermelho verdadeiro.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      // cobertura entra para o diff-cover do CI ler; os outros dois são para humano.
      reporter: ['text', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mocks/**', 'src/test-utils/**'],

      /**
       * Piso, não meta.
       *
       * Os números são o que a suíte cobre hoje, arredondados para baixo. Não são um alvo a
       * perseguir: são uma catraca que impede a cobertura de CAIR. Subiu? Suba o piso junto, no
       * mesmo PR.
       *
       * Histórico, que mostra a catraca funcionando:
       *   61,25%  ->  72,62%   testes de ChessLobby (2026-08-01)
       *   72,62%  ->  74,16%   quebra do ChessBoard em useSquareSelection / useLastMove /
       *                        useBoardOrientation / PlayerCard / GameResult (2026-08-03).
       *                        A cobertura subiu sem um único teste novo: os mesmos 72 casos
       *                        passaram a exercer unidades menores e nomeadas, em vez de um
       *                        componente de 302 linhas.
       *   74,16%  ->  85,35%   hardening de segurança (2026-09-23): interceptor de refresh,
       *                        RequireAuth, useChessLobby (antes 5% coberto), logout e
       *                        validações de entrada ganharam testes próprios — 72 -> 127 casos.
       *                        Medido: 85,35% linhas / 85,0x% ramos / 88,88% funções. Ramos fica
       *                        em 84, e não 85: o valor oscilou entre 85,07 e 85,04 em runs
       *                        consecutivos sem mudança de código (o v8 conta ramo dependente
       *                        de timing), e catraca a 0,04 do medido reprova por ruído.
       *
       * Deliberadamente não é um número redondo tipo 80%: limiar absoluto acima do real ou
       * bloqueia todo mundo até alguém pagar a dívida de uma vez, ou é frouxo o bastante para
       * nunca disparar. Os dois destinos são inúteis.
       *
       * O gate que realmente cobra qualidade do código NOVO é o diff-cover no CI. Este aqui só
       * garante que ninguém apague testes existentes.
       */
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 84,
        functions: 88,
      },
    },
  },
});
