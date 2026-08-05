# Backend Changes Required

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
