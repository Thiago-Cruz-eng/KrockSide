import { test, expect } from '@playwright/test';
import { USERS, login, newRoom, waitForHub } from './helpers';

/**
 * Autenticação de ponta a ponta: navegador → API → MongoDB.
 *
 * Cobre a área onde três bloqueadores viveram: rota REST errada (`create`/`get`/`refresh`
 * apontando para endpoints inexistentes), contrato divergente (`userName` que o backend
 * nunca enviou) e o claim `sub` que nunca era encontrado no servidor.
 */

test.describe('Autenticação', () => {
  test('a tela de entrada mostra os campos e o caminho para cadastro', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
    // Só no cadastro.
    await expect(page.getByLabel('Confirmar Senha')).toHaveCount(0);
  });

  test('login com credenciais válidas entra no lobby', async ({ page }) => {
    await login(page, USERS.white);

    await expect(page).toHaveURL(/chess-lobby/);
    await expect(page.getByRole('heading', { name: /Partidas/i })).toBeVisible();
  });

  test('login com senha errada mostra erro e não navega', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('E-mail').fill(USERS.white.email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/chess-lobby/);
  });

  test('login com e-mail inexistente mostra erro', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('E-mail').fill(`ninguem-${Date.now()}@hibrygame.local`);
    await page.getByLabel('Senha', { exact: true }).fill('Xadrez@2026');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/chess-lobby/);
  });

  test('cadastro cria a conta e já entra logado', async ({ page }) => {
    // Exercita POST /register: o servidor fixa o papel em "jogador" e devolve sessão
    // pronta. Antes o cadastro chamava POST /users, recebia resposta sem token e navegava
    // para o lobby como se tivesse sessão — a tela seguinte caía em "Sessão inválida".
    const email = `e2e-${newRoom('reg')}@hibrygame.local`;
    const senha = 'Xadrez@2026';

    await page.goto('/');
    await page.getByRole('button', { name: 'Criar uma nova conta' }).click();

    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(senha);
    await page.getByLabel('Confirmar Senha').fill(senha);
    await page.getByLabel('Nome de Usuário').fill('Jogadora E2E');
    await page.getByRole('button', { name: 'Criar Conta' }).click();

    // Chegar ao lobby prova que o token da resposta foi guardado: sem ele o lobby
    // rejeitaria a sessão.
    await page.waitForURL(/chess-lobby/, { timeout: 20_000 });
    await waitForHub(page);
    await expect(page.getByRole('heading', { name: /Partidas/i })).toBeVisible();
  });

  test('cadastro com confirmação divergente é barrado antes de chamar a API', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar uma nova conta' }).click();

    await page.getByLabel('E-mail').fill(`x-${Date.now()}@hibrygame.local`);
    await page.getByLabel('Senha', { exact: true }).fill('Xadrez@2026');
    await page.getByLabel('Confirmar Senha').fill('outra-coisa');
    await page.getByLabel('Nome de Usuário').fill('Divergente');
    await page.getByRole('button', { name: 'Criar Conta' }).click();

    await expect(page.getByRole('alert')).toContainText(/coincidem/i);
    await expect(page).not.toHaveURL(/chess-lobby/);
  });

  test('cadastro com e-mail já usado mostra o erro do servidor', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar uma nova conta' }).click();

    await page.getByLabel('E-mail').fill(USERS.white.email);
    await page.getByLabel('Senha', { exact: true }).fill('Xadrez@2026');
    await page.getByLabel('Confirmar Senha').fill('Xadrez@2026');
    await page.getByLabel('Nome de Usuário').fill('Repetida');
    await page.getByRole('button', { name: 'Criar Conta' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/chess-lobby/);
  });

  test('a sessão sobrevive a recarregar a página do lobby', async ({ page }) => {
    await login(page, USERS.white);

    await page.reload();
    await waitForHub(page);

    // Ainda no lobby, com hub conectado: token e currentUserId estão no sessionStorage, que
    // sobrevive à recarga da mesma aba (e morre ao fechá-la — é o esperado desde 2026-09-23).
    await expect(page.getByRole('heading', { name: /Partidas/i })).toBeVisible();
  });

  test('sair encerra a sessão: voltar à URL do lobby leva ao login', async ({ page }) => {
    // Regressão do hardening: "Sair" só navegava e o token ficava no storage, então digitar a
    // URL do lobby de volta entrava sem senha.
    await login(page, USERS.white);
    const lobbyUrl = page.url();

    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible();

    const tokens = await page.evaluate(() =>
      Object.keys(sessionStorage).filter(
        (k) => k.startsWith('accessToken') || k.startsWith('refreshToken'),
      ),
    );
    expect(tokens).toEqual([]);

    await page.goto(lobbyUrl);
    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible();
    await expect(page).not.toHaveURL(/chess-lobby/);
  });

  test('rota autenticada sem sessão redireciona para o login', async ({ page }) => {
    // RequireAuth: antes o lobby e o tabuleiro abriam sem token e falhavam chamada a chamada.
    await page.goto('/chess-lobby/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible();
    await expect(page).not.toHaveURL(/chess-lobby/);

    await page.goto(`/chess-board/${newRoom('guard')}/00000000-0000-4000-8000-000000000000`);
    await expect(page.getByRole('heading', { name: /Entrar/i })).toBeVisible();
    await expect(page).not.toHaveURL(/chess-board/);
  });

  test('cadastro com senha curta é barrado antes de chamar a API', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar uma nova conta' }).click();

    await page.getByLabel('E-mail').fill(`curta-${Date.now()}@hibrygame.local`);
    await page.getByLabel('Senha', { exact: true }).fill('curta12');
    await page.getByLabel('Confirmar Senha').fill('curta12');
    await page.getByLabel('Nome de Usuário').fill('Senha Curta');

    // O input tem minLength=8, então o navegador barra o submit nativo. O que se verifica é
    // que a conta NÃO foi criada: continuar na tela de cadastro, sem ir ao lobby.
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page).not.toHaveURL(/chess-lobby/);
    await expect(page.getByRole('button', { name: 'Criar Conta' })).toBeVisible();
  });

  test('o hub só conecta depois do login', async ({ page }) => {
    // Regressão do bloqueador: o HubProvider monta na raiz, e a primeira negociação ia sem
    // token, levava 401 e nunca era refeita. Aqui se verifica que a negociação que conta
    // acontece com token e dá certo.
    const negotiations: number[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/chesshub/negotiate')) negotiations.push(r.status());
    });

    await login(page, USERS.white);

    expect(negotiations.length).toBeGreaterThan(0);
    expect(negotiations).toContain(200);
    expect(negotiations).not.toContain(401);
  });
});
