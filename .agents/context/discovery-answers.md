---
name: discovery-answers
description: Contexto e decisões da descoberta do KrockSide (front-end React, projeto pessoal em retomada, escopo repositório inteiro) — objetivo, restrições herdadas, decisões transversais evidenciadas no código, divergências confirmadas contra o backend Hibrygame e decisões pendentes. Levantado em 2026-08-01 junto com a portabilidade do harness.
metadata:
  responsibility: "Memória durável do contexto e das decisões de descoberta: objetivo, escopo, restrições, decisões transversais validadas, divergências com o backend e log de decisões humanas pendentes. Fonte relida pelas etapas seguintes; suas restrições precedem qualquer inferência posterior."
---

# Memória de descoberta — KrockSide

## 1. Objetivo e escopo

**Objetivo.** Levantar o contexto canônico do front-end para orientar as skills e o fluxo
spec-driven, no momento em que o par de repositórios (`KrockSide` + `Hibrygame`) é retomado após
pausa longa.

**Tipo de sistema:** front-end SPA (React 18 + TypeScript, Create React App), cliente de um backend
ASP.NET Core 8 por REST e SignalR.
**Tipo de projeto:** projeto pessoal em **retomada**. Não há usuário em produção. Quebrar contrato
é barato; corrigir divergência vale mais que preservar comportamento atual.
**Escopo:** repositório inteiro (`src/`, `tests-e2e/`, configuração).

**Consequência para as etapas seguintes:** toda inferência é ancorada no código atual **e** no
contrato real do backend. Onde o código deste repositório divergir do backend, o **backend
prevalece** — ele é quem está rodando.

## 2. Restrições declaradas

O pedido que originou esta descoberta foi a **portabilidade do harness de agentes** (vindo de
`verum-sales-global-backend`, via `Hibrygame`), sem restrição adicional declarada.

As restrições reais vêm do repositório e do backend, e estão consolidadas abaixo. Elas têm o mesmo
peso de restrição declarada e **precedem qualquer inferência posterior**.

### 2.1 Restrições herdadas (não negociáveis)

| Restrição | Origem | Efeito nas etapas seguintes |
|---|---|---|
| **O servidor é a autoridade** — o front não decide legalidade de jogada, turno, cor nem permissão; nenhuma atualização otimista de tabuleiro | Constituição Princípio I (NON-NEGOTIABLE) | Regra de xadrez no cliente é proibida; estado de jogo vem sempre de `snapshot` ou evento |
| **Contrato tipado em `src/types/`** e confirmado contra o backend antes de implementar | Constituição Princípio II (NON-NEGOTIABLE) | Endpoint inexistente só com registro em `BACKEND_CHANGES.md` |
| **Camadas `components → hooks → service → types`** | Constituição Princípio III | Componente não importa `axios` nem `@microsoft/signalr` |
| **`strict: true`, sem `any` e sem `as any`** | Constituição Princípio IV; `tsconfig.json` | Cast de payload de hub só na borda do handler |
| **Três níveis de teste + TDD para regra nova** | Constituição Princípio V | Task de comportamento começa pelo teste; seletor estável obrigatório |
| **Credencial nunca em URL nem em log; storage por `userId`** | Constituição Princípio VI | Exceção única: `accessTokenFactory` do handshake do hub |
| **Acessibilidade mínima; UI em português, código em inglês** | Constituição Princípio VII | `label htmlFor`, `role="alert"`, `<button>`, `alt` em imagem |
| **Stack enxuta** — sem Redux, React Query, Tailwind, Vite, Next, MSW v2, ESLint próprio | Constituição, "Padrões de stack" | Dependência nova exige decisão registrada |
| **CRA, não Vite** — variável de ambiente com prefixo `REACT_APP_`, lida em build time | `package.json` (`react-scripts` 5) | Mudar `.env` exige reiniciar o dev server |
| **Coordenada algébrica na fronteira** | Constituição Princípio I/II; `src/types/chess.ts` | `row`/`column` só para layout do grid, via helpers |

