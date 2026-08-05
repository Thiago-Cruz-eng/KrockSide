import { expect, Page, Browser } from '@playwright/test';

/**
 * Helpers da suíte E2E.
 *
 * Estes testes batem no sistema todo: navegador real → Vite → API .NET → MongoDB. Não há
 * mock em camada nenhuma. É a camada que pegou os quatro bloqueadores que a suíte de
 * componentes não pegava, porque todos eles viviam nas junções entre as partes.
 */

export interface SeedUser {
  name: string;
  email: string;
  password: string;
}

/**
 * Usuários da suíte, semeados por `global-setup.ts` via `POST /register`.
 *
 * Todos são `jogador` — é o único papel que o auto-cadastro atribui, e o único que a suíte
 * precisa. `third` existe para o cenário de sala cheia: alguém que chega depois e não deve
 * conseguir entrar.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Xadrez@2026';

export const USERS = {
  white: { name: 'Jogador Brancas', email: 'branca@hibrygame.local', password: PASSWORD },
  black: { name: 'Jogador Pretas', email: 'preta@hibrygame.local', password: PASSWORD },
  third: { name: 'Jogador Extra', email: 'extra@hibrygame.local', password: PASSWORD },
} as const satisfies Record<string, SeedUser>;

/** Nome de sala único por teste: o estado do hub é estático e vive todo o processo. */
export function newRoom(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Espera o hub conectar.
 *
 * A conexão SignalR só é aberta depois do login, então logo após navegar para o lobby ela
 * ainda está em curso e os controles estão desabilitados. Interagir antes disso é a corrida
 * que fazia o teste falhar de forma intermitente.
 */
export async function waitForHub(page: Page): Promise<void> {
  await expect(page.getByTestId('hub-offline')).toHaveCount(0, { timeout: 25_000 });
}

export async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL(/chess-lobby/, { timeout: 20_000 });
  await waitForHub(page);
}

/** Cartão da sala pelo nome. Sempre escopar: o lobby lista todas as salas abertas. */
export function roomCard(page: Page, room: string) {
  return page.locator('.room', { hasText: room });
}

export async function createRoom(page: Page, room: string): Promise<void> {
  await page.getByLabel('Nome da nova sala').fill(room);
  await page.getByRole('button', { name: 'Criar sala' }).click();
  await expect(roomCard(page, room)).toBeVisible({ timeout: 15_000 });
}

export async function joinRoom(
  page: Page,
  room: string,
  color: 'Brancas' | 'Pretas',
): Promise<void> {
  await page.getByRole('button', { name: color, exact: true }).click();
  await roomCard(page, room).getByRole('button', { name: 'Entrar na sala' }).click();
  await page.waitForURL(/chess-board/, { timeout: 20_000 });
}

export function square(page: Page, algebraic: string) {
  return page.locator(`[data-testid="square-${algebraic}"]`);
}

/** Quantas peças o tabuleiro mostra. A invariante mais barata de checar: sempre ≤ 32. */
export async function pieceCount(page: Page): Promise<number> {
  return page.locator('.chessboard .piece').count();
}

/** Lê a casa de cada peça no DOM, para comparar posições entre os dois jogadores. */
export async function boardMap(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.chessboard > .square')]
        .filter((c) => c.querySelector('.piece'))
        .map((c) => [
          (c as HTMLElement).dataset.algebraic!,
          (c.querySelector('.piece') as HTMLElement).dataset.piece!,
        ]),
    ),
  );
}

/**
 * Clica origem e destino. O tabuleiro aplica o lance no segundo clique.
 *
 * Espera a origem ficar marcada como selecionada antes de clicar no destino: sem isso o
 * teste depende de quando o React re-renderiza, e um lance some sem erro nenhum de vez em
 * quando. (A aplicação também foi endurecida contra isso, guardando a seleção num ref —
 * mas o teste não deve depender de velocidade de render para ser determinístico.)
 */
export async function play(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await expect(square(page, from)).toHaveClass(/square--selected/, { timeout: 10_000 });
  await square(page, to).click();
}

/**
 * Tenta o lance sem exigir que ele seja aceito.
 *
 * Para os casos em que a recusa É o comportamento esperado — fora da vez, peça do
 * adversário, partida encerrada. Nesses, a casa de origem nunca fica selecionada, então
 * `play` (que espera a seleção) falharia pelo motivo errado.
 */
export async function tryPlay(page: Page, from: string, to: string): Promise<void> {
  await square(page, from).click();
  await square(page, to).click();
}

/** Casas que o servidor devolveu como destino legal (as que têm ponto de lance). */
export async function hintedSquares(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.chessboard > .square.highlighted')]
      .map((c) => (c as HTMLElement).dataset.algebraic!)
      .sort(),
  );
}

/**
 * Uma partida pronta, com os dois jogadores em contextos separados.
 *
 * Contextos separados de propósito: `sessionStorage` é por contexto, e é lá que fica a cor
 * atribuída pelo servidor. Duas páginas no mesmo contexto compartilhariam sessão.
 */
export async function startedGame(browser: Browser, room = newRoom()) {
  const ctxWhite = await browser.newContext();
  const ctxBlack = await browser.newContext();
  const white = await ctxWhite.newPage();
  const black = await ctxBlack.newPage();

  await login(white, USERS.white);
  await createRoom(white, room);
  await joinRoom(white, room, 'Brancas');

  await login(black, USERS.black);
  await joinRoom(black, room, 'Pretas');

  // A partida começa quando o segundo entra: espera o tabuleiro dos dois ficar jogável.
  await expect(white.getByTestId('waiting-opponent')).toHaveCount(0, { timeout: 20_000 });
  await expect(square(white, 'e2').locator('.piece')).toBeVisible({ timeout: 20_000 });
  await expect(square(black, 'e7').locator('.piece')).toBeVisible({ timeout: 20_000 });

  return {
    room,
    white,
    black,
    dispose: async () => {
      await ctxWhite.close();
      await ctxBlack.close();
    },
  };
}
