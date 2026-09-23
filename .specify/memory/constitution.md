<!-- SYNC IMPACT REPORT
Version change: 1.0.0 → 1.0.1 (PATCH, 2026-09-23): Princípio VI passa a declarar o storage de
  token em sessionStorage (por aba) em vez de localStorage, logout total e a checagem do :id da
  rota contra o claim sub. Clarificação do mesmo princípio (credencial fora de URL, storage por
  usuário), não redefinição — o meio de armazenamento é detalhe de implementação, mas a divergência
  entre constituição e código era exatamente o que o repositório acabou de pagar para consertar.
  Templates: sem impacto (o Constitution Check do plan-template cita o princípio, não o meio).
Version change (anterior): none → 1.0.0 (ratificação inicial)
Origem: harness portado de verum-sales-global-backend em 2026-08-01, com princípios escritos
  para o domínio real deste repositório (front-end React de xadrez multiplayer consumindo o
  backend Hibrygame por REST + SignalR).
Added sections: Princípios I–VII, Padrões de stack, Fluxo de desenvolvimento, Governança
Removed sections: n/a
Templates updated:
  ✅ .specify/memory/constitution.md — este arquivo
  ✅ .specify/templates/plan-template.md — Constitution Check reescrito para os princípios I–VII
  ✅ .specify/templates/spec-template.md — sem mudança estrutural necessária
  ✅ .specify/templates/tasks-template.md — sem mudança estrutural necessária
Follow-up TODOs:
  - O Princípio II tem violações herdadas já registradas em docs/debito-tecnico.md
    (DT-01 a DT-05). São débito conhecido, não licença para novas divergências.
-->

# Constituição do KrockSide

Front-end React + TypeScript do xadrez multiplayer. Consome o backend **Hibrygame Orchestrator**
por REST (`axios`) e SignalR (`@microsoft/signalr`, hub `/chesshub`).

## Princípios fundamentais

### I. O servidor é a autoridade (NON-NEGOTIABLE)

O front-end é uma **superfície de apresentação e intenção**. Ele NUNCA decide:

- se uma jogada é legal;
- de quem é o turno;
- qual a cor do jogador;
- o que o usuário pode acessar.

Consequências obrigatórias:

1. **Nenhuma atualização otimista de estado de jogo.** O tabuleiro só muda quando chega
   `snapshot` na resposta de `MakeMove`/`StartGame` ou no evento `BoardChanged`/`GameStarted`.
   É proibido mover a peça na tela antes da confirmação do servidor.
2. **`GetPossibleMoves` é dica visual, não autorização.** Serve para destacar casas. Enviar
   `MakeMove` para uma casa não destacada é permitido — o servidor recusa se for ilegal.
3. **Nenhuma regra de xadrez no cliente.** Trazer engine de xadrez (`chess.js` e similares), ou
   reimplementar cálculo de movimento, xeque ou fim de partida, é violação direta deste princípio.
4. **A cor do jogador vem do servidor** — da resposta de `JoinRoom` ou do evento `PlayerJoined`,
   nunca de claim de JWT, de escolha local ou de `localStorage`.
5. **Recusa do servidor é exibida como veio.** `success: false` + `message` → mostre a `message`.
   Não invente texto próprio para caso que o servidor já explica.

**Racional**: o servidor é o único que enxerga o tabuleiro real e as duas conexões. Toda regra que
existir só no cliente é uma regra que não existe — e qualquer divergência entre otimismo local e
verdade remota aparece como peça que "volta sozinha".

### II. Contrato do backend é explícito, tipado e verificado (NON-NEGOTIABLE)

Todo DTO de REST e de hub é declarado em `src/types/` (`auth.ts`, `chess.ts`), em camelCase — é
como o backend serializa, tanto no MVC quanto no protocolo JSON do SignalR.

Regras:

1. **Nenhuma chamada ao backend sem tipo declarado.** `invoke<T>` e `api.post<T>` sempre com `T`
   explícito de `src/types/`.
