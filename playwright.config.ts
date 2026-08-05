import { defineConfig, devices } from '@playwright/test';

/**
 * Suíte E2E: navegador real → Vite → API .NET → MongoDB. Sem mock em camada nenhuma.
 *
 * É a única camada que exercita as junções entre as partes, e foi ela que encontrou os
 * bloqueadores que a suíte de componentes não podia pegar: rota REST inexistente, contrato
 * de resposta divergente, claim `sub` nunca encontrado, conexão SignalR sem token, e a
 * corrupção do tabuleiro (34 peças) que só aparece com latência de rede real.
 *
 * Pré-requisito: MongoDB de pé. Os usuários são semeados por `global-setup.ts`.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5001';
const APP_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/** Caminho do repositório do backend, para a suíte subir a API sozinha. */
const BACKEND_PATH = process.env.HIBRYGAME_PATH ?? '../Hibrygame';

/** Com E2E_SKIP_API_START, a suíte assume que a API já está no ar. */
const startApi = process.env.E2E_SKIP_API_START !== 'true';

const apiServer = {
  command: `dotnet run --project ${BACKEND_PATH}/Orchestrator --no-launch-profile --urls "${API_URL}"`,
  url: `${API_URL}/swagger/index.html`,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  env: { ASPNETCORE_ENVIRONMENT: 'Development' },
};

const appServer = {
  command: 'npm start',
  url: APP_URL,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    VITE_E2E: 'true',
    // O front precisa apontar para a MESMA API que a suíte sobe.
    VITE_API_BASE_URL: `${API_URL}/`,
    VITE_HUB_URL: `${API_URL}/chesshub`,
  },
};

export default defineConfig({
  testDir: './tests-e2e',

  // Roda depois de os webServers subirem: semeia os usuários contra a API já no ar.
  globalSetup: './tests-e2e/global-setup.ts',

  // Salas têm nome único por teste, então paralelismo é seguro. Mas o estado do hub é
  // estático e compartilhado pelo processo da API: em caso de intermitência, comece
  // reduzindo os workers.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Uma partida completa envolve dois navegadores conversando por WebSocket; o padrão de
  // 30s é curto para isso.
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: startApi ? [apiServer, appServer] : [appServer],
});
