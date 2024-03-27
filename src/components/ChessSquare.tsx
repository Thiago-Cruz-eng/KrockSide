import "../styles/ChessSquare.css"
import "../styles/ChessPiece.css"
import Piece from "../utils/ChessPiece";
import {useEffect, useRef, useState} from "react";
import * as signalR from "@microsoft/signalr";
import position from "../utils/Position";
import {useSignalR} from "./SignalRContext";
import {useParams} from "react-router-dom";
import UserController from "../service/ComunicationApi";
import {jwtDecode} from "jwt-decode";

interface ChessSquareProps {
    color: string |undefined;
    row: number;
    column: number;
    piece?: Piece | null;
    squareColor: string | null | undefined
    highlighted: boolean;
    onSelectSquare: (possibleMove: PossibleMoves) => any
}
interface DecodedToken {
    sub: string;
    name: string;
    jti: string;
    emailAddress: string;
    exp: number;
}
interface PossibleMoves {
    column: number;
    piece: any;
    row: number;
    squareColor: number;
}

const ChessSquare: React.FC<ChessSquareProps> = ({ color, row, column, piece ,squareColor, highlighted,  onSelectSquare}) => {
    const squareRef = useRef<HTMLDivElement>(null);
    const connectionOfWebSocket = useSignalR();
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const { id, roomName} = useParams()
    const [possibleMove, setPossibleMove] = useState<PossibleMoves[]>([]);

    useEffect(() => {
        setConnection(connectionOfWebSocket);
    }, []);

    const onDragStart = (e: React.DragEvent) => {
        console.log("inciei o movimento")
        e.dataTransfer.setData("piece", JSON.stringify({ row, column, piece }));
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const onDrop = (e: React.DragEvent, targetRow: number, targetColumn: number) => {
        e.preventDefault();
        const pieceData = e.dataTransfer.getData("piece");
        const { row: startRow, column: startColumn, piece } = JSON.parse(pieceData);
        animatePieceMovement(startRow, startColumn, targetRow, targetColumn, piece);
    };

    const animatePieceMovement = (startRow: number, startColumn: number, endRow: number, endColumn: number, piece: Piece) => {
        console.log(startRow, startColumn, endRow, endColumn)
        const startPosition = squareRef.current?.getBoundingClientRect();
        if (!startPosition) return;

        const movingPiece = document.createElement("img");
        movingPiece.src = `${process.env.PUBLIC_URL}/${piece}.png`;
        movingPiece.style.position = "absolute";
        movingPiece.style.left = `${startPosition.left}px`;
        movingPiece.style.top = `${startPosition.top}px`;
        movingPiece.style.transition = "all 0.5s ease";

        document.body.appendChild(movingPiece);

        setTimeout(() => {
            const endPosition = squareRef.current?.getBoundingClientRect();
            if (!endPosition) return;
            movingPiece.style.left = `${endPosition.left}px`;
            movingPiece.style.top = `${endPosition.top}px`;
        }, 0);

        setTimeout(() => {
            movingPiece.remove();
        }, 500);
    };

    const NoClickRapa = async (row: number, column: number, piece: Piece | undefined | null) => {
        try {
            console.log(connection)
            var pos = new position(row, column, squareColor, piece)
            console.log(pos)
            if(connection){
                const accessToken = localStorage.getItem(`accessToken${id}`);
                const decodedToken: DecodedToken = jwtDecode(accessToken ?? "");
                const currentDate = new Date();

                const day = currentDate.getUTCDate();
                const month = currentDate.getUTCMonth() + 1;
                const year = currentDate.getUTCFullYear();

                const dateString = `${year}-${month}-${day}`;

                console.log(decodedToken.emailAddress)
                const verifyValidate = await UserController.getValidationCanMove({
                    AccessToken: accessToken ?? "",
                    Day: dateString,
                    PieceColor: piece?.Color ?? "",
                    Room: roomName ?? "",
                    UserEmail: decodedToken.emailAddress,
                    UserId: decodedToken.sub,
                } );
                if(!verifyValidate) return new Error("User without permission to play")

                const user = await UserController.getUser(id);
                console.log(user.userName)
                const response : PossibleMoves = await connection.invoke("SendPossiblesMoves", user.userName, roomName, row, column );
                console.log(response)
                setPossibleMove([response]);
                setTimeout(() => {
                    handleSquareClick(response);
                }, 100)
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getSizeClass = (piece: string) => {
        switch (piece) {
            case "black-pawn":
            case "white-pawn":
                return 'small';
            case "black-rook":
            case "white-rook":
            case "black-knight":
            case "white-knight":
            case "black-bishop":
            case "white-bishop":
                return 'medium';
            case "black-queen":
            case "white-queen":
                return 'medium-plus';
            case "black-king":
            case "white-king":
                return 'large';
            default:
                return '';
        }
    };

    const handleSquareClick = (possibleMove: PossibleMoves) => {
        console.log("Passando para o pai", possibleMove);
        
        onSelectSquare(possibleMove);            
    }
    return (
        <>
            <div
                className={`chess-square ${color} ${highlighted ? '' : 'highlighted'}`}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, row, column)}
                onClick={() => {
                    NoClickRapa(row, column, piece);
                }}
            >
                {piece && (
                    <img
                        src={"../../" +process.env.PUBLIC_URL + `${piece.Color}-${piece.Type}.png`}
                        alt={"piece"}
                        draggable="true"
                        onDragStart={onDragStart}
                        className={`chess-piece ${getSizeClass(`${piece.Color}-${piece.Type}`)}`}                    
                    />
                )}                
            </div>
        </>
    );
};

export default ChessSquare;