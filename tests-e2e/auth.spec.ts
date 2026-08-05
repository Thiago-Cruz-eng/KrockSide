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

    // Ainda no lobby, com hub conectado: o token está no localStorage e o
    // currentUserId no sessionStorage, que sobrevivem à recarga.
    await expect(page.getByRole('heading', { name: /Partidas/i })).toBeVisible();
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