2. **Antes de implementar contra um endpoint, confirme que ele existe** — a fonte de verdade é
   `docs/FRONTEND_CHANGES.md` **do repositório do backend**, não a memória nem o código atual
   deste repositório (que tem rotas divergentes catalogadas em `docs/debito-tecnico.md`).
3. **Cliente contra endpoint inexistente** só é aceitável se estiver registrado em
   `BACKEND_CHANGES.md` como pedido pendente ao backend, e marcado no código.
4. **Mudança de contrato é registrada em `BACKEND_CHANGES.md` no mesmo PR**, com o formato
   antigo, o novo e o motivo.
5. **`ReferenceHandler.Preserve`**: as respostas REST do backend podem vir com `$id`, `$ref` e
   listas em `$values`. Payload de SignalR **não** tem isso. Código que desserializa REST precisa
   tolerar os dois formatos ou o campo pertinente precisa ser tratado explicitamente.

**Racional**: os dois repositórios evoluem separados. O contrato é a única coisa que os mantém
juntos, e um contrato que só existe na cabeça de quem escreveu volta como bug de runtime — não de
compilação.

### III. Fluxo de camadas

`components → hooks → service → types`, sem atalho e sem referência ascendente.

- **`components/`** — apresentação e interação. NÃO importa `axios` nem `@microsoft/signalr`
  direto; consome `userApi` e `useHubConnection`/`useChessGame`.
- **`hooks/`** — estado e efeito. Encapsula transporte, expõe API nomeada e tipada. Não renderiza.
- **`service/`** — transporte. `Api.ts` concentra instância axios, interceptor e storage de token;
  `userApi.ts` concentra as chamadas REST. Não conhece React.
- **`types/`** — contrato e helpers puros. Não importa nada do projeto.

`src/service/Api.ts` é o **único** lugar autorizado a ler ou escrever token em `localStorage`/
`sessionStorage`.

**Racional**: componente que fala com transporte não é testável sem rede, e hook que renderiza não
é reutilizável.

### IV. Tipagem estrita, sem escape

`strict: true` no `tsconfig` é permanente. `any` implícito ou explícito é proibido; `as any`,
`@ts-ignore` e `@ts-expect-error` também — exceto com comentário de uma linha explicando por que
não há alternativa.

Payload de evento de hub chega como `unknown[]`. Faça o cast **na borda**, uma vez, no handler:

```ts
const off = on('BoardChanged', (...args) => {
  const payload = args[0] as BoardChangedEvent;   // único cast
  setSnapshot(payload.snapshot);
});
```

E trafegue tipado dali para frente. Cast espalhado pelo componente é violação.

**Racional**: o compilador é o único teste que roda em 100% do código. `any` desliga exatamente na
fronteira onde o erro mora — o contrato com o servidor.

### V. Três níveis de teste, TDD para regra nova

| Nível | Onde | Ferramenta | Cobre |
|---|---|---|---|
| Unitário | ao lado do arquivo (`{Nome}.test.tsx`) | Jest + RTL, `createFakeHub`, `axios-mock-adapter` | componente, hook, serviço isolados |
| Integração | `src/integration/` | Jest + RTL + **MSW v1** (`src/mocks/handlers.ts`) | fluxo atravessando componentes e REST real-ish |
| E2E | `tests-e2e/` | Playwright + `page.route` | jornada no browser, com backend mockado |

TDD obrigatório para comportamento novo de hook, serviço e regra de exibição: escreva o teste que
falha primeiro. Exceção apenas para CSS e ajuste de texto.

Teste **nunca** depende de classe CSS ou de texto solto de parágrafo: use `data-testid`,
`getByRole`, `getByLabelText`. Componente novo nasce com seletor estável.

Gate: `npm run test:ci` verde e `npm run build` sem erro (o build do CRA falha em erro de tipo).

**Racional**: sem lint próprio nem checagem de tipo no CI, os testes e o build são o único gate.

### VI. Credencial nunca em URL, nem em log

- REST usa **header** `Authorization: Bearer`, aplicado pelo interceptor de `createApi`.
- A única exceção é o handshake do SignalR, via `accessTokenFactory` — o cliente coloca em query
  string porque WebSocket não carrega header custom, e o backend aceita isso **apenas** para
  `/chesshub`.
