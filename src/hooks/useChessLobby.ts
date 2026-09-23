import { useCallback, useEffect, useState } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { useHubConnection } from './useHubConnection';
import { useAuth } from './useAuth';
import userApi from '../service/userApi';
import { setAssignedColor, setPlayerName } from '../service/gameSession';
import {
  Color,
  CreateRoomResponse,
  isValidRoomName,
  JoinRoomResponse,
  PlayerInRoom,
  PlayerJoinedEvent,
  PlayerLeftEvent,
} from '../types/chess';

/** Mensagem local para nome de sala recusado antes de ir ao servidor. */
export const INVALID_ROOM_NAME_MESSAGE =
  'Nome de sala inválido: use de 1 a 64 caracteres, só letras, números, espaço, "-" e "_".';

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

  /**
   * Salas abertas. O servidor devolve só as que não estão cheias nem encerradas.
   *
   * Falha vai para o console e não para a tela: a lista de salas é recarregada por evento a todo
   * momento, então um erro transitório se resolve sozinho — e uma faixa vermelha piscando no lobby
   * seria pior que a lista momentaneamente velha.
   */
  const loadRooms = useCallback(async () => {
    try {
      setRooms(await invoke<string[]>('GetAvailableRooms'));
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  }, [invoke]);

  /**
   * Quem está em cada sala.
   *
   * O hub devolve apenas os **nomes** agrupados por sala (`Record<string, string[]>`), sem cor —
   * daí o `color: 'None'` no mapeamento. A cor real de cada jogador só chega nos eventos
   * `PlayerJoined`/`PlayerLeft`, que trazem `PlayerInRoom[]` completo e sobrescrevem estes valores.
   */
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

  /**
   * Carrega o lobby e assina os quatro eventos do hub que o mantêm atualizado.
   *
   * Só corre quando a conexão está `Connected`: invocar método de hub desconectado estoura. O efeito
   * roda de novo a cada mudança de estado da conexão, o que é o que faz o lobby se recuperar
   * sozinho depois de uma reconexão.
   *
   * O `return` do efeito cancela as quatro assinaturas. Sem isso, cada reconexão acrescentaria um
   * handler novo sobre os antigos e o mesmo evento passaria a ser processado várias vezes.
   */
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

  /**
   * Cria a sala.
   *
   * O nome é validado aqui com a MESMA regra do servidor (`ROOM_NAME_PATTERN`) para poupar a ida
   * e volta — mas a recusa que vale é a dele: `success: false` com `message`, que é exibida como
   * veio (nome inválido que escapou, teto de salas atingido). A lista local só ganha a sala quando
   * o servidor confirmou.
   */
  const createRoom = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (!isValidRoomName(trimmed)) {
        setErrorMessage(INVALID_ROOM_NAME_MESSAGE);
        return;
      }
      try {
        const result = await invoke<CreateRoomResponse>('CreateRoom', trimmed);
        if (!result.success) {
          setErrorMessage(result.message ?? 'Não foi possível criar a sala.');
          return;
        }
        if (result.alreadyExisted) setErrorMessage('Sala já existe.');
        setRooms((prev) => (prev.includes(result.room) ? prev : [...prev, result.room]));
      } catch (err) {
        console.error('Error creating room:', err);
        setErrorMessage('Erro ao criar sala.');
      }
    },
    [invoke],
  );

  /**
   * Passa pela sequência de autorização de sessão do subdomínio `Validation`.
   *
   * São três chamadas REST em fila — verificar, ler, atualizar — para gravar a sala e a cor pedidas
   * no registro do usuário.
   *
   * **Nada disso influencia a partida.** O `ChessHub` revalida identidade, turno, posse e legalidade
   * por conta própria e **não consulta** esta coleção; a cor efetiva é decidida por
   * `TryAssignColor` no servidor. Ou seja, esta sequência é hoje quase cerimônia — é o DT-10, que
   * aguarda a decisão do backend sobre o destino da coleção `Validation`.
   *
   * @returns `false` quando algum passo recusou. **Sem mensagem de erro** — ver a nota em `joinRoom`.
   */
  const syncValidation = useCallback(
    async (subject: string, room: string, userEmail: string): Promise<boolean> => {
      if (!(await userApi.verifyValidation(subject))) return false;

      const validation = await userApi.getValidation(subject);

      // Sem registro de validação não é erro: segue em frente e entra na sala. O registro é criado
      // no login, então a ausência só acontece em sessão antiga.
      if (!validation) return true;

      return userApi.updateValidation(validation.id, {
        pieceColor: preferredColor.toLowerCase(),
        room,
        userEmail,
        userId: subject,
      });
    },
    [preferredColor],
  );

  /**
   * Entra numa sala e devolve a rota do tabuleiro.
   *
   * Cinco passos, em ordem: conferir a sessão, conferir que uma cor foi escolhida, buscar o nome do
   * jogador, passar pela autorização de sessão e finalmente invocar `JoinRoom` no hub.
   *
   * **Débito conhecido (DT-10): três dos caminhos de recusa são silenciosos.** Quando `user.name`
   * vem vazio, ou quando `syncValidation` recusa, esta função devolve `null` **sem** chamar
   * `setErrorMessage` — o jogador clica em "Entrar na Sala" e absolutamente nada acontece, sem
   * explicação na tela. Os pontos estão marcados com `// silencioso` abaixo.
   *
   * A correção recomendada em `docs/debito-tecnico.md` é trocar cada um por uma mensagem própria.
   * Não foi feita aqui porque muda comportamento observável, e esta passagem era de estrutura e
   * documentação — mas é uma melhoria pequena e de alto retorno para quem for pegar o item.
   */
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

        // O nome vem do backend, não do token: é ele que o hub mostra aos outros jogadores.
        const user = await userApi.getUser(userId);
        if (!user.name) return null; // silencioso — DT-10

        if (!(await syncValidation(decoded.sub, room, user.email))) return null; // silencioso — DT-10

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
        // Por sala, e não global: um usuário pode ter assento em salas diferentes com cores
        // diferentes, e é isto que o ChessBoard lê depois em `getAssignedColor`.
        setAssignedColor(room, joinResult.color);
        setPlayerName(room, user.name);

        // Aviso, não erro: a entrada deu certo, só não com a cor pedida. Por isso a função segue e
        // devolve a rota.
        if (joinResult.preferenceHonoured === false) {
          setErrorMessage(
            `A cor ${preferredColor} já estava tomada — você joga de ${joinResult.color}.`,
          );
        }

        // Devolve a rota em vez de navegar: quem conhece o router é o componente. Assim este hook
        // continua testável sem montar um `MemoryRouter`. O nome da sala vai codificado: espaço e
        // caracteres fora do ASCII são válidos no nome, e crus quebrariam o segmento da rota.
        return `/chess-board/${encodeURIComponent(room)}/${encodeURIComponent(userId)}`;
      } catch (err) {
        console.error('Error joining room:', err);
        setErrorMessage('Erro ao entrar na sala.');
        return null;
      }
    },
    [userId, decoded, isValid, preferredColor, invoke, syncValidation],
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
