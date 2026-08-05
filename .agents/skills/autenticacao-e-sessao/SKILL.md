---
name: autenticacao-e-sessao
description: >
  Autenticação e sessão do KrockSide: login por e-mail e senha, storage de token por userId em
  localStorage mais sessionStorage.currentUserId, interceptor de Authorization no axios,
  useAuth com decodeToken e isTokenValid, refresh rotativo implementado e não usado, e os claims
  que o JWT realmente emite. Use ao mexer em Login, useAuth, src/service/Api.ts, storage de token,
  rota protegida, expiração de sessão, ou ao investigar 401, 403 e usuário deslogado do nada.
metadata:
  type: technical-skill
---

# Autenticação e sessão

> **Mantendo esta skill**
>
> Atualize quando o modelo de token ou de storage mudar. Refactor que preserve o comportamento não
> exige mudança.

## Visão geral do padrão

Token por usuário no `localStorage`, usuário corrente no `sessionStorage`, e um único ponto de
leitura.

```
src/service/Api.ts        ÚNICO dono do storage de token + instância axios + interceptor
src/hooks/useAuth.ts      estado de sessão em React: token, decoded, isValid, setTokens, logout
src/types/auth.ts         DTOs de login/refresh/cadastro/validação + DecodedToken
src/components/Login.tsx  formulário único que alterna login e cadastro
```

**Regra de ouro:** nenhum arquivo fora de `src/service/Api.ts` lê ou escreve token direto em
`localStorage`/`sessionStorage`. Use `getStoredToken`, `getStoredRefreshToken`, `setStoredTokens`,
`clearStoredTokens` — ou o `useAuth`, que os encapsula.

## Storage: por que é por usuário

```ts
const ACCESS_TOKEN_KEY  = (userId: string) => `accessToken${userId}`;
const REFRESH_TOKEN_KEY = (userId: string) => `refreshToken${userId}`;
sessionStorage.setItem('currentUserId', userId);   // quem o interceptor deve usar
```

- `localStorage.accessToken{userId}` e `refreshToken{userId}` — **persistem** entre abas e sessões.
- `sessionStorage.currentUserId` — **por aba**. É isso que permite dois jogadores no mesmo browser,
  em abas diferentes, cada um com a própria sessão. Chave global (`"token"`) quebraria exatamente o
  cenário principal de teste deste jogo: duas abas jogando entre si.
- `clearStoredTokens(userId)` remove os dois tokens **e** o `currentUserId`.

Consequência: `logout` de um usuário não afeta o token do outro no `localStorage` — apenas limpa o
`currentUserId` da aba. Isso é intencional.

## Interceptor de request

```ts
instance.interceptors.request.use((config) => {
  const userId = sessionStorage.getItem('currentUserId');
  const token = getStoredToken(userId);
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
```

- Aplicado por `createApi()`; a instância exportada `api` já vem com ele.
- **Sem token, o request sai sem header** — nenhum erro local. O sintoma é 401 do servidor.
- `config.headers.set(...)` é a API do axios 1.x (`AxiosHeaders`). Não faça
  `config.headers['Authorization'] = ...`.
- **Não existe interceptor de response.** Não há retry, não há refresh automático, não há
  redirecionamento em 401. Cada chamador trata o próprio erro.

## `useAuth`

```ts
const { token, refreshToken, decoded, isValid, setTokens, logout } = useAuth(userId);
```

- `userId` vem da rota (`useParams`), não do storage. Em `Login`, o hook é chamado com `undefined`
  (ainda não há usuário) só para obter `setTokens`.
- O `useEffect` reage a `[userId]`: relê os tokens do storage e grava `currentUserId`. Trocar de
  usuário na URL troca a sessão da aba.
- `decoded` é recalculado **a cada render** (`decodeToken(token)`), sem memo. É barato, mas não é
  referência estável: não use `decoded` como dependência de `useEffect` sem `useMemo` — use
  `decoded?.sub`.
- `isValid` compara `decoded.exp * 1000 > Date.now()`. É avaliado no render, então **não** dispara
  nada quando o token expira enquanto a tela está aberta: a sessão só é reconhecida como inválida no
  próximo render. Não há timer de expiração.
- `decodeToken` engole erro e devolve `null` — token corrompido é tratado como ausência de sessão.

## Fluxo de login

`Login.handleLogin`:

