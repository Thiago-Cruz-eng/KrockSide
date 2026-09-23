---
name: autenticacao-e-sessao
description: >
  Autenticação e sessão do KrockSide: login por e-mail e senha, storage de token por userId em
  sessionStorage (por aba) mais sessionStorage.currentUserId, interceptor de Authorization e
  interceptor de refresh single-flight no axios, useAuth que só aceita o :id da rota se o sub do
  token bate, RequireAuth como guarda de rota, logout total, tratamento de 429, e os claims que o
  JWT realmente emite. Use ao mexer em Login, useAuth, RequireAuth, src/service/Api.ts, storage de
  token, rota protegida, expiração ou renovação de sessão, ou ao investigar 401, 403, 429 e usuário
  deslogado do nada.
metadata:
  type: technical-skill
---

# Autenticação e sessão

> **Mantendo esta skill**
>
> Atualize quando o modelo de token, de storage, de renovação ou de guarda de rota mudar. Refactor
> que preserve o comportamento não exige mudança. Última revisão: 2026-09-23 (hardening).

## Visão geral do padrão

Token por usuário no `sessionStorage`, usuário corrente também no `sessionStorage`, um único ponto
de leitura, renovação automática e uma casca de rota autenticada.

```
src/service/Api.ts              ÚNICO dono do storage de token + instância axios + os DOIS interceptors
                                (Authorization no request; refresh single-flight no response 401)
src/hooks/useAuth.ts            estado de sessão em React: token, decoded, isValid, refreshing,
                                setTokens, logout — e a checagem :id da rota vs. claim `sub`
src/components/RequireAuth.tsx  guarda de rota: sem sessão para o :id → <Navigate to="/" replace />
src/types/auth.ts               DTOs de login/refresh/cadastro/validação + DecodedToken
src/components/Login.tsx        formulário único que alterna login e cadastro; trata 429
```

**Regra de ouro:** nenhum arquivo fora de `src/service/Api.ts` lê ou escreve token direto em
`sessionStorage`/`localStorage`. Use `getStoredToken`, `getStoredRefreshToken`, `setStoredTokens`,
`clearStoredTokens`, `clearAllStoredTokens`, `getCurrentToken` — ou o `useAuth`, que os encapsula.

## Storage: `sessionStorage`, por usuário, por aba

```ts
const ACCESS_TOKEN_KEY  = (userId: string) => `accessToken${userId}`;   // sessionStorage
const REFRESH_TOKEN_KEY = (userId: string) => `refreshToken${userId}`;  // sessionStorage
sessionStorage.setItem('currentUserId', userId);   // quem o interceptor e o hub devem usar
```

Decisão de 2026-09-23: **`sessionStorage` em vez de `localStorage`** (era SEC-F-01 da auditoria).
Consequências, todas deliberadas:

- **A sessão não sobrevive a fechar a aba/navegador.** O usuário loga de novo. Reload (F5)
  **preserva** — `sessionStorage` sobrevive a recarga da mesma aba.
- **Duas abas = duas sessões independentes.** O cenário "dois jogadores no mesmo navegador"
  continua funcionando (cada aba faz o próprio login) e fica mais isolado: o token de uma aba não
  existe na outra.
- **Ninguém lê mais do `localStorage`.** `clearAllStoredTokens()` ainda varre `accessToken*` /
  `refreshToken*` de lá para apagar resquício da versão anterior.
- **Não é cookie.** Cookie `HttpOnly` exige o backend emitir e proteger contra CSRF — pedido em
  `BACKEND_CHANGES.md`, débito DT-17. Enquanto o token viver em JS, XSS o lê; `sessionStorage`
  encurta a janela, não a fecha.

Duas funções de limpeza, com papéis diferentes:

- `clearStoredTokens(userId)` — apaga só os tokens de um usuário e o `currentUserId`.
- `clearAllStoredTokens()` — apaga **todo** token de **todo** usuário (e o resquício em
  `localStorage`), mais o `currentUserId`, e avisa os assinantes. É o que `logout` e a falha de
  refresh usam: sair não pode deixar token de ninguém para trás.

Toda escrita/limpeza chama `notifySessionChange()`: o `HubProvider` assina (`onSessionChange`) e
reabre a conexão com o token novo — ou a derruba, no logout. `useAuth` também assina e relê o storage.

## Interceptor de request

```ts
instance.interceptors.request.use((config) => {
  const token = getCurrentToken();            // sessionStorage.currentUserId → accessToken{id}
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
```

- Aplicado por `createApi()`; a instância exportada `httpClient`/`api` já vem com ele.
- **Sem token, o request sai sem header** — nenhum erro local. O sintoma é 401 do servidor.
- `config.headers.set(...)` é a API do axios 1.x (`AxiosHeaders`). Não faça
  `config.headers['Authorization'] = ...`.
- `timeout: 10_000` em toda requisição.

## Interceptor de response — refresh automático (single-flight)

