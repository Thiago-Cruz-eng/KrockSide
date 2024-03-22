import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserController from '../service/ComunicationApi'; // Adjust the import path as necessary
import '../styles/Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [responseMessage, setResponseMessage] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    dateBirth: new Date(),
    phoneNumber: '',
  });

  const navigate = useNavigate();

  const handleToggleForm = () => {
    setIsLogin(!isLogin);
  };

  const handleLogin = async () => {
    console.log('Autenticando...');
    try {
      const response = await UserController.loginUser({
        email: formData.email,
        password: formData.password,
      });
      if (response) {
        console.log('Login successful', response);
        let id = response.userId
        navigate(`/chess-lobby/${id}`);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async () => {
    console.log('Creating account...');
    try {
      const response = await UserController.createUser({
        userName: formData.username,
        email: formData.email,
        password: formData.password,
        passwordConfirmation: formData.password,
        dateBirth: formData.dateBirth,
        phoneNumber: formData.phoneNumber,
      });
      setResponseMessage(response.message);
      if (response.Success) {
        console.log('Account creation successful', response);
        let id = response.userId
        navigate(`/chess-lobby/${id}`);
      }
      console.log(response.message);
      setTimeout(() => {
        setResponseMessage('');
      }, 1000);
    } catch (error) {
      console.error('Account creation failed:', error);
    }
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
    console.log(isLogin ? 'Login' : 'Criar Conta', formData);

    if (isLogin) {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  const displayResponseMessage = () => {
    alert(responseMessage);
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
                    <label htmlFor="password">Confirmar Senha</label>
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
            {/*<div className="form-group">*/}
            {/*  <label htmlFor="date">Data de aniversario</label>*/}
            {/*  <input*/}
            {/*      type="text"*/}
            {/*      id="dateBirth"*/}
            {/*      name="dateBirth"*/}
            {/*      onChange={handleChange}*/}
            {/*      required*/}
            {/*  />*/}
            {/*</div>*/}
            {/*<div className="form-group">*/}
            {/*  <label htmlFor="text">Telefone</label>*/}
            {/*  <input*/}
            {/*      type="text"*/}
            {/*      id="phone"*/}
            {/*      name="number"*/}
            {/*      value={formData.phoneNumber}*/}
            {/*      onChange={handleChange}*/}
            {/*      required*/}
            {/*  />*/}
            {/*</div>*/}

            {isLogin ? (
                <button type="submit">Login</button>
            ) : (
                <button type="submit">Criar Conta</button>
            )}
          </form>
          <p onClick={handleToggleForm}>
            {isLogin ? 'Criar uma nova conta' : 'Já tem uma conta? Faça login'}
          </p>
          {responseMessage && (
            <div className="response-message-popup">
              <p>{responseMessage}</p>
            </div>
          )}
        </div>
      </div>
  );
};

export default Login;
