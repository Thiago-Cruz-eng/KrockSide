import { test, expect } from '@playwright/test';

test.describe('Lobby (mocked backend)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accessToken: 'fake-jwt',
          refreshToken: 'fake-refresh',
          expiresAt: '2027-01-01T00:00:00Z',
          userId: 'guid-1',
          email: 'a@b.com',
          role: 'Player',
          mustChangePassword: false,
          message: 'ok',
        }),
      }),
    );
    await page.route('**/get/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userName: 'thiago', email: 'a@b.com' }),
      }),
    );
  });

  test('navigates to lobby after login', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('E-mail').fill('a@b.com');
    await page.getByLabel('Senha').fill('pw');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/chess-lobby\//);
    await expect(page.getByRole('heading', { name: /Jogos de Xadrez/ })).toBeVisible();
  });
});
