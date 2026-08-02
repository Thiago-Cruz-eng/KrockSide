import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { USERS, createRoom, login, newRoom, play, startedGame } from './helpers';

/**
 * Acessibilidade, verificada nas telas reais.
 *
 * Existe porque o redesenho investiu trabalho concreto em acessibilidade — `role="img"` com
 * `aria-label` em português de gênero correto nas peças, `role="status"` no resultado, rótulo em
 * cada controle — e esse trabalho não tinha proteção nenhuma. A próxima pessoa que reestilizar o
 * tabuleiro derruba os rótulos e nada percebe: nenhum teste os afirma, e regressão de
 * acessibilidade é invisível a olho nu. A tela continua parecendo certa.
 *
 * É o gate mais barato da suíte porque a parte cara já está paga: navegador real, aplicação de
 * pé, usuário logado, partida em andamento. O axe roda em cima disso em segundos.
 *
 * NÃO superestime o resultado. O axe cobre o subconjunto verificável por máquina — contraste,
 * rótulo ausente, ARIA malformado, ordem de cabeçalho. Não pega ordem de foco ruim nem rótulo que
 * existe e não faz sentido. Verde aqui é guarda de regressão, não certificado de conformidade.
 */

/** WCAG 2.1 A e AA: o recorte que a maioria das políticas exige e que o axe checa bem. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  // Falha com o detalhe junto: violação de acessibilidade sem o seletor e a regra obriga quem
  // recebe o vermelho a reproduzir localmente para descobrir o que houve.
  //
  // Inclui o `failureSummary` do axe, que para contraste traz as cores de frente e fundo e a
  // razão medida contra a exigida. Sem isso o relatório diz "o botão falhou" e quem for corrigir
  // tem de adivinhar qual cor mudar e para quanto — foi o que aconteceu na primeira execução.
  const detail = results.violations
    .map(
      (v) =>
        `\n  [${v.impact}] ${v.id}: ${v.help}\n` +
        `    ${v.helpUrl}\n` +
        v.nodes
          .map(
            (n) =>
              `    → ${n.target.join(' ')}\n` +
              `      ${(n.failureSummary ?? '').split('\n').join('\n      ')}`,
          )
          .join('\n'),
    )
    .join('');

  expect(results.violations, `Violações de acessibilidade em ${context}:${detail}`).toEqual([]);
}

/**
 * Os DOIS temas, e não só um.
 *
 * O Playwright roda em tema claro por padrão; este design tem o escuro como padrão. A primeira
 * versão desta suíte varria só o claro e passaria batido por `--text-faint` a 3,60:1 no escuro —
 * exatamente o tema que a maioria dos usuários veria. Testar só o tema que o runner escolhe é
 * testar o caminho que ninguém percorre.
 */
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Acessibilidade (tema ${colorScheme === 'light' ? 'claro' : 'escuro'})`, () => {
    test.use({ colorScheme });

    test('tela de login', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
      await scan(page, 'login');
    });

    test('tela de cadastro', async ({ page }) => {
      // Locators iguais aos de auth.spec.ts, de propósito. A primeira versão inventava um
      // `link` com nome /cadastr/i e um botão /cadastrar/i — nenhum dos dois existe: a
      // alternância é um `button` "Criar uma nova conta" e o envio é "Criar Conta". O teste
      // não falhava por acessibilidade, ficava 90s esperando um elemento inexistente.
      await page.goto('/');
      await page.getByRole('button', { name: 'Criar uma nova conta' }).click();
      await expect(page.getByRole('button', { name: 'Criar Conta' })).toBeVisible();
      await scan(page, 'cadastro');
    });

    test('lobby com sala listada', async ({ page }) => {
      const room = newRoom('a11y');
      await login(page, USERS.white);
      await createRoom(page, room);
      await scan(page, 'lobby');
    });

    test('tabuleiro em partida, com lance feito e destaques ativos', async ({ browser }) => {
      // O estado mais rico da aplicação: peças rotuladas, casa selecionada, destinos destacados,
      // último lance marcado, cartões de jogador indicando a vez. É onde mais há o que quebrar.
      const g = await startedGame(browser, newRoom('a11y'));

      await play(g.white, 'e2', 'e4');
      await expect(g.black.getByTestId('current-turn')).toContainText('Black', { timeout: 15_000 });

      await scan(g.white, 'tabuleiro (brancas, após lance)');

      // Também do lado das pretas: o tabuleiro é invertido para elas, e a inversão mexe com a
      // ordem de leitura das casas.
      await scan(g.black, 'tabuleiro (pretas, invertido)');

      await g.dispose();
    });

    test('as peças expõem cor e tipo a leitor de tela', async ({ browser }) => {
      // Afirmação direta, além do axe: o axe garante que existe rótulo, não que ele diz a coisa
      // certa. Um `aria-label="peça"` em tudo passaria no axe e seria inútil.
      const g = await startedGame(browser, newRoom('a11y'));

      await expect(g.white.getByRole('img', { name: 'Dama branca' })).toHaveCount(1);
      await expect(g.white.getByRole('img', { name: 'Rei preto' })).toHaveCount(1);
      await expect(g.white.getByRole('img', { name: 'Peão branco' })).toHaveCount(8);
      await expect(g.white.getByRole('img', { name: 'Torre preta' })).toHaveCount(2);

      await g.dispose();
    });
  });
}
