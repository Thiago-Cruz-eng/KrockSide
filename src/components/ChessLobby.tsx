// Import statements...
import "../styles/ChessLobby.css"
import {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useSignalR} from "./SignalRContext";
import UserController from "../service/ComunicationApi";
import {jwtDecode} from "jwt-decode"

interface DecodedToken {
  sub: string;
  name: string;
  jti: string;
  emailAddress: string;
  exp: number;
}

const ChessLobby: React.FC = () => {
  const connection = useSignalR();
  const [isNewGame, setIsNewGame] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>('');
  const [roomList, setRoomList] = useState<{ [key: string]: string }>({});
  const [playerInRooms, setPlayerInRooms] = useState<{ [key: string]: string[] }>({});
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedColor, setSelectedColor] = useState<string>(''); // State to remember selected color


  useEffect(() => {
    if (connection) {
      connection.start()
          .then(() => {
            console.log('Connection established.');
            handleGetRoom();
            handleGetPlayerInRoom();
          })
          .catch(error => console.error("Error connecting:", error));

      connection.on("CreateRoom", (newRoom: string) => {
        setRoomList(prevRoomList => ({
          ...prevRoomList,
          [newRoom]: newRoom
        }));
      });
      connection.on("GameWillStart", (roomName: string) => {
        navigate(`/chess-board/${roomName}/${id}`);
      });
      connection.on("PlayerJoined", (player) => {
        handleGetPlayerInRoom()
        // const { roomName, userName } = player; // Destructure roomName and userName from the received player object
        // console.log("Player joined:", player);
        // setPlayerInRooms(prevState => ({
        //   ...prevState,
        //   [roomName]: [...(prevState[roomName] || []), userName] // Append the userName to the array of players in the specified room
        // }));
      });
    }
  }, [connection]);

  const registerEventHandlers = () => {
    if (connection) {

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
        const updatedPlayersInRoom: { [key: string]: string[] } = {};
        const playersInRoom: { [key: string]: string } = await connection.invoke("GetPlayersInEachRoom");
        Object.keys(playersInRoom).forEach(player => {
          const roomName = playersInRoom[player];
          if (!updatedPlayersInRoom[roomName]) {
            updatedPlayersInRoom[roomName] = [player];
          } else {
            updatedPlayersInRoom[roomName].push(player);
          }
        });
        setPlayerInRooms(updatedPlayersInRoom);
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

        const accessToken = localStorage.getItem(`accessToken${id}`);
        console.log(accessToken)
        if(accessToken == null) return
        const decodedToken : DecodedToken = jwtDecode(accessToken);
        if(decodedToken != null){
          const verifyValidate = await UserController.verifyValidation({
            AccessToken: accessToken,
            UserId: decodedToken.sub
          } );

          console.log(verifyValidate)
          if(!verifyValidate) return
        }
        console.log(decodedToken)

        const validationUser = await UserController.getValidation({
          AccessToken: accessToken,
          UserId: decodedToken.sub
        });

        const updateValidation = await UserController.updateValidation(validationUser.Id, {
          AccessToken: accessToken, PieceColor: selectedColor, Room: actualRoomName, UserEmail: user.email, UserId: id!.toString()
        });

        console.log(user.userName, actualRoomName, selectedColor)

        if(!updateValidation) return
        await connection.invoke("JoinRoom", user.userName, actualRoomName)


        if(!updateValidation) return

        let playersInRoom: number = await connection.invoke("GetPlayersInRoom", actualRoomName)

        if (playersInRoom === 2) {
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
                            {/* Buttons for selecting player color */}
                            <div>
                              <button onClick={() => setSelectedColor('black')} disabled={selectedColor === 'branco'}>
                                Preto
                              </button>
                              <button onClick={() => setSelectedColor('white')} disabled={selectedColor === 'preto'}>
                                Branco
                              </button>
                            </div>
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
