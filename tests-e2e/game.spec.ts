import { test, expect } from '@playwright/test';
import {
  boardMap,
  hintedSquares,
  newRoom,
  pieceCount,
  play,
  tryPlay,
  square,
  startedGame,
  waitForHub,
} from './helpers';

/**
 * Partida completa com dois jogadores, cada um no seu contexto de navegador.
 *
 * É a suíte que exercita o caminho inteiro: navegador → WebSocket → hub → motor de regras.
 * Foi ela que expôs a corrupção do tabuleiro (34 peças, peão branco em a2, a3 e a4) que
 * nenhum teste em processo reproduzia, porque a janela de sobreposição só abre com latência
 * de rede real.
 */

test.describe('Partida', () => {
  test('começa com 32 peças na posição inicial, brancas na vez', async ({ browser }) => {
    const g = await startedGame(browser);

    expect(await pieceCount(g.white)).toBe(32);
    await expect(g.white.getByTestId('current-turn')).toContainText('White');
    await expect(g.white.getByTestId('player-color')).toContainText('White');
    await expect(g.black.getByTestId('player-color')).toContainText('Black');

    const map = await boardMap(g.white);
    expect(map['e1']).toBe('White-King');
    expect(map['d8']).toBe('Black-Queen');
    expect(map['a3']).toBeUndefined();
    expect(map['a4']).toBeUndefined();

    await g.dispose();
  });

  test('o tabuleiro é invertido para quem joga de pretas', async ({ browser }) => {
    // Era a DT-09: o grid era fixo e as pretas jogavam de cabeça para baixo.
    const g = await startedGame(browser);

    const orderOf = (page: typeof g.white) =>
      page.evaluate(() =>
        [...document.querySelectorAll('.chessboard > .square')]
          .slice(0, 8)
          .map((c) => (c as HTMLElement).dataset.algebraic),
      );

    // Brancas veem a oitava fileira primeiro; pretas veem a primeira, e da direita.
    expect(await orderOf(g.white)).toEqual(['a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8']);
    expect(await orderOf(g.black)).toEqual(['h1', 'g1', 'f1', 'e1', 'd1', 'c1', 'b1', 'a1']);

    await g.dispose();
  });

  test('selecionar peça mostra os destinos que o servidor devolveu', async ({ browser }) => {
    const g = await startedGame(browser);

    await square(g.white, 'e2').click();
    await expect(square(g.white, 'e4')).toHaveClass(/highlighted/);
    expect(await hintedSquares(g.white)).toEqual(['e3', 'e4']);

    // O cavalo salta a fileira de peões — era um dos bugs do motor.
    await square(g.white, 'g1').click();
    await expect(square(g.white, 'f3')).toHaveClass(/highlighted/);
    expect(await hintedSquares(g.white)).toEqual(['f3', 'h3']);

    await g.dispose();
  });

  test('peça trancada não oferece lance nenhum', async ({ browser }) => {
    const g = await startedGame(browser);

    await square(g.white, 'a1').click();
    expect(await hintedSquares(g.white)).toEqual([]);

    await square(g.white, 'e1').click();
    expect(await hintedSquares(g.white)).toEqual([]);

    await g.dispose();
  });

  test('um lance aparece nos dois tabuleiros e passa a vez', async ({ browser }) => {
    const g = await startedGame(browser);

    await play(g.white, 'e2', 'e4');

    for (const page of [g.white, g.black]) {
      await expect(square(page, 'e4').locator('.piece')).toBeVisible({ timeout: 15_000 });
      await expect(square(page, 'e2').locator('.piece')).toHaveCount(0);
      await expect(page.getByTestId('current-turn')).toContainText('Black');
    }

    expect(await pieceCount(g.white)).toBe(32);
    await g.dispose();
  });

  test('fora da vez, o tabuleiro não responde', async ({ browser }) => {
    const g = await startedGame(browser);

    // É a vez das brancas: as pretas não conseguem nem selecionar.
    await square(g.black, 'e7').click();
    expect(await hintedSquares(g.black)).toEqual([]);

    const before = await boardMap(g.black);
    await tryPlay(g.black, 'e7', 'e5');
    expect(await boardMap(g.black)).toEqual(before);

    await g.dispose();
  });

  test('a peça do adversário não é arrastável nem selecionável', async ({ browser }) => {
    const g = await startedGame(browser);

    // Na vez das brancas: peça branca arrastável, peça preta não.
    await expect(square(g.white, 'e2').locator('.piece')).toHaveAttribute('draggable', 'true');
    await expect(square(g.white, 'e7').locator('.piece')).toHaveAttribute('draggable', 'false');

    await square(g.white, 'e7').click();
    expect(await hintedSquares(g.white)).toEqual([]);

    await g.dispose();
  });

  test('captura remove a peça capturada dos dois tabuleiros', async ({ browser }) => {
    const g = await startedGame(browser);

    await play(g.white, 'e2', 'e4');
    await play(g.black, 'd7', 'd5');
    await expect(square(g.white, 'd5').locator('.piece')).toBeVisible({ timeout: 15_000 });

    await play(g.white, 'e4', 'd5'); // exd5

    for (const page of [g.white, g.black]) {
      await expect.poll(() => pieceCount(page), { timeout: 15_000 }).toBe(31);
    }
    expect((await boardMap(g.white))['d5']).toBe('White-Pawn');

    await g.dispose();
  });

  test('Mate do Pastor: termina em xeque-mate e trava o tabuleiro', async ({ browser }) => {
    // Sete lances, cada um com dois cliques e ida e volta por WebSocket, mais o login dos
    // dois jogadores: nao cabe no timeout padrao da suite.
    test.setTimeout(240_000);
    const g = await startedGame(browser);

    await play(g.white, 'e2', 'e4');
    await play(g.black, 'e7', 'e5');
    await play(g.white, 'd1', 'h5');
    await play(g.black, 'b8', 'c6');
    await play(g.white, 'f1', 'c4');
    await play(g.black, 'g8', 'f6');
    await play(g.white, 'h5', 'f7'); // Qxf7#

    // Vencedor e perdedor recebem o resultado, cada um com a sua mensagem.
    await expect(g.white.getByTestId('game-result')).toContainText(/você ganhou/i, {
      timeout: 20_000,
    });
    await expect(g.black.getByTestId('game-result')).toContainText(/brancas ganharam/i, {
      timeout: 20_000,
    });

    // A dama capturou o peão de f7: 31 peças.
    expect(await pieceCount(g.white)).toBe(31);
    expect((await boardMap(g.white))['f7']).toBe('White-Queen');

    // O rei preto vem marcado em xeque.
    await expect(square(g.white, 'e8')).toHaveClass(/square--check/);

    // Encerrada: o tabuleiro fica inerte nos dois lados.
    //
    // Verificado pela classe e por pointer-events, e não tentando clicar: com a partida
    // encerrada as casas deixam de receber ponteiro, então um `click` do Playwright espera
    // o elemento ficar acionável até estourar o timeout — o teste travaria por 4 minutos
    // em vez de falhar, que foi exatamente o que aconteceu ao escrever isto.
    for (const page of [g.white, g.black]) {
      const board = page.locator('.chessboard');
      await expect(board).toHaveClass(/chessboard--finished/);
      await expect(board).toHaveCSS('pointer-events', 'none');
    }

    await g.dispose();
  });

  test('recarregar no meio da partida mantém o lado e o estado', async ({ browser }) => {
    // Regressão: o SignalR reconecta com ConnectionId novo e o servidor já havia liberado o
    // assento, então toda jogada respondia "You are not in this room" com o tabuleiro
    // aparentemente normal na tela.
    const g = await startedGame(browser);

    await play(g.white, 'e2', 'e4');
    await expect(g.black.getByTestId('current-turn')).toContainText('Black', { timeout: 15_000 });

    await g.white.reload();
    await waitForHub(g.white);
    await expect(square(g.white, 'e4').locator('.piece')).toBeVisible({ timeout: 20_000 });

    // Mesmo lado, mesmo estado.
    await expect(g.white.getByTestId('player-color')).toContainText('White');
    await expect(g.white.getByTestId('current-turn')).toContainText('Black');
    expect(await pieceCount(g.white)).toBe(32);

    // E volta a jogar quando chega a vez.
    await play(g.black, 'e7', 'e5');
    await play(g.white, 'g1', 'f3');
    await expect(square(g.white, 'f3').locator('.piece')).toBeVisible({ timeout: 15_000 });

    await g.dispose();
  });

  test('o tabuleiro nunca passa de 32 peças ao longo de uma abertura', async ({ browser }) => {
    // Guarda direta da corrupção que o E2E encontrou: 34 peças, com peão branco em a2, a3
    // e a4 ao mesmo tempo. A contagem é verificada depois de cada lance, nos dois lados.
    test.setTimeout(180_000);
    const g = await startedGame(browser, newRoom('invariante'));

    const moves: Array<[string, string]> = [
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['g1', 'f3'],
      ['b8', 'c6'],
      ['f1', 'b5'],
      ['g8', 'f6'],
    ];

    for (const [i, [from, to]] of moves.entries()) {
      const mover = i % 2 === 0 ? g.white : g.black;
      await play(mover, from, to);
      for (const page of [g.white, g.black]) {
        await expect.poll(() => pieceCount(page), { timeout: 15_000 }).toBe(32);
      }
    }

    await g.dispose();
  });
});