```
request → 401 ?
  ├─ endpoint é login / register / refresh-token → propaga (401 ali é resposta de negócio)
  ├─ já foi repetida uma vez (_retried)          → propaga (não é expiração)
  └─ senão → refreshSession()
        ├─ sucesso → setStoredTokens(userId, novoAccess, novoRefresh)   ← OS DOIS (rotação)
        │           → repete a request original com o Bearer novo
        └─ falha (sem refresh token, success:false, rede, 429, 5xx)
                    → clearAllStoredTokens() + onSessionLost()  (default: window.location.assign('/'))
                    → propaga o erro original
```

- **Single-flight:** `refreshInFlight` é uma promise compartilhada **no módulo**. N requisições que
  levam 401 ao mesmo tempo geram **uma** rotação; as outras esperam o mesmo resultado. Sem isso, a
  primeira rotação revogaria o refresh token que a segunda ia usar e a sessão cairia na hora de
  ser renovada.
- A chamada de refresh sai por uma instância axios **sem** interceptors (`axios.create` interno):
  se ela levasse 401, o interceptor tentaria renovar de novo, em loop.
- `onSessionLost` é injetável: `createApi(baseURL, { onSessionLost })`. O default,
  `redirectToLogin`, recarrega em `/` — recarregar zera todo estado em memória, inclusive o hub. Em
  teste, passe um `vi.fn()`.
- Exportado também `refreshSession({ userId })`, que `useAuth` usa para a **renovação proativa**:
  token expirado com refresh disponível ao montar a tela dispara a renovação antes de qualquer
  chamada. Enquanto corre, `useAuth.refreshing === true` e `RequireAuth` não redireciona.
- `httpStatusOf(err)` devolve o status de um erro axios (ou `undefined`). É a forma de um componente
  perguntar "foi 429?" sem importar `axios`.

## `useAuth`

```ts
const { token, refreshToken, decoded, isValid, refreshing, setTokens, logout } = useAuth(userId);
```

- `userId` vem da rota (`useParams`), não do storage. Em `Login`, o hook é chamado com `undefined`
  (ainda não há usuário) só para obter `setTokens`.
- **O `:id` da rota não é confiável por si só.** `useAuth` classifica o storage em três estados:
  `none` (sem token para o id, **ou** token cujo `sub` é outro usuário), `expired` (token do
  usuário certo, vencido, com refresh token) e `valid`. Só em `valid` grava
  `sessionStorage.currentUserId = userId`. Antes qualquer `:id` era gravado como corrente, e
  trocar o id na URL herdava a sessão da aba.
- Reage a `[userId]` e a `onSessionChange`: trocar de usuário na URL, logar em outra tela, o
  interceptor renovar ou o logout limpar — tudo relê o storage.
- `decoded` é recalculado **a cada render** (`decodeToken(token)`), sem memo. Não use `decoded`
  como dependência de `useEffect` sem `useMemo` — use `decoded?.sub`.
- `isValid` = token existe, `sub === userId` e `exp * 1000 > Date.now()`. Avaliado no render.
- `decodeToken` engole erro e devolve `null` — token corrompido é tratado como ausência de sessão.
- `logout(userId)` chama `clearAllStoredTokens()`. O parâmetro é mantido pela assinatura histórica
  e por legibilidade; **não** restringe a limpeza.
- `readSessionToken(userId)` (exportado) é a versão validada de `readToken` (bruta): use a primeira
  para saber se há sessão utilizável.

## `RequireAuth` — rotas protegidas

`App.tsx` envolve `/chess-lobby/:id` e `/chess-board/:roomName/:id`:

```tsx
<Route path="/chess-lobby/:id" element={<RequireAuth><ChessLobby /></RequireAuth>} />
```

- Lê o `:id` via `useParams`, chama `useAuth(id)`: `isValid` → renderiza o filho; `refreshing` →
  `null` (renovação em curso); senão → `<Navigate to="/" replace />`.
- **Não é autorização.** Um token forjado passa aqui e é recusado pelo servidor. A guarda evita
  mostrar uma tela que vai quebrar — e impede herdar sessão trocando o id da URL.
- Tela autenticada nova: colocar dentro de `RequireAuth`, sem repetir a checagem à mão.
- Os testes de `ChessLobby`/`ChessBoard` montam o componente direto (sem `App`), então não passam
  pela guarda — o que se testa lá é a tela. `RequireAuth.test.tsx` cobre a decisão.

## Fluxo de login

`Login.handleLogin`:

1. `userApi.login({ email, password })`;
2. recusa se `!success || !accessToken || !userId` → exibe `response.message`;
3. se `mustChangePassword` → exibe aviso e **para** (não há tela de troca de senha);
4. `setTokens(userId, accessToken, refreshToken)`;
5. `navigate('/chess-lobby/{userId}')` (com `encodeURIComponent`).

Exceção de transporte: **429** (limite de tentativas do backend em `/login`, `/register`,
`/refresh-token`, `/users/change-password`) exibe "Muitas tentativas. Aguarde um minuto e tente
novamente."; qualquer outra cai no texto genérico. Detecção por `httpStatusOf(err) === 429`.

