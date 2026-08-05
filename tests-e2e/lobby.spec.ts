import { test, expect } from '@playwright/test';
import { USERS, createRoom, joinRoom, login, newRoom, roomCard, waitForHub } from './helpers';

/**
 * Lobby de ponta a ponta, contra a API e o MongoDB reais.
 *
 * A versão anterior deste arquivo mockava o backend com `page.route`, inclusive em
 * `**\/get/**` — que é justamente a rota ERRADA que o frontend chamava. O dublê espelhava o
 * bug, então o teste passava enquanto entrar em sala respondia 404 em produção. Por isso
 * aqui não há mock nenhum.
 */

test.describe('Lobby', () => {
  test('criar sala faz a sala aparecer na grade, vazia', async ({ page }) => {
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);

    const card = roomCard(page, room);
    await expect(card).toBeVisible();
    await expect(card).toContainText('0/2');
    await expect(card).toContainText(/Sala vazia/i);
  });

  test('criar sala com nome repetido avisa que já existe', async ({ page }) => {
    // Regressão: `AlreadyExisted` avaliava `created != Rooms[room]`, sempre falso, então o
    // lobby nunca avisava nada ao recriar uma sala existente e vazia.
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);

    await page.getByLabel('Nome da nova sala').fill(room);
    await page.getByRole('button', { name: 'Criar sala' }).click();

    await expect(page.getByRole('alert')).toContainText(/já existe/i);
  });

  test('entrar exige escolher cor antes', async ({ page }) => {
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);

    const join = roomCard(page, room).getByRole('button');
    await expect(join).toBeDisabled();
    await expect(join).toContainText(/Escolha uma cor/i);

    await page.getByRole('button', { name: 'Brancas', exact: true }).click();
    await expect(join).toBeEnabled();
    await expect(join).toContainText(/Entrar na sala/i);
  });

  test('o servidor honra a cor pedida quando ela está livre', async ({ page }) => {
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);
    await joinRoom(page, room, 'Pretas');

    // Pediu pretas entrando primeiro. Antes o servidor atribuía por ordem de chegada e
    // devolvia brancas sem avisar, então o jogador jogava do lado que não pediu.
    await expect(page.getByTestId('player-color')).toContainText('Black');
  });

  test('quando a cor pedida está tomada, o servidor avisa e dá a outra', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    await login(a, USERS.white);
    await createRoom(a, room);
    await joinRoom(a, room, 'Pretas');

    await login(b, USERS.black);
    await joinRoom(b, room, 'Pretas');

    await expect(b.getByTestId('player-color')).toContainText('White');

    await ctxA.close();
    await ctxB.close();
  });

  test('quem entra primeiro chega ao tabuleiro e espera o adversário', async ({ page }) => {
    // Regressão dupla: a navegação só acontecia com 2 jogadores na sala, então o primeiro
    // ficava preso no lobby; e depois de destravar isso ele via tela de erro, porque
    // StartGame recusa enquanto a sala não está cheia.
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);
    await joinRoom(page, room, 'Brancas');

    await expect(page).toHaveURL(/chess-board/);
    await expect(page.getByTestId('waiting-opponent')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a sala conta os jogadores e sai da lista quando enche', async ({ browser }) => {
    const room = newRoom();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const ctxC = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    const c = await ctxC.newPage();

    await login(a, USERS.white);
    await createRoom(a, room);
    await joinRoom(a, room, 'Brancas');

    // Com um jogador dentro, a sala aparece para quem chega e mostra a contagem.
    await login(b, USERS.black);
    await expect(roomCard(b, room)).toContainText('1/2');
    await joinRoom(b, room, 'Pretas');

    // Cheia, ela deixa de ser listada: `GetAvailableRooms` filtra `!IsFull && !Finished`.
    // Um terceiro simplesmente não a vê — não há como entrar numa partida em andamento.
    await login(c, USERS.third);
    await expect(roomCard(c, room)).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });

  test('sair da partida devolve ao lobby', async ({ page }) => {
    const room = newRoom();
    await login(page, USERS.white);
    await createRoom(page, room);
    await joinRoom(page, room, 'Brancas');

    await page.getByRole('button', { name: /Sair da partida/i }).click();
    await page.waitForURL(/chess-lobby/, { timeout: 15_000 });
    await waitForHub(page);
    await expect(page.getByRole('heading', { name: /Partidas/i })).toBeVisible();
  });
});