### 2.2 Restrição de ambiente descoberta durante o levantamento

Neste ambiente Windows, o Node falha ao resolver o diretório de instalação do npm:

```
Could not determine Node.js install directory
Error: EPERM: operation not permitted, lstat 'C:\Users\dgs-admin\AppData'
```

`npm run test:ci`, `npx tsc --noEmit` e `npm run build` **não puderam ser executados** durante a
descoberta. Nenhuma contagem de teste registrada em qualquer artefato deste harness foi verificada.
É problema de ambiente (perfil de usuário/permissão), não do repositório — mas qualquer agente que
prometa "suíte verde" sem ter rodado está inventando. **Rode antes de afirmar.**

## 3. Decisões transversais evidenciadas no código

Já implementadas; destino documental definido. Não se repetem no `functional-map.md`.

| Tema | Decisão vigente | Onde vive |
|---|---|---|
| Conexão real-time | provider único `HubProvider` montado acima do `Router`, com `withAutomaticReconnect([0,2000,5000,10000])`; `invoke` recusa quando não conectado; `on` devolve desinscrição | skill `conexao-signalr` |
| Token | `sessionStorage.accessToken{userId}` + `refreshToken{userId}` (era `localStorage` até 2026-09-23), `sessionStorage.currentUserId`, interceptor de `Authorization` e de refresh single-flight no `createApi`, `RequireAuth` nas rotas; leitura só em `src/service/Api.ts` | skill `autenticacao-e-sessao`, `docs/seguranca.md` |
| Chamadas REST | centralizadas em `userApi`, uma função por endpoint, tipos de `src/types/auth.ts` | skill `contrato-do-backend` |
| Estado de jogo | `useChessGame` como única fonte: `snapshot`, `highlighted` (`Set<string>` de algébricos), `lastMoveError` | skill `tabuleiro-e-jogada` |
| Coordenada | `toAlgebraic(row, column)`, `fileFromRow`, `rankFromColumn` em `src/types/chess.ts`; `file = 'a' + row`, `rank = 8 - column` | skill `tabuleiro-e-jogada` |
| Teste unitário de hub | `createFakeHub()` + `HubTestProvider` (`src/test-utils/hub.tsx`), com `setInvoke` e `emit` | skill `estrategia-de-testes-frontend` |
| Teste de integração | MSW v1 com `server` em `src/mocks/server.ts` | skill `estrategia-de-testes-frontend` |
| Teste E2E | Playwright sobe o dev server (`webServer`) e mocka o backend com `page.route` | skill `estrategia-de-testes-frontend` |
| Estilo | CSS puro, um arquivo por componente em `src/styles/`, importado no topo | skill `padroes-react-typescript` |
| Fluxo de especificação | Spec Kit, scripts PowerShell, `context_file: CLAUDE.md` | `AGENTS.md` |

## 4. Divergências confirmadas contra o backend

Comparação feita em 2026-08-01 contra o código real do backend (`../Hibrygame`). Todas detalhadas
em [`docs/debito-tecnico.md`](../../docs/debito-tecnico.md); resumo para orientar planejamento:

