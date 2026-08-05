# Guia do desenvolvedor — KrockSide

Guia de tarefa: **"quero fazer X, começo por onde?"**. Escrito para quem está chegando agora.

Não repete o que já tem dono — quando o assunto está documentado em outro lugar, este guia aponta:

| Preciso de… | Está em |
|---|---|
| Subir o front e o backend na minha máquina | [`../README.md`](../README.md) |
| Convenções obrigatórias, stack, áreas críticas | [`../AGENTS.md`](../AGENTS.md) |
| O que já se sabe que está torto | [`debito-tecnico.md`](debito-tecnico.md) |
| O que estamos pedindo ao backend | [`../BACKEND_CHANGES.md`](../BACKEND_CHANGES.md) |
| O que o backend realmente entrega | `../../Hibrygame/docs/FRONTEND_CHANGES.md` |
| Como o backend funciona por dentro | `../../Hibrygame/docs/guia-do-desenvolvedor.md` |

> **Antes de tudo, duas coisas.**
>
> 1. O código deste repositório é comentado de propósito, e os comentários explicam **por quê** —
>    muitos citam o bug concreto que motivou a decisão. Leia o comentário do topo do arquivo antes de
>    mexer nele; costuma conter exatamente o aviso que evitaria a próxima hora de investigação.
> 2. Se algum documento do repositório contradisser o código, **o código ganha** — e a divergência
>    deve ser corrigida no documento, no mesmo PR. Já aconteceu de o `AGENTS.md` descrever Create
>    React App muito depois de o Vite ter entrado.

---

## 1. O princípio que manda em tudo

**O servidor é a autoridade.** O front nunca decide:

- se um lance é legal;
- de quem é o turno;
- qual a cor do jogador;
- o que o usuário pode acessar.

Consequências práticas, e elas não são negociáveis:

- **É proibido atualizar o tabuleiro de forma otimista.** O estado novo vem sempre do `snapshot` da
  resposta ou do evento `BoardChanged`. Nunca mova a peça na tela "enquanto o servidor confirma".
- `GetPossibleMoves` serve para **destacar** casas, não para autorizar. A checagem contra
  `highlighted` existe só para a interface não propor um lance que ela já sabe que será recusado.
- A cor vem de `JoinRoom`, guardada em `gameSession`. **Nunca de claim do JWT.** Derivar do claim
  `role` fazia `playerColor` ser sempre `'None'` e travava o tabuleiro inteiro — era a DT-01.
- Regra de xadrez **não entra aqui**. Nada de `chess.js`.

---

## 2. O mapa mental

```
components/   desenham e despacham. Não conhecem axios nem @microsoft/signalr.
     |
     v
hooks/        estado e orquestração. Não renderizam.
     |
     v
service/      falam com a rede e com o storage. Não conhecem React.
     |
     v
types/        o contrato do backend, em TypeScript.
```

Se um componente está importando `axios`, a camada foi furada.

### Quem faz o quê

| Arquivo | Papel |
|---|---|
| `service/Api.ts` | instância do axios, interceptor de `Authorization`, storage de token **por usuário**, e o aviso de mudança de sessão |
| `service/userApi.ts` | todas as chamadas REST, uma função por endpoint |
| `service/gameSession.ts` | cor e nome do jogador **por sala** |
| `hooks/useHubConnection.tsx` | a conexão SignalR única da aplicação (`invoke`/`on`) |
| `hooks/useChessGame.ts` | a partida: snapshot, lances, eventos do hub |
| `hooks/useChessLobby.ts` | o lobby: salas, jogadores, entrada em sala |
| `hooks/useAuth.ts` | a sessão como estado de React |
| `hooks/useSquareSelection.ts` | escolher peça e mover, por clique ou arraste |
| `hooks/useLastMove.ts` | quais duas casas mudaram no último lance |
| `hooks/useBoardOrientation.ts` | ordem de desenho conforme o lado do jogador |
| `types/chess.ts`, `types/auth.ts` | espelho do contrato do backend |

---

## 3. Receitas

### Receita 1 — Componente novo

1. Um arquivo por componente em `src/components/`, `React.FC` com props tipadas em
   `interface {Nome}Props` **exportada**.
2. CSS em `src/styles/{Nome}.css`, importado no topo do componente. Use as variáveis de
   `tokens.css` em vez de cor literal.
3. Teste ao lado: `{Nome}.test.tsx`.
4. Exponha `data-testid` ou `role`/`label` — **teste não depende de classe CSS** nem de texto solto.

Componente que só apresenta não deve receber a orquestração toda. Se ele precisa de mais de três ou
quatro props de estado, o sinal é que falta um hook.

### Receita 2 — Hook novo

1. `use{Nome}` em `src/hooks/`.
2. Devolva um **objeto** com API nomeada, nunca uma tupla, e exporte a interface (`ChessGameApi`,
   `SquareSelectionApi`).
3. Toda função devolvida é `useCallback` — sem isso ela é nova a cada render e invalida a
   memoização de quem a recebe.
