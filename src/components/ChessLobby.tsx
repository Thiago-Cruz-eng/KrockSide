import React, { useEffect, useState } from 'react';
import '../styles/ChessLobby.css';
import * as signalR from "@microsoft/signalr";
import { useNavigate, useParams  } from "react-router-dom";
import { useSignalR } from "./SignalRContext";
import UserController from '../service/ComunicationApi'; // Adjust the import path as necessary


const ChessLobby: React.FC = () => {
  const connectionOfWebSocket = useSignalR();
  const [isNewGame, setIsNewGame] = useState<boolean>(false);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [roomList, setRoomList] = useState< {[key: string]: string}>({});
  const [playerInRooms, setPlayerInRooms] = useState<{ [key: string]: string }>({});
  const [clickedRooms, setClickedRooms] = useState<string[]>([]);
  const navigate = useNavigate();
  let { id } = useParams();

  useEffect(() => {
    if(!connection) {
      setConnection(connectionOfWebSocket);
    }
  }, []);

  useEffect(() => {
    if (connection != null) {
      connection.start()
        .then(() => {
          console.log('Connection established.');
          handleGetRoom();
          registerEventHandlers();
        })
        .catch(error => console.error("DEU RUIM", error));
    }
  },[connection]);

  const registerEventHandlers = () => {
    if (connection) {
 
      connection.on("PlayerJoined", (player: { [key: string]: string }) => {
        console.log(player);
        setPlayerInRooms(player);
      });
    }
  };

  const handleGetRoom = async () => {
    try {
      if (connection) {
        const rooms = await connection.invoke("GetAvailableRoom");
        setRoomList(rooms);
        console.log(rooms);
        
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleJoinRoom = async (actualRoomName: string, ) => {
    try {
      setClickedRooms(prevClickedRooms => [...prevClickedRooms, actualRoomName]);

      console.log(connection)
      if (connection) {
        console.log();
        
        var user = await UserController.getUser(id);
        console.log(user);

        if(user.userName == null) return

        let c = await connection.invoke("JoinRoom", user.userName, actualRoomName)
        console.log(c)
        setPlayerInRooms({[actualRoomName]: user.userName});
        console.log(playerInRooms);
        if (clickedRooms.length === 1) {
          if (c.connectionId != null) navigate(`/chess-board/${actualRoomName}/${id}`);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const createRoom = async () => {
    console.log(connection)
    try {
      if (connection) {
        await connection.invoke("CreateRoom", roomName);
        handleToggleNewGame();
        await handleGetRoom();
      }
    } catch (error) {
      console.error(error);
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
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Enter your name" />
            <button onClick={createRoom}>Criar Jogo</button>
          </div>
        ) : (
          <div className="existing-games">
            <h3>Jogos Existentes</h3>
            {Object.keys(roomList).length === 0 ? (
              <p>Nenhum jogo foi criado até o momento.</p>
            ) : (
              <ul>
                {Object.values(roomList).map((actualRoomName, index) => (
                  <React.Fragment key={index}>
                    <li>
                      {actualRoomName}
                      <button onClick={() => handleJoinRoom(actualRoomName)} className='join-button' disabled={clickedRooms.includes(actualRoomName)}>
                        Entrar na Sala
                      </button>
                    </li>
                    {Array.isArray(playerInRooms[actualRoomName]) && (
                      <li>
                        Jogadores na sala:
                        <ul>
                          {Object.keys(playerInRooms).map((playerName, innerIndex) => (
                            <li key={innerIndex}>{playerName} </li> 
                          ))}
                        </ul>
                      </li>
                    )}
                  </React.Fragment>
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
