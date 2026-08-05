---
name: padroes-react-typescript
description: >
  Convenções de React e TypeScript do KrockSide: fluxo de camadas components-hooks-service-types,
  componente React.FC com props em interface exportada, hook use{Nome} retornando objeto com API
  nomeada e useCallback, tipagem estrita sem any com cast só na borda, CSS puro por componente,
  variáveis REACT_APP_ do Create React App, e o que não adotar. Use ao criar componente, hook ou
  serviço, refatorar estado, tipar payload, adicionar estilo, ou revisar organização de arquivo.
metadata:
  type: technical-skill
---

# Padrões React + TypeScript

> **Mantendo esta skill**
>
> Atualize quando um padrão de camada ou de tipagem mudar. Adicionar mais um componente que siga o
> padrão não exige mudança aqui.

## Fluxo de camadas

`components → hooks → service → types`, sem atalho e sem referência ascendente.

| Camada | Pasta | Pode importar | **Não** pode |
|---|---|---|---|
| Apresentação | `src/components/` | hooks, types, styles | `axios`, `@microsoft/signalr`, `localStorage` |
| Estado/efeito | `src/hooks/` | service, types | JSX de tela (só provider), `react-router` para navegar |
| Transporte | `src/service/` | types | nada de React |
| Contrato | `src/types/` | — | nada do projeto |

Duas fronteiras que valem a pena decorar:

- **Componente não fala com transporte.** Precisa de dado do servidor? via `userApi` (REST) ou
  `useHubConnection`/`useChessGame` (hub). Ver `axios` importado em `src/components/` é violação.
- **`src/service/Api.ts` é o único dono do storage de token.** Nenhum outro arquivo lê ou escreve
  `localStorage`/`sessionStorage` de credencial.

## Componente

```tsx
import React from 'react';
import '../styles/ChessSquare.css';
import { PieceDto, SquareDto } from '../types/chess';

export interface ChessSquareProps {
  square: SquareDto;
  highlighted: boolean;
  disabled: boolean;
  onSelect: (algebraic: string, piece: PieceDto | null) => void;
  onDropPiece: (from: string, to: string) => void;
}

const ChessSquare: React.FC<ChessSquareProps> = ({ square, highlighted, disabled, ... }) => {
  ...
};

export default ChessSquare;
```

Convenções:

- `React.FC<Props>` com `interface {Nome}Props` **exportada** (o teste importa).
- **Um componente por arquivo**, `export default` no fim. Sem barrel (`index.ts`) — importe pelo
  caminho.
- Nome do arquivo = nome do componente, PascalCase (`ChessBoard.tsx`).
- Teste ao lado: `ChessBoard.test.tsx`.
- CSS em `src/styles/{Nome}.css`, importado no topo do componente. Componente pode importar mais de
  um CSS (`ChessSquare` importa `ChessSquare.css` e `ChessPiece.css`).
- Handler local: `handle{Evento}` (`handleSelect`, `handleDrop`); prop de callback: `on{Evento}`
  (`onSelect`, `onDropPiece`).
- Derivação caruda em `useMemo` (`squareIndex`, `playerColor`); callback passado para filho em
  `useCallback` — o grid renderiza 64 filhos, referência nova a cada render custa.
- **Seletor estável obrigatório** em elemento novo: `data-testid`, `role` ou `label`/`alt`. Ver
  Princípio VII e a skill `estrategia-de-testes-frontend`.
- Early return para estado de carga e erro:

  ```tsx
  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">Erro: {error}</div>;
  ```

## Hook

```ts
export interface ChessGameApi {
  snapshot: BoardSnapshot | null;
  makeMove: (from: string, to: string) => Promise<MakeMoveResponse>;
  ...
}

export function useChessGame(roomName: string | undefined): ChessGameApi { ... }
```

Convenções:

- `use{Nome}` em `src/hooks/`, arquivo `.ts` — ou `.tsx` **só** quando o hook acompanha um provider
  com JSX (`useHubConnection.tsx`).
- **Retorna objeto, nunca tupla.** A API é nomeada e a `interface` é exportada
  (`ChessGameApi`, `HubConnectionApi`, `AuthState & AuthActions`).
- Toda função devolvida é `useCallback` com dependências corretas — o consumidor coloca em array de
  dependência de `useEffect`.
- Argumento opcional aceita `undefined` explicitamente (`roomName: string | undefined`), porque vem
  de `useParams`. Trate a ausência devolvendo estado neutro, não lançando.
- Hook não navega e não renderiza tela. Quem navega é o componente.
- Provider fica no mesmo arquivo do hook que o consome (`HubContext` + `HubProvider` +
  `useHubConnection`), e o hook lança mensagem clara quando usado fora dele.

