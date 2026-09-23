import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import RequireAuth from './RequireAuth';
import { expiredJwtFor, validJwtFor } from '../test-utils/jwt';

/**
 * Guarda de rota. Monta as rotas reais da aplicação com telas de mentira, para verificar só a
 * decisão: renderiza o filho ou manda para `/`.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div data-testid="login-screen">login</div>} />
        <Route
          path="/chess-lobby/:id"
          element={
            <RequireAuth>
              <div data-testid="protected-screen">lobby</div>
            </RequireAuth>
          }
        />
        <Route
          path="/chess-board/:roomName/:id"
          element={
            <RequireAuth>
              <div data-testid="protected-screen">board</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the child when the route id has a valid session', () => {
    sessionStorage.setItem('accessTokenu1', validJwtFor('u1'));
    renderAt('/chess-lobby/u1');

    expect(screen.getByTestId('protected-screen')).toHaveTextContent('lobby');
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
  });

  it('redirects to / when there is no token at all', () => {
    renderAt('/chess-lobby/u1');

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-screen')).not.toBeInTheDocument();
  });

  it('redirects to / when the route id is not the token owner', () => {
    // Sessão de u1 na aba, URL com o id de u2: não herda.
    sessionStorage.setItem('accessTokenu1', validJwtFor('u1'));
    sessionStorage.setItem('currentUserId', 'u1');
    renderAt('/chess-lobby/u2');

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('redirects to / when the token expired and cannot be renewed', () => {
    sessionStorage.setItem('accessTokenu1', expiredJwtFor('u1'));
    renderAt('/chess-lobby/u1');

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('guards the board route the same way', () => {
    renderAt('/chess-board/sala%20um/u1');
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();

    sessionStorage.setItem('accessTokenu1', validJwtFor('u1'));
    renderAt('/chess-board/sala%20um/u1');
    expect(screen.getByTestId('protected-screen')).toHaveTextContent('board');
  });
});
