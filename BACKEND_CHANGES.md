# Backend Changes Required

## 2026-09-23 — contrato recebido e evolução pedida (hardening de segurança)

### Recebido do backend nesta rodada (front já compatível)

| Endpoint / método | Antes | Agora |
|---|---|---|
| `POST /login`, `/register`, `/refresh-token`, `/users/change-password` | sem limite de tentativas | **429** `{ success: false, message: "Too many requests" }` com `Retry-After` em excesso de tentativas. Front: `Login.tsx` mostra "Muitas tentativas. Aguarde um minuto e tente novamente."; o interceptor trata 429 no refresh como sessão encerrada |
| `GET /users/{id}` | qualquer id autenticado | **404** quando `id` não é o próprio usuário (exceto Admin). Front só busca o próprio id e só aceita GUID |
| `CreateRoom(room)` (hub) | `{ room, alreadyExisted }` | `{ success, message?, room, alreadyExisted }` — `success: false` para nome inválido (`^[\p{L}\p{N} _-]{1,64}$`) ou teto de salas. Front valida o nome com a mesma regex antes de enviar e exibe `message` como veio |
| `JoinRoom(playerName, room, color)` | nome vindo do parâmetro | nome vem do claim `name` do token; `playerName` continua sendo enviado (contrato mantido) |
| `POST /register` | sem regra de tamanho | senha com **8 a 128** caracteres. Front confere antes de enviar |

### Pedido ao backend — evolução futura (DT-17)

**Motivo.** O front passou a guardar o token em `sessionStorage` (era `localStorage`), a fazer
logout real e a renovar a sessão sozinho por interceptor. Isso encurta a janela de exposição mas não
tira o token do alcance de JavaScript: um XSS ainda lê `sessionStorage`. Só o backend fecha isso.

**Contrato proposto.**

1. **Access e refresh token em cookie** `Set-Cookie: ...; HttpOnly; Secure; SameSite=Strict` (ou
   `Lax` se houver redirecionamento externo no fluxo), com `Path` restrito: o refresh token só em
   `Path=/refresh-token`. As respostas de `/login`, `/register` e `/refresh-token` deixam de
   devolver os tokens no corpo (podem manter `userId`, `expiresAt`, `success`, `message`).
2. **Proteção CSRF** para os endpoints que passam a autenticar por cookie: double-submit
   (`X-CSRF-Token` header conferido contra cookie legível) ou exigência de header custom
   (`X-Requested-With`) mais `SameSite=Strict`. O front manda o header em todo request via
   interceptor.
3. **Hub `/chesshub` autenticando pelo cookie** no handshake (o navegador o envia no `negotiate` e
   no upgrade de WebSocket para a mesma origem/site). Com isso o `?access_token=` na query string
   — hoje a única exceção ao "token nunca em URL" — deixa de existir.
4. **Access token de 15 minutos** (hoje 60). Agora que o front renova sozinho (interceptor
   single-flight + renovação proativa), a janela de um token vazado pode encolher sem custo de UX.
   Refresh continua rotativo, 30 dias.
5. **CORS** com `AllowCredentials()` e origem exata (já é assim para `http://localhost:3000`).

**O que muda no front quando existir.** Remover o storage de token de `src/service/Api.ts`,
trocar o interceptor de `Authorization` por `withCredentials: true` + header CSRF, `RequireAuth`
passa a consultar um endpoint `/me` (ou o `userId` de `/refresh-token`) em vez de decodificar o
JWT, e o `accessTokenFactory` do hub sai. Registrado como DT-17 em `docs/debito-tecnico.md`.

---

## Histórico anterior

Refactor moved security-sensitive validation endpoints from `GET` (token in URL) to `POST` (token in `Authorization` header, payload in body). Backend C# must be updated to match the new contracts.

## Authorization

- All authenticated endpoints must accept `Authorization: Bearer <jwt>` header.
- `AccessToken` should no longer be read from route params or query string.
- SignalR hub `/chesshub` must validate the JWT supplied via the connection access token (configured client-side via `accessTokenFactory`).
  - In `Program.cs` / `Startup.cs`, configure JWT bearer for SignalR:
    ```csharp
    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options => {
            options.Events = new JwtBearerEvents {
            
                OnMessageReceived = ctx => {
                    var accessToken = ctx.Request.Query["access_token"];
                    var path = ctx.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chesshub")) {
                        ctx.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });
    ```

## Endpoint contracts

| Old | New |
|-----|-----|
| `GET /get-validation/{userId}/{accessToken}` | `POST /validation/verify` body `{ UserId }`, returns `{ valid: bool }` |
| `GET /get-validation/{userId}/{accessToken}` (data variant) | `POST /validation/get` body `{ UserId }`, returns `ValidationResponse` |
| `GET /update-validation/{userId}/{accessToken}/{pieceColor}/{room}` | `POST /validation/update/{id}` body `{ UserId, Room, PieceColor, UserEmail }`, returns `{ updated: bool }` |
| `GET /get-validation-can-move/{userId}/{accessToken}/{pieceColor}/{room}/{userEmail}/{day}` | `POST /validation/can-move` body `{ UserId, Room, PieceColor, UserEmail, Day }`, returns `{ canMove: bool }` |

## Rationale

- Tokens in URL leak into web-server access logs, browser history, referer headers, and proxy logs.
- POST with `Authorization` header is the OWASP-recommended pattern for credential transport.
- Body parameters are not logged by default; headers can be redacted at the proxy layer.

## Hub method names (unchanged)

Frontend still invokes: `StartGame`, `CreateRoom`, `JoinRoom`, `GetAvailableRoom`, `GetPlayersInEachRoom`, `GetPlayersInRoom`, `MakeMove`, `SendPossiblesMoves`, `GetPositionInBoard`, `GetPositionPlaced`. And listens to events: `BoardChange`, `CreateRoom`, `GameWillStart`, `PlayerJoined`.

## CORS

If using `Authorization` header, ensure CORS policy allows it:
```csharp
policy.WithOrigins("http://localhost:3000")
      .AllowAnyMethod()
      .AllowAnyHeader()
      .AllowCredentials();
```