1. `userApi.login({ email, password })`;
2. recusa se `!success || !accessToken || !userId` → exibe `response.message`;
3. se `mustChangePassword` → exibe aviso e **para** (não há tela de troca de senha);
4. `setTokens(userId, accessToken, refreshToken)`;
5. `navigate('/chess-lobby/{userId}')`.

O `userId` é um **Guid** e vai na URL de todas as rotas autenticadas
(`/chess-lobby/:id`, `/chess-board/:roomName/:id`). O backend exige `Guid.TryParse` no refresh, e os
endpoints de validação comparam o `userId` do corpo com o claim `sub` — divergência é **403**.

Login com credencial errada devolve `200` com `success: false` e sempre a mesma mensagem
(`"Invalid credentials"`), tanto para usuário inexistente quanto para senha errada. Isso é correto
contra enumeração de usuário — não "melhore" a mensagem.

## Claims do JWT — o que existe de verdade

O backend emite `sub`, `email`, `name`, `jti` e o papel via `ClaimTypes.Role`, que no payload
aparece na chave longa `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`.

⚠️ `DecodedToken` em `src/types/auth.ts` declara `emailAddress` e `role`: **os dois são sempre
`undefined`** (DT-04). E o papel, quando lido corretamente, é permissão
(`"jogador"`, `"jogador principal"`, `"lider de time"`, `"adm"`, `"super adm"`) — **nunca cor de
peça**.

**Nunca derive a cor do jogador do JWT.** A cor vem de `JoinRoomResponse.color` e de
`PlayerJoined`. Usar `decoded.role` para cor é exatamente o bug DT-01, que hoje bloqueia toda
jogada. Ver skill `tabuleiro-e-jogada`.

## Refresh token

`userApi.refresh({ userId, refreshToken })` está implementado e **nenhum código o chama** — não há
refresh automático nem manual. Token expira em 60 minutos e o app simplesmente começa a receber 401.

Fatos do backend que qualquer implementação de refresh precisa respeitar:

- a rota real é `POST /refresh-token`, não `POST refresh` (DT-02);
- o refresh é **rotativo**: cada uso invalida o anterior e devolve um par novo. É obrigatório
  gravar **os dois** tokens (`setTokens(userId, accessToken, refreshToken)`);
- reusar um refresh já rotacionado devolve `success: false` — não há detecção de replay nem alerta;
- não há revogação de access token: o antigo continua válido até expirar.

Se for implementar, o lugar natural é um interceptor de **response** em `createApi` que, em 401,
tente uma vez o refresh, regrave os tokens e repita o request original — com trava para não
disparar N refreshes concorrentes.

## Rotas protegidas

Não existe guarda de rota. `App.tsx` mapeia as três rotas sem verificação; cada tela decide:

- `ChessLobby` checa `!id || !decoded || !isValid` dentro de `handleJoinRoom` e exibe
  `"Sessão inválida. Faça login novamente."`;
- `ChessBoard` **não** checa nada — abrir a URL direto sem token renderiza o tabuleiro e falha nas
  chamadas do hub.

Ao adicionar tela autenticada, ou implemente um `<RequireAuth>` reutilizável, ou repita a checagem
explicitamente — não deixe a tela abrir sem sessão.

## Regras de segurança (Princípio VI)

- Token, refresh token e senha **nunca** em `console.log`, em mensagem exibida ou em atributo do
  DOM. O `console.error` do `HubProvider` loga o erro do `start()`, não o token — mantenha assim.
- REST usa header. A única exceção de query string é o `accessTokenFactory` do handshake do hub.
- Nunca coloque token em rota, em `<img src>` ou em link.
- Nunca guarde senha em estado além do submit do formulário.

## Testando

- `useAuth`: manipule `localStorage`/`sessionStorage` direto no `beforeEach`, monte com
  `renderHook`, e para o `isValid` gere um payload com `exp` no futuro/passado. Não importe uma
  biblioteca de JWT só para o teste: monte o token à mão com `btoa` de um JSON.
- `Api.ts`: `axios-mock-adapter` sobre a instância de `createApi()`; asserte o header
  `Authorization` no `config` capturado.
- `userApi`: mocke por rota e cubra o caminho de erro (`getValidation` com 404 → `null`).
- Fluxo completo: MSW em `src/integration/auth-flow.test.tsx`.
- **Limpe o storage entre testes** (`localStorage.clear(); sessionStorage.clear();`) — estado
  vazando entre casos é a causa mais comum de teste que passa sozinho e falha em suíte.
- Detalhes das receitas: skill `estrategia-de-testes-frontend`.
