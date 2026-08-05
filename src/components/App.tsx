import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ChessLobby from './ChessLobby';
import Login from './Login';
import ChessBoard from './ChessBoard';

/**
 * As três telas da aplicação e suas rotas.
 *
 * | Rota | Tela | O que o parâmetro carrega |
 * |---|---|---|
 * | `/` | `Login` | — |
 * | `/chess-lobby/:id` | `ChessLobby` | `id` = id do usuário |
 * | `/chess-board/:roomName/:id` | `ChessBoard` | nome da sala e id do usuário |
 *
 * **O `id` do usuário viaja na URL de propósito**, e é assim que `useAuth` sabe de qual conta ler o
 * token — o storage é por usuário. Não é credencial: id não autentica ninguém, e o token continua
 * indo por cabeçalho.
 *
 * **Não há rota protegida.** Abrir `/chess-lobby/{id}` sem sessão carrega a tela, e é ela que
 * descobre que não há token válido. Uma casca de rota autenticada seria o lugar natural para isso,
 * e hoje não existe.
 *
 * O `Router` e o `HubProvider` ficam **acima** deste componente, em `src/index.tsx`: a conexão com o
 * hub é única para toda a aplicação e não deve ser recriada a cada troca de rota.
 */
const App: React.FC = () => (
  <div className="app">
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/chess-lobby/:id" element={<ChessLobby />} />
      <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
    </Routes>
  </div>
);

export default App;
