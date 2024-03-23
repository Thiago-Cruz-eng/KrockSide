// Import statements...
import "../styles/ChessLobby.css"
import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useSignalR} from "./SignalRContext";
import UserController from "../service/ComunicationApi";

const ChessLobby: React.FC = () => {
  const connection = useSignalR();
  const [isNewGame, setIsNewGame] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>('');
  const [roomList, setRoomList] = useState<{ [key: string]: string }>({});
  const [playerInRooms, setPlayerInRooms] = useState<{ [key: string]: string[] }>({});
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (connection) {
      connection.start()
          .then(() => {
            console.log('Connection established.');
            registerEventHandlers();
            handleGetRoom();
            handleGetPlayerInRoom();
          })
          .catch(error => console.error("Error connecting:", error));
    }
  }, [connection]);

  const registerEventHandlers = () => {
    if (connection) {
      connection.on("PlayerJoined", (player: { [key: string]: string }) => {
        console.log("Player joined:", player);
        setPlayerInRooms(prevState => ({
          ...prevState,
          [player.roomName]: [...(prevState[player.roomName] || []), player.userName]
        }));
      });
    }
  };

  const handleGetRoom = async () => {
    try {
      if (connection) {
        const rooms = await connection.invoke("GetAvailableRoom");
        setRoomList(rooms);
      }
    } catch (error) {
      console.error("Error getting rooms:", error);
    }
  };

  const handleGetPlayerInRoom = async () => {
    try {
      if (connection) {
        const playersInRoom = await connection.invoke("GetPlayersInEachRoom");
        setPlayerInRooms(playersInRoom);
        console.log(playersInRoom)
      }
    } catch (error) {
      console.error("Error getting players in room:", error);
    }
  };

  const handleJoinRoom = async (actualRoomName: string) => {
    try {
      if (connection) {
        const user = await UserController.getUser(id);
        if (!user.userName) return;

        let c = await connection.invoke("JoinRoom", user.userName, actualRoomName)
        console.log(c)
        setPlayerInRooms({[actualRoomName]: [user.userName]});
        console.log(playerInRooms);

        if (playerInRooms[actualRoomName].length === 2) {
          navigate(`/chess-board/${actualRoomName}/${id}`);
        }
      }
    } catch (error) {
      console.error("Error joining room:", error);
    }
  };

  const createRoom = async () => {
    try {
      if (connection) {
        await connection.invoke("CreateRoom", roomName);
        handleToggleNewGame();
        handleGetRoom();
      }
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleToggleNewGame = () => {
    setIsNewGame(!isNewGame);
  };

  return (
      <div className="ChessLobby">
        <h2>Jogos de Xadrez</h2>
        <div className="lobby-container">
          <div className="lobby-options">
            <button onClick={handleToggleNewGame}>
              {isNewGame ? 'Entrar em um Jogo Existente' : 'Criar Novo Jogo'}
            </button>
            <button>Voltar para o Login</button>
          </div>
          {isNewGame ? (
              <div className="new-game-form">
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Enter room name" />
                <button onClick={createRoom}>Criar Jogo</button>
              </div>
          ) : (
              <div className="existing-games">
                <h3>Jogos Existentes</h3>
                {Object.keys(roomList).length === 0 ? (
                    <p>Nenhum jogo foi criado até o momento.</p>
                ) : (
                    <ul>
                      {Object.entries(roomList).map(([roomId, roomName]) => (
                          <li key={roomId}>
                            {roomName}
                            <button onClick={() => handleJoinRoom(roomName)} className='join-button' disabled={playerInRooms[roomName]?.length === 2}>
                              Entrar na Sala
                            </button>
                            {playerInRooms[roomName] && (
                                <div>
                                  <p>Jogadores na sala:</p>
                                  <ul>
                                    {playerInRooms[roomName].map((player, index) => (
                                        <li key={index}>{player}</li>
                                    ))}
                                  </ul>
                                </div>
                            )}
                          </li>
                      ))}
                    </ul>
                )}
              </div>
          )}
        </div>
      </div>
  );
};

export default ChessLobby;
