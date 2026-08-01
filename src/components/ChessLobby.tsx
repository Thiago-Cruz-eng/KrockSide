import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/ChessLobby.css';
import { useChessLobby } from '../hooks/useChessLobby';
import { PlayerInRoom } from '../types/chess';

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
    connected,
    errorMessage,
    preferredColor,
    setPreferredColor,
    createRoom,
    joinRoom,
  } = useChessLobby(id);

  const [newRoomName, setNewRoomName] = useState('');
  const [busyRoom, setBusyRoom] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    await createRoom(newRoomName);
    setNewRoomName('');
  };

  const handleJoin = async (room: string) => {
    setBusyRoom(room);
    try {
      const route = await joinRoom(room);
      if (route) navigate(route);
    } finally {
      setBusyRoom(null);
    }
  };

  const playerChip = (player: PlayerInRoom) => (
    <span className="chip" key={player.name}>
      {player.color !== 'None' && (
        <span
          className={`chip__dot chip__dot--${player.color === 'White' ? 'white' : 'black'}`}
          aria-hidden="true"
        />
      )}
      {player.name}
    </span>
  );

  return (
    <div className="lobby">
      <header className="lobby__header">
        <div>
          <h2 className="lobby__title">Partidas</h2>
          <p className="lobby__subtitle">
            Crie uma sala ou entre numa existente. A partida começa quando o segundo
            jogador entra.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => navigate('/')}>
          Sair
        </button>
      </header>

      {errorMessage && (
        <div className="alert lobby__error" role="alert">
          {errorMessage}
        </div>
      )}

      {/*
        Antes, sem conexão, o lobby simplesmente mostrava "Nenhuma sala aberta" — o usuário
        não tinha como distinguir "não há salas" de "não estou conectado".
      */}
      {!connected && (
        <div className="alert alert--info lobby__error" data-testid="hub-offline">
          <span className="waiting__spinner" />
          Conectando ao servidor de partidas…
        </div>
      )}

      <div className="lobby__toolbar">
        <div className="lobby__color">
          <span className="lobby__color-label">Jogar de</span>
          {/* Grupo segmentado com aria-pressed: acessível e sem dois botões soltos. */}
          <div className="segmented" role="group" aria-label="Cor preferida">
            <button
              type="button"
              aria-pressed={preferredColor === 'White'}
              onClick={() => setPreferredColor('White')}
            >
              Brancas
            </button>
            <button
              type="button"
              aria-pressed={preferredColor === 'Black'}
              onClick={() => setPreferredColor('Black')}
            >
              Pretas
            </button>
          </div>
        </div>

        <form className="lobby__create" onSubmit={handleCreate}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Nome da nova sala"
            aria-label="Nome da nova sala"
          />
          {/* Desabilitado sem conexão: antes o clique estourava "Hub not connected" e a
              única pista era um "Erro ao criar sala." genérico. */}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!newRoomName.trim() || !connected}
          >
            Criar sala
          </button>
        </form>
      </div>

      {rooms.length === 0 ? (
        <div className="lobby__empty">
          <span className="lobby__empty-icon" aria-hidden="true">
            ♟
          </span>
          <strong>Nenhuma sala aberta</strong>
          <span>Crie a primeira e espere o adversário entrar.</span>
        </div>
      ) : (
        <ul className="rooms">
          {rooms.map((name) => {
            const players = playersByRoom[name] ?? [];
            const full = players.length >= 2;
            return (
              <li className="room" key={name}>
                <div className="room__head">
                  <span className="room__name">{name}</span>
                  <span className="chip room__count">{players.length}/2</span>
                </div>

                <div className="room__players">
                  {players.length === 0 ? (
                    <span className="room__empty">Sala vazia</span>
                  ) : (
                    players.map(playerChip)
                  )}
                </div>

                <button
                  className="btn btn--primary btn--block"
                  onClick={() => handleJoin(name)}
                  disabled={full || !preferredColor || !connected || busyRoom === name}
                >
                  {busyRoom === name
                    ? 'Entrando…'
                    : full
                      ? 'Sala cheia'
                      : !connected
                        ? 'Conectando…'
                        : !preferredColor
                          ? 'Escolha uma cor'
                          : 'Entrar na sala'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ChessLobby;
