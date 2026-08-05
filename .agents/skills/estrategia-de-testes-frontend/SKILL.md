---
name: estrategia-de-testes-frontend
description: >
  Como testar no KrockSide nos três níveis: unitário com Jest, React Testing Library e createFakeHub
  ou axios-mock-adapter; integração com MSW v1; E2E com Playwright e page.route. Cobre nomenclatura,
  seletores estáveis, limpeza de storage, act() com evento de hub, e a armadilha do mock que
  espelha rota errada. Use antes de escrever o primeiro teste de qualquer task, ao testar
  componente, hook, serviço, fluxo com REST, ou jornada no browser.
metadata:
  type: technical-skill
---

# Estratégia de testes (front-end)

> **Mantendo esta skill**
>
> Atualize quando uma receita mudar ou uma nova aparecer. Teste novo que siga as receitas aqui não
> exige mudança.

## Visão geral

Três níveis, com ferramentas distintas e sem sobreposição:

| Nível | Onde | Ferramenta | Cobre |
|---|---|---|---|
| Unitário | ao lado do arquivo (`{Nome}.test.tsx`) | Jest + RTL + `createFakeHub` / `axios-mock-adapter` | componente, hook, serviço isolados |
| Integração | `src/integration/` | Jest + RTL + **MSW v1** | fluxo atravessando componentes e REST |
| E2E | `tests-e2e/` | Playwright + `page.route` | jornada no browser, dev server real |

```bash
npm test                        # Jest em watch
npm run test:ci                 # Jest single-run + coverage
npx playwright install chromium # uma vez
npm run test:e2e                # Playwright headless (sobe o dev server sozinho)
npm run test:e2e:ui             # modo UI
npx tsc --noEmit                # checagem de tipo isolada
```

> ⚠️ Neste ambiente Windows o Node falha com `EPERM: lstat 'C:\Users\dgs-admin\AppData'` ao
> resolver o diretório do npm, então nenhuma baseline de contagem de teste foi verificada. **Rode
> antes de afirmar que a suíte está verde** — nunca reporte número que você não viu.

Cobertura atual: `Login`, `ChessBoard`, `ChessSquare`, `useAuth`, `useChessGame`, `Api`, `userApi`,
mais um teste de integração (`auth-flow`) e dois E2E (`login`, `lobby`).
**`ChessLobby` não tem teste unitário** — é o maior vão do repositório.

## Convenções

- **Nome**: `descreve('{Alvo}')` + `it('faz X quando Y')`, em português ou inglês — siga o arquivo
  vizinho. O que importa é o cenário ser legível sem abrir o corpo.
- **Estrutura**: Arrange / Act / Assert, com linha em branco separando.
- **Seletor estável, sempre.** Use `getByRole`, `getByLabelText`, `getByAltText`,
  `getByTestId`. **Nunca** classe CSS (`.highlighted`, `.chess-square`) e nunca texto solto de
  parágrafo — os dois mudam por motivo estético e quebram o teste sem bug real.
  Seletores já existentes: `square-{algebraic}`, `current-turn`, `player-color`, `role="alert"`,
  `alt="{Color} {Type}"`.
- **`userEvent` em vez de `fireEvent`** para interação de usuário (clique, digitação). `fireEvent`
  fica para o que `userEvent` não cobre — arrastar (`dragStart`/`dragOver`/`drop`).
- **Limpe o storage** em `beforeEach`: `localStorage.clear(); sessionStorage.clear();`. Sessão
  vazando entre casos é a causa mais comum de teste que passa sozinho e falha em suíte.
- **Nada de `waitFor` vazio nem `setTimeout`.** Espere por asserção
  (`await screen.findByText(...)`) ou por `waitFor(() => expect(...))`.
- **Cubra o caminho de recusa.** O servidor recusa com `success: false` + `message`; teste que só
  cobre o sucesso não protege nada. Para `MakeMove`, use as mensagens reais
  (`"Not your turn."`, `"That piece is not yours."`, `"Illegal move."`).

## Receita: componente ou hook que fala com o hub

`src/test-utils/hub.tsx` já oferece o dublê. Nunca conecte de verdade.

```tsx
import { HubConnectionState } from '@microsoft/signalr';
import { createFakeHub, HubTestProvider } from '../test-utils/hub';

const hub = createFakeHub();                    // default: Connected
hub.setInvoke(async (method, ...args) => {
  switch (method) {
    case 'StartGame':      return { success: true, snapshot: snapshotFake };
    case 'GetPossibleMoves': return { success: true, from: 'e2', moves: [squareFake('e4')] };
    case 'MakeMove':       return { success: false, message: 'Not your turn.' };
    default: throw new Error(`método não esperado: ${method}`);   // ← importante
  }
});

render(
  <HubTestProvider hub={hub}>
    <ChessBoard />
  </HubTestProvider>,
);
```

- **Sempre `throw` no `default`.** Método inesperado devolvendo `undefined` produz falha confusa
  três asserções depois; com `throw`, a mensagem diz exatamente o que faltou.
