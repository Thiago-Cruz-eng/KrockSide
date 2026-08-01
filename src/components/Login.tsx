import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import userApi from '../service/userApi';
import { useAuth } from '../hooks/useAuth';

interface FormData {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

const initialForm: FormData = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
};

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialForm);
  const navigate = useNavigate();
  const { setTokens } = useAuth(undefined);

  const handleToggleForm = () => {
    setIsLogin((v) => !v);
    setErrorMessage(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async () => {
    try {
      const response = await userApi.login({
        email: formData.email,
        password: formData.password,
      });
      if (!response.success || !response.accessToken || !response.userId) {
        setErrorMessage(response.message || 'E-mail ou senha incorretos');
        return;
      }
      if (response.mustChangePassword) {
        setErrorMessage('Você precisa trocar sua senha. Contate o administrador.');
        return;
      }
      setTokens(response.userId, response.accessToken, response.refreshToken);
      navigate(`/chess-lobby/${response.userId}`);
    } catch {
      setErrorMessage('Falha ao fazer login. Tente novamente.');
    }
  };

  const handleRegister = async () => {
    if (formData.password !== formData.passwordConfirmation) {
      setErrorMessage('As senhas não coincidem');
      return;
    }
    try {
      // POST /register: o servidor decide papel e autor, e devolve sessão pronta.
      //
      // Antes isto chamava POST /users enviando `dateBirth` e `phoneNumber` (que o backend
      // não conhece) e navegava para o lobby sem token nenhum em mãos — porque a resposta
      // daquele endpoint não traz token. A tela seguinte caía em "Sessão inválida".
      const response = await userApi.register({
        name: formData.username,
        email: formData.email,
        password: formData.password,
        passwordConfirmation: formData.passwordConfirmation,
      });

      if (!response.success || !response.userId || !response.accessToken) {
        setErrorMessage(response.message || 'Falha ao criar conta');
        return;
      }

      setTokens(response.userId, response.accessToken, response.refreshToken);
      navigate(`/chess-lobby/${response.userId}`);
    } catch {
      setErrorMessage('Falha ao criar conta. Tente novamente.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      if (isLogin) await handleLogin();
      else await handleRegister();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <span className="auth__logo" aria-hidden="true">
            ♞
          </span>
          <span className="auth__brand-text">
            <h2 className="auth__title">{isLogin ? 'Entrar' : 'Criar conta'}</h2>
            <span className="auth__subtitle">
              {isLogin ? 'Bem-vindo de volta ao KrockSide' : 'Comece a jogar em segundos'}
            </span>
          </span>
        </div>

        {errorMessage && (
          <div className="alert auth__error" role="alert">
            {errorMessage}
          </div>
        )}

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="field">
                <label htmlFor="passwordConfirmation">Confirmar Senha</label>
                <input
                  type="password"
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  autoComplete="new-password"
                  value={formData.passwordConfirmation}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="username">Nome de Usuário</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="nickname"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--block auth__submit"
            disabled={submitting}
          >
            {submitting ? 'Enviando…' : isLogin ? 'Login' : 'Criar Conta'}
          </button>
        </form>

        <p className="auth__toggle">
          {isLogin ? 'Não tem conta? ' : 'Já tem uma conta? '}
          <button type="button" onClick={handleToggleForm}>
            {isLogin ? 'Criar uma nova conta' : 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
