import React from 'react';
import type { Mock } from 'vitest';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login, { TOO_MANY_REQUESTS_MESSAGE } from './Login';
import userApi from '../service/userApi';

/** Exceção como o axios a lança para um status de erro — aqui, o 429 do limite de tentativas. */
function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: 'Too Many Requests',
    headers: { 'retry-after': '60' },
    config,
    data: { success: false, message: 'Too many requests' },
  });
}

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
    expect(screen.getByRole('heading', { name: /Entrar/i })).toBeInTheDocument();
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
      expect(sessionStorage.getItem('accessTokenguid-1')).toBe('jwt');
      expect(sessionStorage.getItem('refreshTokenguid-1')).toBe('r');
    });
    expect(localStorage.getItem('accessTokenguid-1')).toBeNull();
  });

  it('on 429 tells the user to wait instead of the generic failure text', async () => {
    mockedLogin.mockRejectedValue(httpError(429));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_MANY_REQUESTS_MESSAGE);
    expect(sessionStorage.getItem('currentUserId')).toBeNull();
  });

  it('other transport errors keep the generic message', async () => {
    mockedLogin.mockRejectedValue(httpError(500));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /Login/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Falha ao fazer login/i);
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
    expect(sessionStorage.getItem('accessTokeng')).toBeNull();
  });

  /**
   * Cadastro. O formulário tem `minLength`/`maxLength` no input e `required`, então o submit via
   * `userEvent.click` seria barrado pela validação nativa do browser antes de chegar ao handler.
   * Para exercitar a regra do componente, o formulário é submetido diretamente (`form.requestSubmit`
   * também validaria; `fireEvent.submit` não).
   */
  async function fillRegister(password: string, confirmation = password) {
    renderLogin();
    await userEvent.click(screen.getByText(/Criar uma nova conta/i));
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), password);
    await userEvent.type(screen.getByLabelText(/Confirmar Senha/i), confirmation);
    await userEvent.type(screen.getByLabelText(/Nome de Usuário/i), 'thiago');
  }

  it('validates password confirmation on register', async () => {
    await fillRegister('senha-longa-1', 'senha-longa-2');
    await userEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/coincidem/i);
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('refuses a password shorter than 8 characters before calling the API', async () => {
    await fillRegister('curta12');
    fireEvent.submit(screen.getByRole('button', { name: /Criar Conta/i }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/pelo menos 8 caracteres/i);
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('refuses a password longer than 128 characters before calling the API', async () => {
    // `maxLength` no input faz o `userEvent.type` parar em 128: para exercitar a regra do
    // componente o valor é injetado direto, como faria um script ou um navegador sem a restrição.
    await fillRegister('Xadrez@2026');
    const tooLong = 'x'.repeat(129);
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: tooLong } });
    fireEvent.change(screen.getByLabelText(/Confirmar Senha/i), { target: { value: tooLong } });
    fireEvent.submit(screen.getByRole('button', { name: /Criar Conta/i }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/no máximo 128 caracteres/i);
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('the password input carries the limits as native constraints on register only', async () => {
    renderLogin();
    const loginPassword = screen.getByLabelText(/Senha/i);
    expect(loginPassword).not.toHaveAttribute('minlength');

    await userEvent.click(screen.getByText(/Criar uma nova conta/i));
    const registerPassword = screen.getByLabelText('Senha');
    expect(registerPassword).toHaveAttribute('minlength', '8');
    expect(registerPassword).toHaveAttribute('maxlength', '128');
  });

  it('registers with a valid password and stores the session', async () => {
    mockedRegister.mockResolvedValue({
      success: true,
      message: 'created',
      userId: 'guid-2',
      accessToken: 'jwt2',
      refreshToken: 'r2',
    });
    await fillRegister('Xadrez@2026');
    await userEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    await waitFor(() => expect(sessionStorage.getItem('accessTokenguid-2')).toBe('jwt2'));
    expect(mockedRegister).toHaveBeenCalledWith({
      name: 'thiago',
      email: 'a@b.com',
      password: 'Xadrez@2026',
      passwordConfirmation: 'Xadrez@2026',
    });
  });

  it('on 429 during register shows the wait message', async () => {
    mockedRegister.mockRejectedValue(httpError(429));
    await fillRegister('Xadrez@2026');
    await userEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOO_MANY_REQUESTS_MESSAGE);
  });
});
