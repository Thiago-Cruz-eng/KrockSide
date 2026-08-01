import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Login/ })).toBeVisible();
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('toggles to register form', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Criar uma nova conta').click();
    await expect(page.getByRole('heading', { name: /Criar Conta/ })).toBeVisible();
    await expect(page.getByLabel('Confirmar Senha')).toBeVisible();
  });

  test('shows error when passwords do not match on register', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Criar uma nova conta').click();
    await page.getByLabel('E-mail').fill('a@b.com');
    await page.getByLabel('Senha', { exact: true }).fill('pw1');
    await page.getByLabel('Confirmar Senha').fill('pw2');
    await page.getByLabel('Nome de Usuário').fill('thiago');
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await expect(page.getByRole('alert')).toContainText(/coincidem/i);
  });
});