- Para emitir evento do servidor, use `hub.emit` — envolvido em `act()`, porque o handler altera
  estado:

  ```tsx
  act(() => {
    hub.emit('BoardChanged', {
      from: 'e2', to: 'e4', byColor: 'White', nextTurn: 'Black', snapshot: snapshotFake,
    });
  });
  ```

- Para o caminho "não conectado": `createFakeHub(HubConnectionState.Disconnected)` e asserte que
  **nada** foi invocado.
- Componente que usa `useParams`/`useNavigate` precisa de router: envolva em
  `<MemoryRouter initialEntries={['/chess-board/sala/guid-1']}>` + `<Routes>`, ou mocke
  `react-router-dom` parcialmente.
- Detalhes da conexão: skill `conexao-signalr`.

## Receita: serviço REST isolado

```ts
import MockAdapter from 'axios-mock-adapter';
import { createApi } from './Api';

const instance = createApi('https://api.test/');
const mock = new MockAdapter(instance);

mock.onPost('login').reply(200, { success: true, accessToken: 'jwt', userId: 'guid-1', ... });
```

- Teste o **interceptor** explicitamente: grave o token no storage, dispare um request e asserte o
  header `Authorization` no `mock.history`.
- `userApi` usa a instância singleton `api`; para testá-lo, mocke sobre ela ou injete uma instância
  de teste. Cubra os caminhos de erro que o código trata — `getValidation` com 404 deve devolver
  `null`, não lançar.
- **Use a rota que o código chama, não a que deveria chamar.** Se você "corrigir" a rota só no
  mock, o teste passa e a aplicação continua quebrada.

## Receita: integração com MSW

MSW **v1** (`rest`, não `http` da v2). Handlers em `src/mocks/handlers.ts`, servidor node em
`src/mocks/server.ts`.

```ts
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- `onUnhandledRequest: 'error'` é o que transforma "chamou rota que ninguém mockou" em falha
  explícita. Use sempre.
- Sobreponha por teste com `server.use(rest.post(...))` em vez de editar `handlers.ts` para um caso
  específico.
- `setupTests.ts` já injeta `TextEncoder`/`TextDecoder` (o MSW precisa deles no jsdom) e
  `package.json` mapeia `axios` para o build CJS. Não mexa nessas duas configurações sem motivo:
  elas existem porque o CRA + jsdom + MSW v1 exigem.

### ⚠️ Os mocks atuais espelham rotas erradas

`src/mocks/handlers.ts` mocka `POST /create`, `GET /get/:id` e `POST /refresh` — exatamente as três
rotas que **não existem** no backend (o correto é `/users`, `/users/{id}`, `/refresh-token`, ver
DT-02). Os E2E fazem o mesmo com `page.route('**/get/**')`.

É por isso que a suíte está verde enquanto cadastro, refresh e entrada em sala estão quebrados em
execução real. **Ao corrigir uma rota em `userApi`, corrija o mock no mesmo commit.** Mock que
confirma o bug é pior que ausência de teste.

## Receita: E2E com Playwright

`playwright.config.ts` sobe o dev server (`npm start`) com `BROWSER=none` e
`REACT_APP_E2E=true`, e usa `baseURL` de `E2E_BASE_URL` ou `http://localhost:3000`.

```ts
test.beforeEach(async ({ page }) => {
  await page.route('**/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, accessToken: 'fake-jwt', userId: 'guid-1', ... }),
    }),
  );
});

test('navigates to lobby after login', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('a@b.com');
  await page.getByLabel('Senha').fill('pw');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/chess-lobby\//);
});
```

- Mocke **todas** as chamadas REST da jornada com `page.route`; requisição não mockada vai para
  `https://localhost:5001` de verdade e falha por certificado.
- **O hub SignalR não é mockável por `page.route`** de forma prática (negotiate + WebSocket). E2E
  cobre login, navegação e render — jornada que depende de partida em andamento é escopo de teste
  de integração com `createFakeHub`, não de E2E.
- `getByLabel` funciona porque o formulário tem `<label htmlFor>` associado (Princípio VII):
  acessibilidade e testabilidade são a mesma coisa aqui.
- `npx playwright install chromium` é obrigatório antes da primeira execução.

## Ao adicionar comportamento novo

1. Leia a skill de domínio da área (`tabuleiro-e-jogada`, `lobby-e-sala`,
   `autenticacao-e-sessao`, `contrato-do-backend`).
2. Escreva o teste que falha **primeiro** (Princípio V), no nível mais baixo que consiga cobrir o
   comportamento — unitário sempre que possível.
3. Liste os cenários antes de codificar: sucesso, recusa do servidor com `message`, entrada
   inválida, hub não conectado, sessão ausente.
4. Só então implemente.
5. Rode `npm run test:ci` **e** `npm run build` (o build falha em erro de tipo) e reporte o
   resultado real.

## Fora de escopo hoje

Sem teste de acessibilidade automatizado (`jest-axe`), sem snapshot de componente, sem teste de
performance, sem cobertura mínima como gate, sem contract test contra o backend real. Introduzir
qualquer um é decisão de arquitetura: escale antes de montar infraestrutura nova.
