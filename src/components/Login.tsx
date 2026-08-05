import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import userApi from '../service/userApi';
import { useAuth } from '../hooks/useAuth';

/**
 * Os campos do formulário.
 *
 * São exatamente os quatro que são enviados — nada de campo em estado que o backend não conheça.
 * Antes havia `dateBirth` e `phoneNumber` aqui, sem input na tela, mandados com valor default para um
 * servidor que os ignorava: era a DT-14.
 */
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

/**
 * Tela de entrada: login e cadastro no mesmo formulário, alternados por `isLogin`.
 *
 * Um componente para as duas coisas porque os campos se sobrepõem — cadastro é login mais confirmação
 * de senha e nome. Os campos extras são montados condicionalmente, e não apenas escondidos por CSS.
 *
 * **É a única tela que não exige sessão**, por definição: é ela que a cria. Ao terminar, grava os
 * tokens via `useAuth` e navega para o lobby com o `userId` na rota.
 */
const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Trava o botão durante o envio, para não disparar duas vezes com duplo clique. */
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>(initialForm);
  const navigate = useNavigate();

  // `useAuth(undefined)`: nesta tela ainda não existe usuário — é o login que vai descobrir qual é.
  // O hook é usado apenas por `setTokens`, e não para ler sessão nenhuma.
  const { setTokens } = useAuth(undefined);

  const handleToggleForm = () => {
    setIsLogin((v) => !v);
    // Limpa o erro ao trocar de modo: "senha incorreta" não faz sentido depois de virar cadastro.
    setErrorMessage(null);
  };

  /**
   * Um handler para todos os inputs, indexado pelo atributo `name`.
   *
   * Por isso o `name` de cada input **tem de bater com a chave** em `FormData`: a ligação é por
   * texto, e o TypeScript não a verifica. Errar o `name` faz o campo simplesmente não atualizar.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Autentica e entra no lobby.
   *
   * A ordem das checagens importa: campos obrigatórios ausentes na resposta são tratados **antes** de
   * `mustChangePassword`, porque sem token não há sessão a proteger de todo modo.
   */
  const handleLogin = async () => {
    try {
      const response = await userApi.login({
        email: formData.email,
        password: formData.password,
      });

      // A mensagem do servidor vem primeiro; o texto local é só o fallback. O servidor responde
      // "Invalid credentials" tanto para e-mail inexistente quanto para senha errada, de propósito —
      // distinguir os dois contaria a quem tenta adivinhar quais contas existem.
      if (!response.success || !response.accessToken || !response.userId) {
        setErrorMessage(response.message || 'E-mail ou senha incorretos');
        return;
      }

      // Senha definida por outra pessoa: o acesso é barrado aqui, na interface, sem guardar sessão.
      // O backend ainda não tem tela de troca obrigatória, então a saída é falar com o administrador.
      if (response.mustChangePassword) {
        setErrorMessage('Você precisa trocar sua senha. Contate o administrador.');
        return;
      }

      // Gravar antes de navegar: `setTokens` também avisa o HubProvider, que reabre a conexão agora
      // autenticada. Navegar primeiro faria o lobby montar sem token e mostrar sala nenhuma.
      setTokens(response.userId, response.accessToken, response.refreshToken);
      navigate(`/chess-lobby/${response.userId}`);
    } catch {
      // Só cai aqui em falha de rede ou status de erro — regra de negócio vem como `success: false`.
      setErrorMessage('Falha ao fazer login. Tente novamente.');
    }
  };

  /**
   * Cria a conta e entra direto no lobby.
   *
   * A conferência de senha acontece **aqui**, antes de qualquer chamada: é erro de digitação, e ir à
   * rede para descobrir isso seria desperdício. O servidor também confere (`[Compare]` no DTO), então
   * esta checagem é conveniência, não a garantia.
   */
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

  /**
   * Despacha para login ou cadastro conforme o modo, cuidando do que é comum aos dois: impedir o
   * recarregamento da página, limpar o erro anterior e travar o botão.
   *
   * O `finally` é o ponto importante: sem ele, um caminho que sai por `return` — senha divergente,
   * credencial inválida — deixaria `submitting` em `true` para sempre, e o botão nunca voltaria a
   * funcionar.
   */
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
