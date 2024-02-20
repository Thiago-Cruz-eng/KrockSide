import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleToggleForm = () => {
    setIsLogin(!isLogin);
  };

  const handleLogin = () => {
    // Adicione a lógica de autenticação aqui
    console.log('Autenticando...');

    // Se a autenticação for bem-sucedida, navegue para "/chess-lobby"
    navigate('/chess-lobby');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Aqui você pode adicionar lógica para lidar com o login ou criação de conta
    console.log(isLogin ? 'Login' : 'Criar Conta', formData);

    // Navegue para "/chess-lobby" após o login bem-sucedido
    if (isLogin) {
      handleLogin();
    }
  };

  return (
    <div className="App">
      <div className="login-container">
        <h2>{isLogin ? 'Login' : 'Criar Conta'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
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
          )}
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
          <button type="submit">Login</button>
        </form>
        <p onClick={handleToggleForm}>
          {isLogin
            ? 'Criar uma nova conta'
            : 'Já tem uma conta? Faça login'}
        </p>
      </div>
    </div>
  );
};

export default Login;