- Token, refresh token e senha **nunca** vão para `console.log`, mensagem de erro exibida ou
  atributo do DOM.
- Storage é por usuário **e por aba**: `sessionStorage.accessToken{userId}` /
  `refreshToken{userId}` + `sessionStorage.currentUserId` (emenda 1.0.1: era `localStorage`, que
  persistia além da sessão e não encerrava no logout). Chave global (`"token"`) é proibida — ela
  quebra o cenário de dois usuários no mesmo browser, que é exatamente o cenário de teste deste
  jogo. Sair apaga **todo** token da aba; o `:id` da rota só vira sessão se há token para ele com
  `sub` igual ao id.

**Racional**: token em URL vaza em log de servidor, histórico de browser, `Referer` e proxy. E
duas abas com o mesmo storage global significam dois jogadores compartilhando sessão.

### VII. Acessibilidade mínima e texto de UI em português

- Todo campo de formulário tem `<label htmlFor>` associado ao `id` do input.
- Mensagem de erro vai em elemento com `role="alert"`.
- Botão é `<button>`, não `<div onClick>`. Elemento interativo é alcançável por teclado.
- Imagem de peça tem `alt` descritivo (`"White Pawn"`).
- **Texto de UI em português**; código, tipo, nome de arquivo e commit em **inglês**. Mensagem
  vinda do servidor é exibida como veio.

**Racional**: o `role`/`label` correto é ao mesmo tempo o requisito de acessibilidade e o seletor
estável que o Princípio V exige — fazer certo uma vez resolve os dois.

## Padrões de stack

| Área | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript 4.9 em **Create React App** (`react-scripts` 5) |
| Roteamento | `react-router-dom` 6 |
| Real-time | `@microsoft/signalr` 8 atrás de `HubProvider`/`useHubConnection` |
| HTTP | `axios` 1.6 com interceptor em `src/service/Api.ts` |
| Token | `jwt-decode` 4 (`import { jwtDecode }`) |
| Estado | `useState` + `useContext` — sem biblioteca de estado |
| Estilo | CSS puro por componente em `src/styles/` |
| Teste | Jest + RTL + `axios-mock-adapter` + MSW **v1** + Playwright |

Dependência nova exige decisão explícita registrada. Ficam **fora** sem pedido: Redux/Zustand,
React Query/SWR, Tailwind/styled-components, Vite, Next.js, MSW v2, ESLint/Prettier próprios e
qualquer biblioteca de regra de xadrez (esta última viola o Princípio I).

## Fluxo de desenvolvimento

- **Branch**: feature pelo Spec Kit nasce `NNN-slug` (criada por `speckit.git.feature`); fora do
  fluxo, `feat/<slug>` ou `fix/<slug>`. Não commitar direto na `main`.
- **PR**: usa `.github/PULL_REQUEST_TEMPLATE.md`; `npm run test:ci` e `npm run build` verdes.
- **Contrato**: mudança em DTO, rota ou nome de método/evento de hub exige entrada em
  `BACKEND_CHANGES.md`.
- **Artefato de build**: `build/`, `coverage/`, `node_modules/` nunca versionados.
- **Encoding**: `.md`, `.ts`, `.tsx` em UTF-8 com acentuação preservada; normalização ASCII só em
  mensagem de commit.

## Governança

Esta constituição prevalece sobre prática informal. Emenda exige: proposta escrita com racional,
bump de versão conforme a política, propagação aos templates de `.specify/templates/` afetados, e
atualização do bloco SYNC IMPACT REPORT no topo deste arquivo.

**Política de versão**: `MAJOR` — remoção ou redefinição incompatível de princípio;
`MINOR` — princípio ou seção nova; `PATCH` — clarificação.

Desvio inevitável é documentado na tabela *Complexity Tracking* do plano da feature e — se
permanente — em `docs/debito-tecnico.md`.

Orientação operacional para agentes fica em [`AGENTS.md`](../../AGENTS.md).

**Versão**: 1.0.1 | **Ratificada**: 2026-08-01 | **Última emenda**: 2026-09-23
