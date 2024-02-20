import React, { useEffect, useState } from 'react';
import '../styles/ChessLobby.css';
import * as signalR from "@microsoft/signalr";
import {useNavigate} from "react-router-dom";
import {useSignalR} from "./SignalRContext";

const ChessLobby: React.FC = () => {
  const connectionOfWebSocket = useSignalR();
  const [isNewGame, setIsNewGame] = useState<boolean>(false);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [roomList, setRoomList] = useState<string[]>([]);
  const [playerInRooms, setPlayerInRooms] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    setConnection(connectionOfWebSocket);
  }, []);

  useEffect(() => {
    if (connection) {
      connection.start()
          .then(() => {
            console.log('Connection established.');
            handleGetRoom();
            registerEventHandlers();
          })
          .catch(error => console.error("DEU RUIM", error));
    }
  }, [connection]);

  const registerEventHandlers = () => {
    if (connection) {
      connection.on("PlayerJoined", (player: { [key: string]: string }) => {
        setPlayerInRooms(player);
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
      console.error(error);
    }
  };

  const handleJoinRoom = async (actualRoomName: string) => {
    try {
      if (connection) {
        let c = await connection.invoke("JoinRoom", "ThiagãoDasCouves5", actualRoomName)
        console.log(c)
        if(c.connectionId != null) navigate('/chess-board')
      }
    } catch (error) {
      console.error(error);
    }
  };

  const createRoom = async () => {
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
                {roomList.length === 0 ? (
                    <p>Nenhum jogo foi criado até o momento.</p>
                ) : (
                    <ul>
                      {roomList.map((actualRoomName, index) => (
                          <li key={index} onClick={() => handleJoinRoom(actualRoomName)}>{actualRoomName}</li>
                      ))}
                    </ul>
                )}
              </div>
          )}
        </div>
        <div>
          <h3>Jogadores na sala:</h3>
          <ul>
            {Object.entries(playerInRooms).map(([room, playerName], index) => (
                <li key={index}>{playerName} - {room}</li>
            ))}
          </ul>
        </div>
      </div>
  );
};

export default ChessLobby;
