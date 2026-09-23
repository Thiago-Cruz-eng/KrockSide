# Segurança — o que o front faz e o que o host precisa fazer

Documento vivo. Resultado do hardening pré-produção de 2026-09-23 (auditoria OWASP do front). Divide
o assunto em três partes: o que **já está no código**, o que **só funciona como header HTTP do host**
que serve o build, e o **checklist** de quem vai publicar.

Fonte de verdade do modelo de sessão: skill
[`autenticacao-e-sessao`](../.agents/skills/autenticacao-e-sessao/SKILL.md). Débito relacionado:
[`debito-tecnico.md`](./debito-tecnico.md) (DT-17 a DT-19).

## 1. O que está no código

| Área | Implementação | Onde |
|---|---|---|
| Storage de token | `sessionStorage` por aba, chaves `accessToken{userId}` / `refreshToken{userId}`; morre ao fechar a aba, sobrevive a F5 | `src/service/Api.ts` |
| Logout | `clearAllStoredTokens()` apaga todo token de todo usuário (inclusive resquício em `localStorage`) e avisa o `HubProvider`, que derruba a conexão | `Api.ts`, `useAuth.logout`, botão "Sair" do lobby |
| Sessão vs. `:id` da rota | `useAuth` só aceita o `:id` se há token para ele, `sub === id` e não expirou. Trocar o id na URL não herda sessão | `src/hooks/useAuth.ts` |
| Guarda de rota | `<RequireAuth>` em `/chess-lobby/:id` e `/chess-board/:roomName/:id`; sem sessão → `Navigate` para `/` | `src/components/RequireAuth.tsx`, `App.tsx` |
| Refresh automático | Interceptor de resposta: 401 → **um** refresh (single-flight) → regrava os dois tokens → repete a requisição. Falha → `clearAllStoredTokens()` + volta ao login. Nunca para `login`/`register`/`refresh-token` | `Api.ts` (`refreshSession`) |
| Refresh proativo | Token expirado com refresh disponível ao abrir a tela dispara a renovação antes de qualquer chamada | `useAuth` |
| Rate limit | 429 em login/cadastro exibe "Muitas tentativas. Aguarde um minuto e tente novamente." | `Login.tsx` |
| Senha | 8 a 128 caracteres conferidos no cadastro (o servidor também confere) | `Login.tsx` |
| Nome de sala | `^[\p{L}\p{N} _-]{1,64}$` (flag `u`) conferido antes de `CreateRoom`; recusa do servidor (`success:false`) exibida como veio | `types/chess.ts`, `useChessLobby` |
| URLs | `getUser` só aceita GUID; toda interpolação de caminho usa `encodeURIComponent`; rota do tabuleiro codifica o nome da sala | `userApi.ts`, `useChessLobby`, `ChessBoard` |
| Timeout | `timeout: 10_000` em toda requisição REST | `Api.ts` |
| Sourcemap | `sourcemap: 'hidden'` — `.map` gerado sem `sourceMappingURL` no bundle | `vite.config.ts` |
| CSP | Meta tag injetada **só no build de produção** (plugin `krockside:csp`) | `vite.config.ts` |
| Rastreadores | `robots.txt` com `Disallow: /`; `manifest.json` sem nomes do CRA | `public/` |
| Dependências | `npm audit --omit=dev --audit-level=high` **bloqueante** no CI, além do passo informativo completo | `.github/workflows/ci.yml` |

### O que **não** está no código, e por quê

- **Cookie `HttpOnly; Secure; SameSite` para o token.** Exige o backend emitir o cookie e proteger
  contra CSRF; enquanto o token viver em JS, um XSS o lê. Pedido em
  [`BACKEND_CHANGES.md`](../BACKEND_CHANGES.md) (2026-09-23). Até lá, `sessionStorage` é o menor
  mal disponível ao front sozinho.
- **Headers de resposta.** Ver a seção 2: uma meta tag não consegue emiti-los.

## 2. Headers HTTP — responsabilidade do host

A meta tag `Content-Security-Policy` do build cobre o que uma meta tag consegue. **Ela não
consegue**: `frame-ancestors` (ignorada em meta por especificação — proteção contra clickjacking só
vem por header), `report-uri`/`report-to`, e nenhum dos outros headers abaixo. Todos precisam ser
configurados **no servidor que entrega o `build/`**.