4. Hook **não navega**. Devolva a rota e deixe o componente chamar `navigate` — é o que faz
   `useChessLobby.joinRoom`, e é o que permite testá-lo sem `MemoryRouter`.

### Receita 3 — Chamada nova ao backend

1. **Confira o contrato real primeiro**, em `../../Hibrygame/docs/FRONTEND_CHANGES.md` ou no próprio
   código do backend. Não escreva o tipo que você gostaria que existisse.
2. Declare o request e o response em `src/types/`, em camelCase.
3. Acrescente a função em `src/service/userApi.ts`. URL **relativa** — a base vem de
   `VITE_API_BASE_URL`.
4. Atualize os handlers do MSW em `src/mocks/handlers.ts` **no mesmo commit**.
5. Se o backend precisa mudar, registre em `../BACKEND_CHANGES.md` com contrato antigo, novo e
   motivo — e não implemente contra endpoint que ainda não existe sem marcar isso.

> **A armadilha mais cara deste repositório já aconteceu aqui.** Três rotas de `userApi` apontavam
> para endpoints inexistentes e respondiam 404 em produção. A suíte ficava **verde** porque os
> dublês do MSW e do Playwright reproduziam as mesmas rotas erradas. Mock que espelha o bug não
> testa nada. Ao mexer em rota, confira contra o servidor real.

### Receita 4 — Evento novo do hub

```ts
useEffect(() => {
  if (state !== HubConnectionState.Connected) return;

  const off = on('NomeDoEvento', (...args) => {
    // Cast na BORDA, num único lugar. Daqui para frente o valor é tipado.
    const payload = args[0] as MeuEvento;
    setAlgo(payload.campo);
  });

  return () => off();          // sem isto, cada reconexão empilha um handler novo
}, [state, on]);
```

Três pontos:

- **Só invoque método de hub quando `state === Connected`** — invocar desconectado estoura.
- O payload chega como `unknown[]`. Faça o cast **uma vez**, na borda, e trafegue tipado. `any` e
  `as any` são proibidos.
- **Sempre cancele a assinatura** no retorno do efeito.

### Receita 5 — Mexer no tabuleiro

Antes de tocar em `ChessBoard`, saiba que ele é só layout e fiação. Descubra qual das peças você
quer:

| Quero mudar… | Vá em |
|---|---|
| como se seleciona e move peça | `useSquareSelection` |
| o destaque do último lance | `useLastMove` |
| a orientação do tabuleiro | `useBoardOrientation` |
| o cartão de jogador | `PlayerCard` |
| o texto de fim de partida | `GameResult` |
| a aparência de uma casa | `ChessSquare` + `squareClassName` |
| conversar com o hub | `useChessGame` |

---

## 4. As armadilhas deste repositório

### Coordenadas: os nomes estão trocados

```
row    (0..7)  é o ARQUIVO  — a coluna `a`..`h`.        row = 0     -> arquivo `a`
column (0..7)  é a FILEIRA  — numerada AO CONTRÁRIO:    column = 0  -> fileira 8 (pretas)
                                                        column = 7  -> fileira 1 (brancas)
```

**Nunca converta à mão.** Use `toAlgebraic`, `fileFromRow` e `rankFromColumn` de `types/chess.ts`.
Trocar `8 - column` por `column + 1` desenha o tabuleiro invertido **e manda o lance errado ao
servidor**.

Tudo que atravessa o fio é algébrico (`"e2"`). `row`/`column` existem só para o grid.

### Token: nunca leia `localStorage` direto

O storage é **por usuário** (`accessToken{userId}`), mais `sessionStorage.currentUserId` para o
interceptor saber qual usar. Quem monta essas chaves é `service/Api.ts`, e **só ele**. Errar a chave
desloga todo mundo em silêncio.

O `userId` viaja na URL para que `useAuth` saiba de qual conta ler. Isso não é credencial — o token
continua indo por cabeçalho.

### A conexão do hub é única, e frágil de recriar

`HubProvider` monta em `src/index.tsx`, **acima** do `Router`. Duas coisas a saber:

- A `factory` fica atrás de um `useRef`, **fora** das dependências do efeito. Quando ela entrava nas
  dependências, uma arrow inline recriava a função a cada render e a conexão caía junto — a partida
  morria a cada re-render do provider.
- O provider monta antes de qualquer login, então a primeira negociação vai sem token e leva 401. O
  `withAutomaticReconnect` do SignalR **não repete uma conexão inicial que falhou** — só reage a
  conexão que caiu depois de ter subido. É por isso que existe `onSessionChange`/`sessionEpoch`: sem
  ele, o token que aparece no login nunca era usado e o lobby ficava desconectado para sempre.

Em desenvolvimento o `StrictMode` monta tudo duas vezes: ver a conexão abrir e fechar duas vezes é
esperado, não bug.

### `npm` falha nesta máquina