Cadastro: senha de **8 a 128** caracteres conferida antes de enviar (mensagem em português; o input
também leva `minLength`/`maxLength`). O servidor confere de novo.

O `userId` é um **Guid** e vai na URL de todas as rotas autenticadas. `userApi.getUser` só aceita
Guid (`isGuid`) e codifica o segmento. O backend responde 404 para id que não é o próprio (exceto
Admin), exige `Guid.TryParse` no refresh, e os endpoints de validação comparam o `userId` do corpo
com o claim `sub` — divergência é **403**.

Login com credencial errada devolve `success: false` e sempre a mesma mensagem
(`"Invalid credentials"`), tanto para usuário inexistente quanto para senha errada. Isso é correto
contra enumeração de usuário — não "melhore" a mensagem.

## Botão "Sair" e "Sair da partida"

- **"Sair" (lobby)** = logout real: `logout(id)` **antes** de `navigate('/')`. Limpa tudo, o hub cai.
- **"Sair da partida" / "Voltar ao lobby" (tabuleiro)** = **não** é logout. Chama
  `useChessGame.leaveRoom()` (`LeaveRoom` no hub + `clearGameSession(room)`) e navega ao lobby. A
  sessão continua.

## Claims do JWT — o que existe de verdade

O backend emite `sub`, `email`, `name`, `jti` e o papel via `ClaimTypes.Role`, que no payload
aparece na chave longa `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`. Desde
2026-09-23 o hub usa o claim `name` como nome do jogador em `JoinRoom` (o parâmetro `playerName`
continua sendo enviado, por contrato).

⚠️ `DecodedToken` em `src/types/auth.ts` declara `emailAddress` e `role`: **os dois são sempre
`undefined`** (DT-04). E o papel, quando lido corretamente, é permissão
(`"jogador"`, `"jogador principal"`, `"lider de time"`, `"adm"`, `"super adm"`) — **nunca cor de
peça**.

**Nunca derive a cor do jogador do JWT.** A cor vem de `JoinRoomResponse.color` e de
`PlayerJoined`. Ver skill `tabuleiro-e-jogada`.

## Refresh token — fatos do backend

- a rota é `POST /refresh-token`, anônima, corpo `{ userId, refreshToken }`;
- o refresh é **rotativo**: cada uso invalida o anterior e devolve um par novo. É obrigatório
  gravar **os dois** tokens (`setStoredTokens(userId, accessToken, refreshToken)`);
- reusar um refresh já rotacionado devolve `success: false` — não há detecção de replay nem alerta;
- não há revogação de access token: o antigo continua válido até expirar (60 min hoje; pedido de 15
  min em `BACKEND_CHANGES.md`);
- responde **429** em excesso de tentativas — o interceptor trata como falha e encerra a sessão.

## Regras de segurança (Princípio VI)

- Token, refresh token e senha **nunca** em `console.log`, em mensagem exibida ou em atributo do
  DOM. O `console.error` do `HubProvider` loga o erro do `start()`, não o token — mantenha assim.
- REST usa header. A única exceção de query string é o `accessTokenFactory` do handshake do hub.
- Nunca coloque token em rota, em `<img src>` ou em link. Toda interpolação de caminho usa
  `encodeURIComponent`.
- Nunca guarde senha em estado além do submit do formulário.
- `LogLevel.Warning` no SignalR: acima disso o cliente loga a URL de negociação com o token.
- Headers de resposta (CSP com `frame-ancestors`, HSTS etc.) são do **host** — `docs/seguranca.md`.

## Testando

- JWT de teste: `src/test-utils/jwt.ts` (`makeJwt`, `validJwtFor(sub)`, `expiredJwtFor(sub)`,
  `GUID_1`). Não importe uma biblioteca de JWT só para o teste. **O `sub` precisa bater com o
  `userId` do hook**, senão a sessão é `none`.
- `useAuth`: escreva em `sessionStorage` direto no `beforeEach`, monte com `renderHook`. Para a
  renovação proativa, sobreponha `POST /refresh-token` com MSW (`server.use`) devolvendo um JWT
  válido para o mesmo `sub`.
- `Api.ts`: `axios-mock-adapter` para o interceptor de request; **MSW** para o de response — a
  renovação sai por uma instância axios própria que o adaptador não enxerga. Passe
  `createApi(API_BASE_URL, { onSessionLost: vi.fn() })` e asserte o espião. Handlers prontos em
  `src/mocks/handlers.ts`: refresh com sucesso (default), `failedRefresh`, `rateLimitedLogin`.
- `RequireAuth`: `MemoryRouter` com a rota real e telas de mentira; asserte qual das duas apareceu.
- `Login` com 429: `mockRejectedValue(new AxiosError(..., { status: 429 }))` ou
  `server.use(rateLimitedLogin)` na integração.
- **Limpe o storage entre testes** (`localStorage.clear(); sessionStorage.clear();`).
- Detalhes das receitas: skill `estrategia-de-testes-frontend`.
