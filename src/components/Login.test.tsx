import React from 'react';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';
import userApi from '../service/userApi';

vi.mock('../service/userApi', () => ({
  __esModule: true,
  default: {
    login: vi.fn(),
    createUser: vi.fn(),
    register: vi.fn(),
  },
}));

const mockedLogin = userApi.login as Mock<typeof userApi.login>;
const mockedRegister = userApi.register as Mock<typeof userApi.register>;

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders login form by default', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /Login/i })).toBeInTheDocument();
  });

  it('shows error when login returns success=false', async () => {
    mockedLogin.mockResolvedValue({
      success: false,
      mustChangePassword: false,
      message: 'invalid',
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid|incorretos/i);
    });
  });

  it('stores tokens on successful login', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      accessToken: 'jwt',
      refreshToken: 'r',
      expiresAt: '2027-01-01T00:00:00Z',
      email: 'a@b.com',
      userId: 'guid-1',
      role: 'Player',
      mustChangePassword: false,
      message: 'ok',
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));
    await waitFor(() => {
      expect(localStorage.getItem('accessTokenguid-1')).toBe('jwt');
      expect(localStorage.getItem('refreshTokenguid-1')).toBe('r');
    });
  });

  it('blocks login when mustChangePassword=true', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      accessToken: 'jwt',
      userId: 'g',
      mustChangePassword: true,
      message: 'change password',
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/trocar sua senha/i);
    });
    expect(localStorage.getItem('accessTokeng')).toBeNull();
  });

  it('validates password confirmation on register', async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/Criar uma nova conta/i));
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'pw1');
    await userEvent.type(screen.getByLabelText(/Confirmar Senha/i), 'pw2');
    await userEvent.type(screen.getByLabelText(/Nome de Usuário/i), 'thiago');
    await userEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/coincidem/i);
    expect(mockedRegister).not.toHaveBeenCalled();
  });
});