```
Error: EPERM: operation not permitted, lstat 'C:\Users\dgs-admin\AppData'
```

O `npm` do `PATH` resolve por um symlink do nvm4windows que aponta para o perfil de outro usuário.
`node` funciona. Duas saídas:

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path   # preferido
npm run test:ci

# ou, sem npm:
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\eslint\bin\eslint.js . --max-warnings 0
node .\node_modules\vitest\vitest.mjs run
```

### `npm test` é single-run, não watch

Ao contrário do CRA. Para watch, `npm run test:watch`.

### O `.env` afeta os testes

O Vitest também carrega `.env`. Os handlers do MSW derivam a base de `API_BASE_URL` justamente por
isso — handler com base fixa em `https` falharia se você apontasse a API para `http`, e o sintoma
seria a mensagem de `catch` do componente ("Falha ao fazer login"), sugerindo bug de UI onde há
divergência de mock.

### Detalhes herdados que valem conhecer

- `DecodedToken` declara `emailAddress` e `role`; o backend emite `email` e o papel na chave longa de
  `ClaimTypes.Role`. Os dois campos são sempre `undefined` (DT-04).
- `ChessBoard.emptySquare` inventa uma casa vazia quando o snapshot não a traz. Mascara snapshot
  incompleto (DT-13).
- `useChessGame.refresh` existe e **ninguém usa** — seria o caminho correto de reconexão (DT-07).
- `useChessLobby.joinRoom` tem **dois `return null` silenciosos**: o jogador clica em "Entrar na
  sala" e nada acontece, sem mensagem (DT-10). Estão marcados com `// silencioso` no código.
- Após um **arraste** recusado os destaques ficam na tela; após um **clique** recusado, não. A
  assimetria está documentada em `useSquareSelection.handleDropPiece`.
- A regra `react-hooks/set-state-in-effect` está desligada, com o motivo escrito no
  `eslint.config.js` (DT-15).

Encontrou outra? Registre em [`debito-tecnico.md`](debito-tecnico.md) em vez de corrigir de lado — e
se resolver um item, **remova-o da lista**. Vários itens ficaram lá depois de resolvidos, e débito
resolvido que continua listado é pior que débito não listado: ensina a não confiar no documento.

---

## 5. Testes

| Testando | Como |
|---|---|
| Componente | `@testing-library/react`, procure por `role`/`label`/`data-testid` |
| Hook com hub | `HubTestProvider` + `createFakeHub` de `src/test-utils/hub.tsx` |
| Chamada REST isolada | `axios-mock-adapter` na instância `httpClient` de `Api.ts` |
| Fluxo ponta a ponta com rede | MSW, handlers em `src/mocks/handlers.ts` |
| Jornada no navegador | Playwright em `tests-e2e/`, com `page.route` |

**Cuidado com mock que mente.** É o erro que já custou caro aqui duas vezes:

- os dublês reproduziam as rotas REST erradas, então a suíte não podia pegar o 404;
- no backend, um teste configura o mock para devolver `null` onde a implementação real **lança
  exceção** — o teste passa contra um comportamento que não existe.

Ao mockar, confirme o que o alvo real faz no caso de ausência: devolve `null`, lança, ou devolve
lista vazia?

---

## 6. Antes de pedir review

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

- [ ] Os quatro verdes. É o que o CI (`.github/workflows/ci.yml`) roda.
- [ ] `npm run lint` passa com `--max-warnings 0`, incluindo os limites de complexidade.
- [ ] Nada de update otimista do tabuleiro, nada de regra de xadrez no cliente.
- [ ] Contrato mudou? → `types/` ajustado, MSW ajustado, `BACKEND_CHANGES.md` atualizado.
- [ ] Débito criado ou resolvido? → `docs/debito-tecnico.md`.
- [ ] Estrutura ou convenção mudou? → `AGENTS.md` + `README.md` + `.claude/CLAUDE.md`.

Bateu num limite de complexidade? **Extraia uma função nomeada.** Subir o número no
`eslint.config.js` é a última alternativa, e pede comentário dizendo por quê.

---

## 7. Onde não mexer sem conversar

| Arquivo | Por quê |
|---|---|
| `service/Api.ts` | interceptor e storage de token; errar a chave desloga todo mundo em silêncio |
| `hooks/useHubConnection.tsx` | a conexão única; já quebrou de duas formas distintas e as duas estão comentadas lá |
| `types/chess.ts` / `types/auth.ts` | divergência aqui não quebra compilação, quebra em runtime |
| `types/chess.ts` (helpers de coordenada) | inverter o tabuleiro por acidente é fácil e o sintoma é distante |
| `service/userApi.ts` | rotas já divergiram do backend e a suíte não pegou |
| `vite.config.ts` | porta 3000 é contrato com o CORS do backend e com o Playwright; os pisos de cobertura são catraca |

Nesses casos leia a skill correspondente em [`../.agents/skills/`](../.agents/skills/) **antes** —
ela tem precedência sobre padrão inferido do código.