## Serviço

```ts
export const userApi = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('login', data);
    return res.data;
  },
};
export default userApi;
```

- Objeto literal com métodos `async`, um por endpoint, tipos de `src/types/`. Sem classe.
- Devolve `res.data`, não a resposta do axios — o chamador não conhece axios.
- Erro **propaga** por padrão. Trate só o que tem semântica (ex.: `getValidation` converte 404 em
  `null`) e comente por quê.
- `src/service/Api.ts` concentra: `API_BASE_URL`, `HUB_URL`, as funções de storage, `createApi()` e
  a instância `api`. `createApi(baseURL)` recebe base para o teste poder criar instância isolada.

## Tipagem

- `strict: true` é permanente. `any` (implícito ou explícito), `as any`, `@ts-ignore` e
  `@ts-expect-error` são proibidos — exceto com comentário de uma linha explicando por que não há
  alternativa.
- **Cast de payload de hub só na borda**, uma vez, dentro do handler:

  ```ts
  const off = on('BoardChanged', (...args) => {
    const payload = args[0] as BoardChangedEvent;   // único cast
    setSnapshot(payload.snapshot);
  });
  ```

- `invoke<T>` e `api.post<T>` **sempre** com `T` explícito de `src/types/`.
- Union de string literal para domínio fechado (`Color`, `PieceType`) — não `enum`, não `string`.
- `interface` para forma de objeto; `type` para union e alias.
- Erro em `catch` é `unknown`: estreite antes de usar
  (`err instanceof Error ? err.message : 'fallback'`), como `useChessGame` faz. Para ler status de
  erro do axios, o padrão do repositório é o cast pontual comentado que existe em
  `userApi.getValidation`.
- Campo que o backend pode não mandar é opcional (`message?`) ou nullable (`piece: PieceDto | null`)
  — espelhando o contrato, não a conveniência.

## Estilo (CSS)

- CSS puro, um arquivo por componente em `src/styles/`, importado no topo. Sem Tailwind, sem
  CSS-in-JS, sem Sass, sem CSS Modules.
- Classe em kebab-case (`chess-square`, `board-status`, `join-button`).
- Classe de estado é aplicada por template string:
  `` className={`chess-square ${colorClass} ${highlighted ? 'highlighted' : ''}`} ``.
- **Classe CSS não é seletor de teste.** Estilo muda por motivo estético; teste que depende dele
  quebra sem bug.
- Imagem estática vai em `public/` e é referenciada por `process.env.PUBLIC_URL` — não `import`.

## Ambiente (Create React App)

- Variável de ambiente **precisa** do prefixo `REACT_APP_` e é lida em **build time**: mudar `.env`
  exige reiniciar o dev server. Ler `process.env.QUALQUER_COISA` sem o prefixo devolve `undefined`
  em produção.
- Sempre com fallback: `process.env.REACT_APP_API_BASE_URL ?? 'https://localhost:5001/'`.
- `REACT_APP_E2E=true` é injetada pelo `webServer` do Playwright — use para desligar comportamento
  que atrapalha E2E, nunca para mudar regra.
- `npm run build` falha em erro de TypeScript: é o gate de tipo de fato do projeto, junto com
  `npx tsc --noEmit`.

## Não adotar sem decisão explícita

Redux, Zustand, Jotai · React Query, SWR · Tailwind, styled-components, Emotion, Sass ·
Vite, Next.js · MSW v2 · ESLint/Prettier próprios · biblioteca de componentes (MUI, Chakra) ·
**qualquer biblioteca de regra de xadrez** (`chess.js`, `react-chessboard`) — esta última viola o
Princípio I, porque a regra é do servidor.

O projeto é deliberadamente enxuto: `useState` + `useContext` bastam para o tamanho atual.
Dependência nova exige registro em `.agents/context/discovery-answers.md` e, se muda arquitetura,
emenda à constituição.

## Armadilhas conhecidas

- **`useEffect` do `HubProvider` depende de `[url, factory]`** — `factory` inline recria a conexão
  em loop. Sempre memoize. Ver skill `conexao-signalr`.
- **`decoded` do `useAuth` é recalculado a cada render** e não tem referência estável: use
  `decoded?.sub` em array de dependência, não `decoded`.
- **`React.StrictMode` roda efeito duas vezes em dev.** Se a desinscrição de evento estiver
  correta, é inofensivo; se não, o sintoma aparece só em desenvolvimento.
- **`process.env.PUBLIC_URL` é string vazia em dev** — concatenação com `/` no início continua
  funcionando; não "conserte" removendo a barra.
- **Sem lint próprio**: nada avisa sobre dependência faltando em `useEffect` além do plugin embutido
  do CRA em tempo de build. Confira manualmente.
