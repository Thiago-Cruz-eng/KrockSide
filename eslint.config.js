import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// O lint vinha embutido no react-scripts ("extends": ["react-app"]). Ao sair o CRA,
// a configuração passa a ser explícita aqui — flat config do ESLint 9.
export default tseslint.config(
  { ignores: ['build/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // DESLIGADA DE PROPÓSITO, com dívida registrada.
      //
      // Regra nova do eslint-plugin-react-hooks 7, voltada ao React Compiler. Ela
      // acusa três sítios nossos que são o padrão "carregar/sincronizar na montagem":
      //   useChessGame  — `void start()` no efeito que abre a partida
      //   ChessLobby    — `void loadRooms()` / `void loadPlayersInRoom()`
      //   useAuth       — ressincroniza token quando o `userId` da rota muda
      // Nos três o setState acontece depois de um await, não durante o efeito; o
      // linter acusa o sítio da chamada. Reescrever com useSyncExternalStore é
      // refactor da camada de estado do front, não modernização de dependência, e
      // mexeria em comportamento recém-estabilizado. Fica para quando essa camada for
      // reorganizada. Os erros de `react-hooks/refs`, que eram bugs de verdade, foram
      // corrigidos em useHubConnection.
      'react-hooks/set-state-in-effect': 'off',
      // O padrão da regra reclamaria de todo `catch (err)` não usado; o prefixo _
      // continua sendo a forma de marcar intencionalmente não usado.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // ------------------------------------------------------------------------------------
      // LIMITES DE COMPLEXIDADE
      //
      // Acrescentados em 2026-08-03, ao preparar o repositório para manutenção por equipe
      // júnior. O objetivo não é reescrever o que existe — é impedir que volte a crescer.
      //
      // Todos os números foram escolhidos MEDINDO a base e ficando um pouco acima do pior
      // caso legítimo, não por gosto. Um limite abaixo do real bloqueia todo mundo até
      // alguém pagar a dívida de uma vez; um limite muito acima nunca dispara. Os dois são
      // inúteis, e é o mesmo critério dos pisos de cobertura no vite.config.ts.
      //
      // Bateu num limite? A saída é extrair uma função nomeada — foi o que `ChessBoard`
      // recebeu, quebrado em useSquareSelection / useLastMove / useBoardOrientation /
      // PlayerCard / GameResult. Subir o número é a última alternativa, e pede comentário
      // dizendo por quê.
      // ------------------------------------------------------------------------------------

      // Caminhos independentes por função. 12 é folgado para componente com vários estados
      // de render e aperta em lógica de decisão de verdade.
      complexity: ['error', 12],

      // Aninhamento de bloco. Acima de 4 a leitura passa a exigir contar indentação, e
      // costuma indicar que o miolo do laço quer ser uma função.
      'max-depth': ['error', 4],

      // Callbacks dentro de callbacks. O render do tabuleiro é `cols.map(col => rows.map(...))`,
      // dois níveis; 4 dá margem sem liberar pirâmide.
      'max-nested-callbacks': ['error', 4],

      // Parâmetros posicionais. Acima disso ninguém lembra a ordem, e a saída é um objeto de
      // opções nomeadas — como `joinButtonLabel` e `useSquareSelection` já fazem.
      'max-params': ['error', 5],

      // Tamanho de função. O limite é generoso de propósito: um componente React é uma função
      // e o JSX conta como corpo, então 200 é o que acomoda a maior tela sem incentivar
      // fatiar componente só para agradar o linter.
      //
      // skipComments é essencial neste repositório — os comentários são longos por decisão, e
      // sem isso documentar melhor faria o lint falhar.
      'max-lines-per-function': [
        'error',
        { max: 200, skipComments: true, skipBlankLines: true },
      ],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test-utils/**', 'src/mocks/**', 'tests-e2e/**'],
    rules: {
      // Stubs de teste precisam de `any` e de asserções pontuais para montar
      // DataTransfer, respostas parciais e afins.
      '@typescript-eslint/no-explicit-any': 'off',

      // Os limites de complexidade não se aplicam a teste, e não por indulgência: um
      // `describe` É uma função que contém todos os `it` do arquivo, então
      // max-lines-per-function e max-nested-callbacks medem "quantos casos este arquivo
      // cobre" em vez de complexidade. Aplicá-los aqui empurraria na direção errada —
      // menos casos de teste para agradar o linter.
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
    },
  },
);
