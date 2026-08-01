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
  dateBirth: string;
  phoneNumber: string;
}

const initialForm: FormData = {
  username: '',
  email: '',
  password: '',
  passwordConfirmation: '',
  dateBirth: '',
  phoneNumber: '',
};

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
      const response = await userApi.createUser({
        userName: formData.username,
        email: formData.email,
        password: formData.password,
        passwordConfirmation: formData.passwordConfirmation,
        dateBirth: formData.dateBirth || new Date().toISOString().slice(0, 10),
        phoneNumber: formData.phoneNumber,
      });
      if (response.success) {
        navigate(`/chess-lobby/${response.userId}`);
      } else {
        setErrorMessage(response.message || 'Falha ao criar conta');
      }
    } catch {
      setErrorMessage('Falha ao criar conta. Tente novamente.');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    if (isLogin) void handleLogin();
    else void handleRegister();
  };

  return (
    <div className="App">
      <div className="login-container">
        <h2>{isLogin ? 'Login' : 'Criar Conta'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="passwordConfirmation">Confirmar Senha</label>
                <input
                  type="password"
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  value={formData.passwordConfirmation}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="username">Nome de Usuário</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}
          <button type="submit">{isLogin ? 'Login' : 'Criar Conta'}</button>
        </form>
        <p className="toggle-form" onClick={handleToggleForm}>
          {isLogin ? 'Criar uma nova conta' : 'Já tem uma conta? Faça login'}
        </p>
        {errorMessage && (
          <div role="alert" className="response-message-popup">
            <p>{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
