import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChessLobby from './ChessLobby';
import { useChessLobby } from '../hooks/useChessLobby';

/**
 * Testes de apresentação do lobby.
 *
 * O componente é casca: toda a orquestração — hub, REST, validação de sessão, atribuição de cor
 * — vive em `useChessLobby`. Então o hook é substituído e o que se verifica aqui é o que o
 * componente FAZ com o que recebe: qual botão habilita, qual texto mostra, o que chama.
 *
 * O dublê é tipado contra `ReturnType<typeof useChessLobby>` de propósito. A armadilha recorrente
 * neste projeto foi dublê que espelha o erro do código e fica verde provando nada; amarrar ao
 * tipo real faz o TypeScript reprovar quando o hook mudar de forma e este arquivo não.
 *
 * O caminho real (hub de verdade, servidor de verdade) é coberto por tests-e2e/lobby.spec.ts.
 * Estes aqui existem pela velocidade: 8 cenários em milissegundos contra ~1 min do E2E.
 */

vi.mock('../hooks/useChessLobby');

const mockedHook = vi.mocked(useChessLobby);

type LobbyState = ReturnType<typeof useChessLobby>;

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function setup(overrides: Partial<LobbyState> = {}) {
  const state: LobbyState = {
    rooms: [],
    playersByRoom: {},
    connected: true,
    errorMessage: null,
    preferredColor: '',
    setPreferredColor: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(undefined),
    joinRoom: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  mockedHook.mockReturnValue(state);

  render(
    <MemoryRouter initialEntries={['/chess-lobby/u1']}>
      <Routes>
        <Route path="/chess-lobby/:id" element={<ChessLobby />} />
      </Routes>
    </MemoryRouter>,
  );

  return state;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChessLobby', () => {
  it('sem salas, convida a criar a primeira', () => {
    setup();
    expect(screen.getByText(/Nenhuma sala aberta/i)).toBeInTheDocument();
  });

  it('sem conexão, avisa em vez de fingir que não há salas', () => {
    // Regressão: desconectado, o lobby mostrava "Nenhuma sala aberta" e o usuário não tinha
    // como distinguir "não há salas" de "não estou conectado".
    setup({ connected: false });
    expect(screen.getByTestId('hub-offline')).toBeInTheDocument();
  });

  it('sem conexão, criar sala fica desabilitado mesmo com nome preenchido', () => {
    // Regressão: o clique estourava "Hub not connected" e a única pista era um
    // "Erro ao criar sala." genérico.
    setup({ connected: false });
    fireEvent.change(screen.getByLabelText('Nome da nova sala'), { target: { value: 'sala-1' } });
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDisabled();
  });

  it('criar sala envia o nome e limpa o campo', async () => {
    const state = setup();
    const input = screen.getByLabelText('Nome da nova sala');

    fireEvent.change(input, { target: { value: 'minha-sala' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));

    await waitFor(() => expect(state.createRoom).toHaveBeenCalledWith('minha-sala'));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('nome só com espaço não cria nada', () => {
    const state = setup();
    fireEvent.change(screen.getByLabelText('Nome da nova sala'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Criar sala' })).toBeDisabled();
    expect(state.createRoom).not.toHaveBeenCalled();
  });

  it('escolher cor marca o botão como pressionado', () => {
    const state = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pretas' }));
    expect(state.setPreferredColor).toHaveBeenCalledWith('Black');
  });

  it('a cor escolhida aparece pressionada para leitor de tela', () => {
    setup({ preferredColor: 'White' });
    expect(screen.getByRole('button', { name: 'Brancas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pretas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('lista a sala com a contagem e o estado vazio', () => {
    setup({ rooms: ['sala-a'], playersByRoom: { 'sala-a': [] } });
    expect(screen.getByText('sala-a')).toBeInTheDocument();
    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText(/Sala vazia/i)).toBeInTheDocument();
  });

  it('mostra os jogadores presentes em vez do estado vazio', () => {
    setup({
      rooms: ['sala-a'],
      playersByRoom: { 'sala-a': [{ name: 'Ana', color: 'White' }] },
    });
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText(/Sala vazia/i)).not.toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  // Cada motivo de bloqueio tem seu próprio texto: botão desabilitado sem explicação é o que faz
  // o usuário clicar de novo achando que a página travou. Um teste por motivo — antes eram dois
  // renders no mesmo teste, o que exigia desmontar no meio e quebrava o React.
  it('sem conexão, o botão de entrar diz que está conectando', () => {
    setup({
      rooms: ['sala-a'],
      playersByRoom: { 'sala-a': [] },
      connected: false,
      preferredColor: '',
    });
    expect(screen.getByRole('button', { name: /Conectando/i })).toBeDisabled();
  });

  it('sem cor escolhida, o botão de entrar pede a cor', () => {
    setup({
      rooms: ['sala-a'],
      playersByRoom: { 'sala-a': [] },
      connected: true,
      preferredColor: '',
    });
    expect(screen.getByRole('button', { name: /Escolha uma cor/i })).toBeDisabled();
  });

  it('sala cheia não é clicável', () => {
    setup({
      rooms: ['cheia'],
      preferredColor: 'White',
      playersByRoom: {
        cheia: [
          { name: 'Ana', color: 'White' },
          { name: 'Bia', color: 'Black' },
        ],
      },
    });
    expect(screen.getByRole('button', { name: /Sala cheia/i })).toBeDisabled();
  });

  it('entrar navega para a rota que o hook devolveu', async () => {
    const state = setup({
      rooms: ['sala-a'],
      preferredColor: 'White',
      playersByRoom: { 'sala-a': [] },
      joinRoom: vi.fn().mockResolvedValue('/chess-board/u1/sala-a'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));

    await waitFor(() => expect(state.joinRoom).toHaveBeenCalledWith('sala-a'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/chess-board/u1/sala-a'));
  });

  it('entrar sem rota de volta não navega', async () => {
    // O hook devolve null quando o servidor recusou. Navegar assim mesmo levaria a uma tela de
    // partida que não existe.
    const state = setup({
      rooms: ['sala-a'],
      preferredColor: 'White',
      playersByRoom: { 'sala-a': [] },
      joinRoom: vi.fn().mockResolvedValue(null),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));

    await waitFor(() => expect(state.joinRoom).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('mostra o erro que o hook reportou', () => {
    setup({ errorMessage: 'Sala já existe.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Sala já existe.');
  });

  it('sair volta para a raiz', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
