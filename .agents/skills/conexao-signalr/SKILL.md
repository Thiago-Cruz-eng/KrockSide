---
name: conexao-signalr
description: >
  Camada de conexão SignalR do KrockSide: HubProvider único montado acima do Router, contexto
  HubContext, hook useHubConnection com invoke tipado e on que devolve desinscrição,
  accessTokenFactory lendo o storage por usuário, reconexão automática, e a armadilha do useEffect
  que depende de [url, factory]. Use ao adicionar chamada ou assinatura de evento do hub, mexer em
  useHubConnection ou useChessGame, depurar conexão que não sobe, evento que não chega, ou testar
  componente que fala com o hub.
metadata:
  type: technical-skill
---

# Conexão SignalR

> **Mantendo esta skill**
>
> Atualize quando a estratégia de conexão mudar. Adicionar mais um `invoke` que siga o padrão não
> exige mudança aqui.

## Visão geral do padrão

Uma conexão para todo o app, criada por um provider e consumida por hook.

```
src/hooks/useHubConnection.tsx
  HubContext            createContext<HubConnectionApi | null>(null)
  HubProvider           cria, inicia e para a conexão; publica o estado
  defaultFactory(url)   HubConnectionBuilder + accessTokenFactory + reconnect
  useHubConnection()    consome o contexto; lança se usado fora do provider
src/test-utils/hub.tsx
  createFakeHub()       dublê com setInvoke/emit para teste
  HubTestProvider       injeta o dublê no HubContext
```

Montagem em `src/index.tsx`: `<HubProvider>` envolve `<Router>`, que envolve `<App>`. A conexão
sobe uma vez, antes de qualquer rota, e vive enquanto o app viver.

## API do hook

```ts
interface HubConnectionApi {
  connection: HubConnection | null;
  state: HubConnectionState;
  invoke: <T = unknown>(method: string, ...args: unknown[]) => Promise<T>;
  on: (event: string, handler: (...args: unknown[]) => void) => () => void;
}
```

Uso correto:

```ts
const { state, invoke, on } = useHubConnection();

// 1. sempre gate pelo estado antes de invocar em efeito
useEffect(() => {
  if (state !== HubConnectionState.Connected) return;

  void carregar();

  // 2. `on` devolve a função de desinscrição — use no cleanup
  const off = on('BoardChanged', (...args) => {
    const payload = args[0] as BoardChangedEvent;   // 3. cast único, na borda
    setSnapshot(payload.snapshot);
  });
  return () => off();
}, [state, on]);

// 4. invoke sempre com o tipo de retorno explícito
const result = await invoke<MakeMoveResponse>('MakeMove', room, from, to);
```

Quatro regras que resumem tudo:

1. **Nunca invoque sem checar `state === HubConnectionState.Connected`.** O `invoke` do provider
   lança `Hub not connected (state=...)` de propósito — é falha alta, não silenciosa, mas em efeito
   de montagem ela acontece antes do handshake.
2. **Sempre desinscreva no cleanup.** `on` devolve `() => conn.off(event, handler)`. Sem isso, o
   handler duplica a cada remontagem e o mesmo evento processa duas vezes.
3. **Cast do payload uma vez, dentro do handler.** O tipo do handler é `(...args: unknown[])`;
   converta `args[0]` para o DTO de `src/types/chess.ts` e trafegue tipado dali. Cast espalhado pelo
   componente é violação do Princípio IV.
4. **`invoke<T>` sempre com `T`.** Sem o tipo, o retorno é `unknown` e o erro de contrato aparece
   em runtime.

## `accessTokenFactory` e autenticação

```ts
new HubConnectionBuilder()
  .withUrl(url, {
    accessTokenFactory: () => {
      const userId = sessionStorage.getItem('currentUserId');
      return getStoredToken(userId) ?? '';
    },
  })
  .withAutomaticReconnect([0, 2000, 5000, 10000])
  .configureLogging(LogLevel.Warning)
  .build();
```

- A factory é chamada **a cada** (re)conexão, não só na primeira: token renovado é pego
  automaticamente na próxima reconexão.
- Ela lê o **mesmo** storage do interceptor REST (`sessionStorage.currentUserId` +
  `sessionStorage.accessToken{userId}`), via `getCurrentToken()`. Nunca duplique essa leitura em
  outro lugar — o dono é `src/service/Api.ts`.
- **Refresh de token reabre a conexão.** `setStoredTokens` (chamado pelo interceptor de refresh e
  pelo login) notifica `onSessionChange`, o provider incrementa `sessionEpoch` e o efeito derruba e
  recria a conexão com o token novo. `useChessGame` reentra na sala (`rejoin`) ao reconectar. No
  logout, `clearAllStoredTokens` faz o mesmo caminho e a conexão fica em `Disconnected`.
