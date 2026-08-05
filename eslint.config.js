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
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test-utils/**', 'src/mocks/**', 'tests-e2e/**'],
    rules: {
      // Stubs de teste precisam de `any` e de asserções pontuais para montar
      // DataTransfer, respostas parciais e afins.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
