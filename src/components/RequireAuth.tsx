import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Casca de rota autenticada.
 *
 * Lê o `:id` da rota e só renderiza o filho se `useAuth` reconhece uma sessão para ele: token
 * guardado **para esse id**, cujo `sub` é esse id, e ainda no prazo. Sem isso, abrir
 * `/chess-lobby/{qualquer-coisa}` ou `/chess-board/{sala}/{id}` direto pela URL carregava a tela
 * inteira sem sessão nenhuma — o tabuleiro nem checava — e ela ia falhando chamada a chamada.
 *
 * **Não é autorização.** O servidor continua sendo quem decide o que o usuário pode fazer; isto
 * só evita mostrar uma tela que vai quebrar. Um token forjado passa aqui e é recusado lá.
 *
 * Token expirado com refresh token disponível não redireciona: `useAuth` já disparou a
 * renovação, e enquanto ela corre não há o que mostrar. Se falhar, o storage é limpo e a
 * própria renovação leva ao login.
 */
const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { id } = useParams<{ id: string }>();
  const { isValid, refreshing } = useAuth(id);

  if (isValid) return <>{children}</>;
  if (refreshing) return null;
  return <Navigate to="/" replace />;
};

export default RequireAuth;
