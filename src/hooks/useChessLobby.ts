import { useCallback, useEffect, useState } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useHubConnection } from './useHubConnection';
import { useAuth } from './useAuth';
import userApi from '../service/userApi';
import { setAssignedColor, setPlayerName } from '../service/gameSession';
import {
  Color,
  CreateRoomResponse,
  JoinRoomResponse,
  PlayerInRoom,
  PlayerJoinedEvent,
  PlayerLeftEvent,
} from '../types/chess';

export type LobbyColor = 'White' | 'Black' | '';

export interface ChessLobbyApi {
  rooms: string[];
  playersByRoom: Record<string, PlayerInRoom[]>;
  /** Conexão com o hub pronta. Sem ela nada no lobby funciona, e o usuário precisa saber. */
  connected: boolean;
  errorMessage: string | null;
  /** Cor pedida pelo jogador. O servidor atribui por ordem de entrada e pode não atender. */
  preferredColor: LobbyColor;
  setPreferredColor: (color: LobbyColor) => void;
  createRoom: (name: string) => Promise<void>;
  /** Entra na sala e devolve a rota do tabuleiro, ou null se não deu. */
  joinRoom: (room: string) => Promise<string | null>;
}

/**
 * Estado e orquestração do lobby, fora do componente.
 *
 * O ChessLobby juntava numa só função: chamadas ao hub SignalR, chamadas REST ao
 * userApi, a sequência de validação de sessão, o estado da UI e o JSX. Aqui fica tudo
 * o que não é apresentação — o componente passou a só desenhar e despachar.
 *
 * A navegação NÃO acontece aqui: joinRoom devolve a rota e quem decide navegar é o
 * componente, que é quem conhece o router.
 */
export function useChessLobby(userId: string | undefined): ChessLobbyApi {
  const { state, invoke, on } = useHubConnection();
  const { decoded, isValid } = useAuth(userId);

  const [rooms, setRooms] = useState<string[]>([]);
  const [playersByRoom, setPlayersByRoom] = useState<Record<string, PlayerInRoom[]>>({});
  const [preferredColor, setPreferredColor] = useState<LobbyColor>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await invoke<string[]>('GetAvailableRooms'));
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

    const applyPlayers = (room: string, players: PlayerInRoom[]) =>
      setPlayersByRoom((prev) => ({ ...prev, [room]: players }));

    const offJoined = on('PlayerJoined', (...args) => {
      const payload = args[0] as PlayerJoinedEvent;
      applyPlayers(payload.room, payload.players);
    });
    const offLeft = on('PlayerLeft', (...args) => {
      const payload = args[0] as PlayerLeftEvent;
      applyPlayers(payload.room, payload.players);
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
      offRoomFull();
      offRoomNotFound();
    };
  }, [state, on, loadRooms, loadPlayersInRoom]);

  const createRoom = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      try {
        const result = await invoke<CreateRoomResponse>('CreateRoom', name);
        if (result.alreadyExisted) setErrorMessage('Sala já existe.');
        setRooms((prev) => (prev.includes(result.room) ? prev : [...prev, result.room]));
      } catch (err) {
        console.error('Error creating room:', err);
        setErrorMessage('Erro ao criar sala.');
      }
    },
    [invoke],
  );

  const joinRoom = useCallback(
    async (room: string): Promise<string | null> => {
      try {
        if (!userId || !decoded || !isValid) {
          setErrorMessage('Sessão inválida. Faça login novamente.');
          return null;
        }
        if (!preferredColor) {
          setErrorMessage('Selecione uma cor antes de entrar.');
          return null;
        }

        const user = await userApi.getUser(userId);
        if (!user.name) return null;

        if (!(await userApi.verifyValidation(decoded.sub))) return null;

        const validation = await userApi.getValidation(decoded.sub);
        if (validation) {
          const updated = await userApi.updateValidation(validation.id, {
            pieceColor: preferredColor.toLowerCase(),
            room,
            userEmail: user.email,
            userId: decoded.sub,
          });
          if (!updated) return null;
        }

        // A cor pedida vai para o servidor, que a atende quando está livre. Antes ele
        // atribuía só por ordem de chegada e ignorava a escolha do jogador.
        const joinResult = await invoke<JoinRoomResponse>(
          'JoinRoom',
          user.name,
          room,
          preferredColor,
        );
        if (!joinResult.room || !joinResult.color || joinResult.color === 'None') {
          setErrorMessage('Falha ao entrar na sala.');
          return null;
        }

        // O servidor continua sendo a autoridade: guardamos a cor que ELE devolveu.
        setAssignedColor(room, joinResult.color);
        setPlayerName(room, user.name);

        if (joinResult.preferenceHonoured === false) {
          setErrorMessage(
            `A cor ${preferredColor} já estava tomada — você joga de ${joinResult.color}.`,
          );
        }

        return `/chess-board/${room}/${userId}`;
      } catch (err) {
        console.error('Error joining room:', err);
        setErrorMessage('Erro ao entrar na sala.');
        return null;
      }
    },
    [userId, decoded, isValid, preferredColor, invoke],
  );

  return {
    rooms,
    playersByRoom,
    connected: state === HubConnectionState.Connected,
    errorMessage,
    preferredColor,
    setPreferredColor,
    createRoom,
    joinRoom,
  };
}
