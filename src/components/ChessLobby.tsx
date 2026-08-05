import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/ChessLobby.css';
import { useChessLobby } from '../hooks/useChessLobby';

/**
 * Apresentação do lobby. Toda a orquestração — hub SignalR, chamadas REST, sequência de
 * validação de sessão, atribuição de cor — vive em useChessLobby.
 */
const ChessLobby: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    rooms,
    playersByRoom,
    errorMessage,
    preferredColor,
    setPreferredColor,
    createRoom,
    joinRoom,
  } = useChessLobby(id);

  const [isNewGame, setIsNewGame] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const handleCreate = async () => {
    await createRoom(newRoomName);
    setIsNewGame(false);
    setNewRoomName('');
  };

  const handleJoin = async (room: string) => {
    const route = await joinRoom(room);
    if (route) navigate(route);
  };

  return (
    <div className="ChessLobby">
      <h2>Jogos de Xadrez</h2>
      {errorMessage && <div role="alert">{errorMessage}</div>}
      <div className="lobby-container">
        <div className="lobby-options">
          <button onClick={() => setIsNewGame((v) => !v)}>
            {isNewGame ? 'Entrar em um Jogo Existente' : 'Criar Novo Jogo'}
          </button>
          <button onClick={() => navigate('/')}>Voltar para o Login</button>
        </div>
        {isNewGame ? (
          <div className="new-game-form">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name"
            />
            <button onClick={handleCreate}>Criar Jogo</button>
          </div>
        ) : (
          <div className="existing-games">
            <h3>Jogos Existentes</h3>
            {rooms.length === 0 ? (
              <p>Nenhum jogo foi criado até o momento.</p>
            ) : (
              <ul>
                {rooms.map((name) => {
                  const players = playersByRoom[name] ?? [];
                  return (
                    <li key={name}>
                      {name}
                      <button
                        onClick={() => handleJoin(name)}
                        className="join-button"
                        disabled={players.length === 2 || !preferredColor}
                      >
                        Entrar na Sala
                      </button>
                      {players.length > 0 && (
                        <div>
                          <p>Jogadores na sala:</p>
                          <ul>
                            {players.map((player) => (
                              <li key={player.name}>
                                {player.name}
                                {player.color !== 'None' ? ` (${player.color})` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="color-picker">
                        <button
                          onClick={() => setPreferredColor('Black')}
                          disabled={preferredColor === 'Black'}
                        >
                          Preto
                        </button>
                        <button
                          onClick={() => setPreferredColor('White')}
                          disabled={preferredColor === 'White'}
                        >
                          Branco
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChessLobby;
