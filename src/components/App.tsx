import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ChessLobby from './ChessLobby';
import Login from './Login';
import ChessBoard from './ChessBoard';
import RequireAuth from './RequireAuth';

/**
 * As três telas da aplicação e suas rotas.
 *
 * | Rota | Tela | O que o parâmetro carrega |
 * |---|---|---|
 * | `/` | `Login` | — |
 * | `/chess-lobby/:id` | `ChessLobby` | `id` = id do usuário |
 * | `/chess-board/:roomName/:id` | `ChessBoard` | nome da sala (URL-encoded) e id do usuário |
 *
 * **O `id` do usuário viaja na URL de propósito**, e é assim que `useAuth` sabe de qual conta ler o
 * token — o storage é por usuário. Não é credencial: id não autentica ninguém, e o token continua
 * indo por cabeçalho. Desde 2026-09-23 o `id` também não basta para abrir uma sessão: `useAuth` só
 * o aceita se houver token guardado para ele cujo `sub` seja ele mesmo.
 *
 * As duas rotas autenticadas ficam dentro de `RequireAuth`, que redireciona para `/` quando não há
 * sessão para o `:id`. Antes não havia guarda nenhuma e o tabuleiro abria sem token.
 *
 * O `Router` e o `HubProvider` ficam **acima** deste componente, em `src/index.tsx`: a conexão com o
 * hub é única para toda a aplicação e não deve ser recriada a cada troca de rota.
 */
const App: React.FC = () => (
  <div className="app">
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/chess-lobby/:id"
        element={
          <RequireAuth>
            <ChessLobby />
          </RequireAuth>
        }
      />
      <Route
        path="/chess-board/:roomName/:id"
        element={
          <RequireAuth>
            <ChessBoard />
          </RequireAuth>
        }
      />
    </Routes>
  </div>
);

export default App;