| # | Divergência | Impacto |
|---|---|---|
| DT-01 | cor do jogador lida do claim `role` do JWT (que carrega papel de permissão, e nem sob essa chave) | **jogo bloqueado**: `isMyTurn` sempre falso, 64 quadrados `disabled` |
| DT-02 | rotas `create`, `get/{id}` e `refresh` não existem no backend (`/users`, `/users/{id}`, `/refresh-token`) | cadastro e refresh nunca funcionaram; entrar em sala falha em 404 antes de tudo |
| DT-03 | payload e resposta de cadastro/usuário incompatíveis (`Role`/`CreatedBy` obrigatórios no backend; sem `accessToken` na resposta) | cadastro não autentica; `user.userName` é `undefined` |
| DT-04 | `DecodedToken` declara `emailAddress` e `role`, que o backend não emite sob esses nomes | campos sempre `undefined` |
| DT-05 | `BACKEND_CHANGES.md` lista nomes de método/evento de hub que o backend não usa, contradizendo o `README.md` | dois documentos do mesmo repo se contradizem |
| DT-06 | respostas REST podem vir com envelope `$id`/`$values` (`ReferenceHandler.Preserve`) e nada trata | quebra em qualquer campo de lista |
| DT-07 | `StartGame` chamado por todo cliente ao conectar | `GameStarted` reemitido no meio da partida ao reconectar |
| DT-08 | navegação para o tabuleiro depende de `GetPlayersInRoom === 2` checado logo após entrar | primeiro jogador fica preso no lobby |
| DT-10 | a cor escolhida no lobby é ignorada pelo servidor (`TryAssignColor` atribui por ordem de chegada) | a UI promete escolha que não existe |

**Regra derivada:** o mock espelha a rota errada em `src/mocks/handlers.ts` e em
`tests-e2e/*.spec.ts`, e é por isso que a suíte não denuncia DT-02. **Ao corrigir contrato,
corrija o mock no mesmo commit** — mock que confirma o bug é pior que ausência de teste.

## 5. Log de decisões

### 5.1 Decisão de 2026-08-01 — harness portado, não copiado

O harness veio de `verum-sales-global-backend` (backend .NET multi-país), via `Hibrygame`. Nada da
arquitetura de origem se aplica aqui.

**Portado como estrutura, reescrito como conteúdo:** constituição (7 princípios próprios, de
front-end), `AGENTS.md`, `functional-map.md`, `discovery-answers.md`, skills de domínio e técnicas,
agentes de `.claude/agents/`, template de PR, workflow de CI.

**Portado verbatim (agnóstico ao repositório):** `.specify/scripts/`, `.specify/templates/` (exceto
a tabela de Constitution Check do `plan-template.md`), `.specify/extensions/` (extensão git),
`.specify/workflows/`, `.claude/settings.json` (allowlist de skills) e as seis skills de autoria em
`.agents/skills/`.

**Deliberadamente não portado:** fluxo Clovis e pasta `.clovis/`; pipeline de k8s/ACR/Sonar/Trivy;
skills de domínio de vendas B2B; `CODEOWNERS` com times de organização; qualquer princípio de Clean
Architecture em camadas de projeto .NET.

**Fluxo único:** apenas Spec Kit.

### 5.2 Decisões pendentes — `[DECISÃO]`

Exigem definição humana. Detalhadas em `docs/debito-tecnico.md`.

| # | Decisão | Bloqueia |
|---|---|---|
| D-01 | Direção do alinhamento de cadastro: front se adapta ao contrato atual do backend (rápido, mas manda `Role`/`CreatedBy` do cliente) ou pede endpoint de auto-registro ao backend (correto) — DT-03 | cadastro e primeiro acesso |
| D-02 | Envelope `ReferenceHandler.Preserve`: normalizar na borda do axios ou pedir ao backend para não usar `Preserve` nas rotas do front — DT-06 | qualquer campo de lista no REST |
| D-03 | Destino da coleção `Validation`: acompanha a decisão do backend (remover / redesenhar com `jti` / rebaixar a log). Enquanto pendente, o seletor de cor do lobby continua sem efeito — DT-10 | fluxo de entrada em sala e a promessa de escolher cor |
| D-04 | Perspectiva do tabuleiro: inverter para as pretas ou manter sempre a visão das brancas — DT-09 | UX da partida |
| D-05 | Adotar ESLint + Prettier próprios, aceitando um PR grande de reformatação — DT-11 | consistência de estilo |

Nenhuma dessas decisões precisa ser tomada para resolver **DT-01** (propagar a cor do `JoinRoom`
até o tabuleiro), que é o item de maior valor e o que desbloqueia jogar.
