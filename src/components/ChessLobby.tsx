import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HubConnectionState } from '@microsoft/signalr';
import '../styles/ChessLobby.css';
import { useHubConnection } from '../hooks/useHubConnection';
import { useAuth } from '../hooks/useAuth';
import userApi from '../service/userApi';
import {
  Color,
  CreateRoomResponse,
  JoinRoomResponse,
  PlayerInRoom,
  PlayerJoinedEvent,
  PlayerLeftEvent,
} from '../types/chess';

type LobbyColor = 'White' | 'Black' | '';

const ChessLobby: React.FC = () => {
  const { state, invoke, on } = useHubConnection();
  const { id } = useParams<{ id: string }>();
  const { decoded, isValid } = useAuth(id);
  const navigate = useNavigate();

  const [isNewGame, setIsNewGame] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);
  const [playersByRoom, setPlayersByRoom] = useState<Record<string, PlayerInRoom[]>>({});
  const [selectedColor, setSelectedColor] = useState<LobbyColor>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const result = await invoke<string[]>('GetAvailableRooms');
      setRooms(result);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }, [invoke]);

  const loadPlayersInRoom = useCallback(async () => {
    try {
      const result = await invoke<Record<string, string[]>>('GetPlayersInEachRoom');
      const grouped: Record<string, PlayerInRoom[]> = {};
      Object.entries(result).forEach(([room, players]) => {
        grouped[room] = players.map((name) => ({ name, color: 'None' as Color }));
      });
      setPlayersByRoom(grouped);
    } catch (err) {
      console.error('Error loading players:', err);
    }
  }, [invoke]);

  useEffect(() => {
    if (state !== HubConnectionState.Connected) return;
    void loadRooms();
    void loadPlayersInRoom();

    const offJoined = on('PlayerJoined', (...args) => {
      const payload = args[0] as PlayerJoinedEvent;
      setPlayersByRoom((prev) => ({
        ...prev,
        [payload.room]: payload.players,
      }));
    });
    const offLeft = on('PlayerLeft', (...args) => {
      const payload = args[0] as PlayerLeftEvent;
      setPlayersByRoom((prev) => ({
        ...prev,
        [payload.room]: payload.players,
      }));
    });
    const offStarted = on('GameStarted', () => {
      // snapshot delivered with event; navigate handled below by 2-player check or by direct push
    });
    const offRoomFull = on('RoomFull', (...args) => {
      setErrorMessage(`Sala cheia: ${args[0] as string}`);
    });
    const offRoomNotFound = on('RoomNotFound', (...args) => {
      setErrorMessage(`Sala não encontrada: ${args[0] as string}`);
    });

    return () => {
      offJoined();
      offLeft();
      offStarted();
      offRoomFull();
      offRoomNotFound();
    };
  }, [state, on, loadRooms, loadPlayersInRoom]);

  const handleJoinRoom = async (actualRoomName: string) => {
    try {
      if (!id || !decoded || !isValid) {
        setErrorMessage('Sessão inválida. Faça login novamente.');
        return;
      }
      if (!selectedColor) {
        setErrorMessage('Selecione uma cor antes de entrar.');
        return;
      }
      const user = await userApi.getUser(id);
      if (!user.userName) return;

      const verified = await userApi.verifyValidation(decoded.sub);
      if (!verified) return;

      const validation = await userApi.getValidation(decoded.sub);
      if (validation) {
        const updated = await userApi.updateValidation(validation.id, {
          pieceColor: selectedColor.toLowerCase(),
          room: actualRoomName,
          userEmail: user.email,
          userId: decoded.sub,
        });
        if (!updated) return;
      }

      const joinResult = await invoke<JoinRoomResponse>(
        'JoinRoom',
        user.userName,
        actualRoomName,
      );
      if (!joinResult.room) {
        setErrorMessage('Falha ao entrar na sala.');
        return;
      }

      const playersInRoom = await invoke<number>('GetPlayersInRoom', actualRoomName);
      if (playersInRoom === 2) {
        navigate(`/chess-board/${actualRoomName}/${id}`);
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setErrorMessage('Erro ao entrar na sala.');
    }
  };

  const createRoom = async () => {
    if (!roomName.trim()) return;
    try {
      const result = await invoke<CreateRoomResponse>('CreateRoom', roomName);
      if (result.alreadyExisted) {
        setErrorMessage('Sala já existe.');
      }
      setRooms((prev) => (prev.includes(result.room) ? prev : [...prev, result.room]));
      setIsNewGame(false);
      setRoomName('');
    } catch (err) {
      console.error('Error creating room:', err);
      setErrorMessage('Erro ao criar sala.');
    }
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
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
            />
            <button onClick={createRoom}>Criar Jogo</button>
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
                        onClick={() => handleJoinRoom(name)}
                        className="join-button"
                        disabled={players.length === 2 || !selectedColor}
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
                          onClick={() => setSelectedColor('Black')}
                          disabled={selectedColor === 'Black'}
                        >
                          Preto
                        </button>
                        <button
                          onClick={() => setSelectedColor('White')}
                          disabled={selectedColor === 'White'}
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