| Header | Valor recomendado | Para quê |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://API_HOST wss://API_HOST; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | Mesma política do build, **mais** `frame-ancestors` e com o host real da API no lugar de `https: wss:`. Quando o header existe, ele prevalece sobre a meta tag (o navegador aplica a interseção das duas) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Força HTTPS após a primeira visita. Só em domínio servido exclusivamente por HTTPS |
| `X-Frame-Options` | `DENY` | Clickjacking em navegadores que não entendem `frame-ancestors` |
| `X-Content-Type-Options` | `nosniff` | Impede o navegador de "adivinhar" tipo de conteúdo |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Não vaza o caminho (com o `userId`) para terceiros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | O app não usa nenhum; nega por padrão |
| `Cache-Control` (para `index.html`) | `no-store` | Um `index.html` cacheado aponta para bundles que já não existem após um deploy |

### Exemplo — nginx

```nginx
server {
    listen 443 ssl http2;
    server_name app.exemplo.com;
    root /var/www/krockside/build;

    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.exemplo.com wss://api.exemplo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    # SPA: toda rota desconhecida cai no index.html, que não deve ser cacheado.
    location / {
        try_files $uri /index.html;
    }
    location = /index.html {
        add_header Cache-Control "no-store" always;
    }
    # Bundles têm hash no nome: cache longo é seguro.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }
    # Nunca sirva os source maps publicamente.
    location ~* \.map$ {
        return 404;
    }
}
```

### Exemplo — Azure Static Web Apps (`staticwebapp.config.json`)

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.png", "/*.ico", "/manifest.json", "/robots.txt"]
  },
  "globalHeaders": {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.exemplo.com wss://api.exemplo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
  },
  "routes": [
    { "route": "/*.map", "statusCode": 404 },
    { "route": "/index.html", "headers": { "Cache-Control": "no-store" } }
  ]
}
```

O arquivo vai na raiz do `build/` (ou configure `output_location` para a pasta que o contém).

## 3. Checklist de produção

- [ ] **Variáveis `VITE_*` do ambiente de produção** definidas no build: `VITE_API_BASE_URL` e
      `VITE_HUB_URL` apontando para `https://` e `wss://` reais. Elas são embutidas no bundle em
      tempo de build — não existe `.env` em runtime.
- [ ] **`connect-src` com o host real** da API (e `wss://` do hub) no header do host, no lugar do
      `https: wss:` genérico da meta tag.
- [ ] **Todos os headers da seção 2** configurados e verificados (por exemplo com
      `curl -I https://app.exemplo.com`).
- [ ] **Source maps fora do host público.** `sourcemap: 'hidden'` gera os `.map`; não os publique
      junto com o `build/`, ou bloqueie `*.map` como nos exemplos.
- [ ] **`LogLevel` do SignalR em `Warning`** (`useHubConnection.tsx`, `configureLogging`). Não subir
      para `Information`/`Debug` em produção: o cliente passa a logar a URL de negociação, que
      carrega o `access_token` na query string.
- [ ] **Sem `console.log` de token, refresh token ou senha** (Princípio VI). O `console.error` do
      `HubProvider` loga o erro do `start()`, não o token — mantenha assim.
- [ ] **Política de dependências:** `npm audit --omit=dev --audit-level=high` passa (o CI bloqueia
      se não). Advisory que só se resolve com major é decisão humana registrada em
      `docs/debito-tecnico.md`, nunca silenciada no workflow.
- [ ] **Certificado válido** na API: o handshake do hub falha sem mensagem clara com certificado
      autoassinado, e `NODE_TLS_REJECT_UNAUTHORIZED=0` não é resposta em produção.
- [ ] **Rate limit do backend ativo** em `/login`, `/register`, `/refresh-token` e
      `/users/change-password`. O front já trata o 429; sem o limite do lado de lá o tratamento é
      decorativo.
- [ ] **Backend com `GET /users/{id}` restrito ao próprio usuário** (404 para outros ids). O front
      só busca o próprio id, mas a garantia é do servidor.

## Histórico

- **2026-09-23** — criação, junto com o hardening (sessionStorage, logout total, refresh
  single-flight, `RequireAuth`, CSP de build, `sourcemap: 'hidden'`, audit bloqueante).
