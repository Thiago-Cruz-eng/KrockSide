import React, {useEffect, useState} from 'react';
import '../styles/ChessBoard.css';
import * as signalR from "@microsoft/signalr";
import {useSignalR} from "./SignalRContext";
import { useParams } from 'react-router-dom';

const ChessBoard: React.FC = () => {
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { roomName } = useParams();

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);

    useEffect(() => {
        // Ensure connection exists before invoking
        if (connection) {
            const startGame = async () => {
                try {
                    const response = await connection.invoke("StartGame", roomName);
                    console.log(response);
                } catch (error) {
                    console.error("Error invoking StartGame:", error);
                }
            };
            startGame();
        }
    }, [connection, roomName]);

    return (

        <div className="chessboard">

                <div className="row">
                    {/*{row.map((piece: string, colIndex: number) =>*/}
                    {/*{*/}
                    {/*    return (*/}
                    {/*    <ChessSquare*/}
                    {/*        key={`${rowIndex}-${colIndex}`}*/}
                    {/*        color={isDarkSquare(rowIndex, colIndex) ? 'Black' : 'White'}*/}
                    {/*        column={colIndex + 1}*/}
                    {/*        row={8 - rowIndex}*/}
                    {/*        pieceName={piece}*/}
                    {/*        piece={pec}*/}
                    {/*    />*/}
                    {/*)})}*/}
                </div>
        </div>
    );
};

export default ChessBoard;
