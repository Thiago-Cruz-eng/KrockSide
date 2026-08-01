import { USERS, SeedUser } from './helpers';

/**
 * Garante que os usuários da suíte existem antes do primeiro teste.
 *
 * Sem isto a suíte dependia de alguém ter seguido `docs/como-rodar-local.md` à mão, o que
 * funciona na máquina de quem escreveu e falha em qualquer outro lugar — em CI não há
 * ninguém para criar usuário nenhum, e todos os testes quebrariam no login com uma
 * mensagem que não aponta para a causa.
 *
 * Idempotente por construção: tenta o login primeiro e só cadastra quem ainda não existe.
 * Roda contra a MESMA API que os testes usam, e usa `POST /register` — o endpoint público
 * de auto-cadastro, que atribui papel `jogador` no servidor. Não há como semear um
 * administrador por aqui, e a suíte não precisa de um.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';

/** Aceita o certificado de desenvolvimento quando a API sobe em https. */
if (API_URL.startsWith('https://')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; text: string }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, text: await response.text() };
}

async function ensureUser(user: SeedUser): Promise<'existia' | 'criado'> {
  const login = await post('/login', { email: user.email, password: user.password });
  if (login.ok) return 'existia';

  const register = await post('/register', {
    name: user.name,
    email: user.email,
    password: user.password,
    passwordConfirmation: user.password,
  });

  // O cadastro pode falhar porque o e-mail já existe com OUTRA senha. Nesse caso o login
  // seguinte também falha, e é aí que vale interromper: seguir em frente só produziria 15
  // testes vermelhos sem explicação.
  const confirm = await post('/login', { email: user.email, password: user.password });
  if (!confirm.ok) {
    throw new Error(
      `Não foi possível preparar o usuário ${user.email}.\n` +
        `  register → ${register.ok ? 'ok' : register.text}\n` +
        `  login    → ${confirm.text}\n` +
        `Se o e-mail já existe com outra senha, apague-o ou ajuste E2E_PASSWORD.`,
    );
  }
  return 'criado';
}

/**
 * Espera a API atender.
 *
 * A ordem entre `webServer` e `globalSetup` é detalhe interno do Playwright, e não vale
 * apostar nela: esperar aqui deixa o setup correto nas duas ordens, e também quando a API
 * é externa (`E2E_SKIP_API_START`) e ainda está subindo.
 */
async function waitForApi(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = 'sem resposta';

  while (Date.now() < deadline) {
    try {
      // Rota anônima: 400 já prova que a API está de pé e roteando.
      const probe = await post('/login', {});
      if (probe.ok || probe.text !== undefined) return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`API não respondeu em ${API_URL} após ${timeoutMs / 1000}s (${last}).`);
}

export default async function globalSetup(): Promise<void> {
  await waitForApi();
  const users = Object.values(USERS);

  // Sequencial de propósito: cadastros simultâneos do mesmo e-mail correriam entre si, e
  // não há índice único no Mongo para barrar a duplicata (não é o que esta suíte testa).
  for (const user of users) {
    const outcome = await ensureUser(user);
    if (outcome === 'criado') console.log(`[e2e] usuário criado: ${user.email}`);
  }
}
