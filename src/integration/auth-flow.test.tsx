import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../components/Login';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe('Auth integration (MSW)', () => {
  it('login through real axios -> MSW returns tokens and stores them', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'right');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(localStorage.getItem('accessTokenguid-1')).toBe('fake-jwt');
      expect(localStorage.getItem('refreshTokenguid-1')).toBe('fake-refresh');
    });
  });

  it('login with wrong password shows error', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid|incorretos/i);
  });
});