- Em `onclose` com erro de autenticação **não** há tratamento extra: o estado vira `Disconnected`
  e quem decide o que fazer é a sessão (interceptor/`RequireAuth`), não a camada de conexão.
- Retornar `''` faz o handshake acontecer **sem** token e o backend rejeita com 401 no negotiate.
  Sintoma: conexão nunca sai de `Connecting`/`Disconnected` e o console mostra
  `Hub start failed:`.
- O token vai em query string (`?access_token=`) porque WebSocket não carrega header custom. O
  backend aceita isso **apenas** para `/chesshub`.

## Reconexão

`withAutomaticReconnect([0, 2000, 5000, 10000])` — quatro tentativas, então desiste. O provider
assina `onreconnecting`, `onreconnected` e `onclose` para republicar `state`, então componentes
reagem sozinhos via a dependência `[state]`.

O que a reconexão **não** faz:

- **não restaura a sala:** os grupos do SignalR são por `ConnectionId`, e reconectar gera
  `ConnectionId` novo. É preciso invocar `JoinRoom` de novo;
- **não restaura a cor:** o backend atribui slot por `ConnectionId`; se a sala já tinha dois
  jogadores, quem caiu não volta para a mesma cor;
- **não repõe o estado do tabuleiro:** o caminho correto é `GetBoardSnapshot` (exposto como
  `refresh` em `useChessGame`, hoje sem nenhum consumidor — ver DT-07).

Ao implementar recuperação de sessão, trate esses três pontos explicitamente.

## Armadilhas conhecidas

- **`useEffect` do provider depende de `[url, factory]`.** Passar `factory` como função inline
  (`<HubProvider factory={() => criar()}>`) cria uma referência nova a cada render e **derruba e
  recria a conexão em loop**. Sempre memoize (`useMemo`/`useCallback`) ou passe uma função estável
  de módulo. Em teste, prefira `HubTestProvider` com `createFakeHub`.
- **`connection` no valor do contexto é lido de `connectionRef.current` no `useMemo`.** No primeiro
  render ele é `null`; o `useMemo` só recalcula quando `state`/`invoke`/`on` mudam. Não dependa de
  `connection` diretamente — use `state`, `invoke` e `on`.
- **`useHubConnection` fora do provider lança** `useHubConnection must be used inside HubProvider`.
  Em teste, o erro significa que faltou `HubTestProvider`.
- **`HubConnectionState` é enum do `@microsoft/signalr`** — compare com o enum
  (`HubConnectionState.Connected`), nunca com a string `'Connected'`.
- **Evento duplicado** em `React.StrictMode`: em desenvolvimento o efeito roda duas vezes. Se a
  desinscrição estiver correta, isso é inofensivo; se não estiver, o sintoma aparece só em dev e
  confunde.

## Testando

Nunca use conexão real em teste. `src/test-utils/hub.tsx`:

```tsx
const hub = createFakeHub();                       // HubConnectionState.Connected por default
hub.setInvoke(async (method, ...args) => {
  if (method === 'GetBoardSnapshot') return snapshotFake;
  if (method === 'MakeMove') return { success: false, message: 'Not your turn.' };
  throw new Error(`método não esperado: ${method}`);
});

render(
  <HubTestProvider hub={hub}>
    <ComponenteSobTeste />
  </HubTestProvider>,
);

hub.emit('BoardChanged', { from: 'e2', to: 'e4', byColor: 'White', nextTurn: 'Black', snapshot });
```

- `setInvoke` recebe **todos** os métodos: faça o `switch` por nome e **lance** no default. Método
  inesperado que devolve `undefined` produz falha confusa três asserções depois.
- `emit` dispara os handlers registrados por `on` de forma **síncrona** — envolva em `act()` quando
  o handler altera estado de componente.
- `createFakeHub(HubConnectionState.Disconnected)` cobre o caminho "não conectado": use para provar
  que o componente não invoca nada antes do handshake.
- Detalhes das receitas completas: skill `estrategia-de-testes-frontend`.

## Ao adicionar um método ou evento novo

1. Confirme na skill `contrato-do-backend` que o nome existe **exatamente** assim no hub do backend
   (nome de método SignalR é case-sensitive e não há checagem em tempo de compilação).
2. Declare o DTO em `src/types/chess.ts`.
3. Invoque com `invoke<NovoDto>('NomeExato', ...)`, ou assine com `on` + cast na borda + cleanup.
4. Cubra com `createFakeHub`, incluindo o caminho `success: false`.
5. Se o nome ou o payload mudou no backend, registre em `BACKEND_CHANGES.md`.
