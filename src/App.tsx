import React from 'react';
import logo from './logo.svg';
import './App.css';
import ChessSquare from "./ChessSquare";

function App() {
  const rows = 8;
  const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  const isDarkSquare = (row: number, colIndex: number) => {
    return (row + colIndex) % 2 === 1;
  };

  return (
      <div className="chessboard">
        {Array.from({ length: rows }, (_, rowIndex) => (
            <div key={rowIndex} className="row">
              {columns.map((column, colIndex) => (
                  <ChessSquare
                      key={column}
                      color={isDarkSquare(rowIndex, colIndex) ? 'dark' : 'light'}
                      column={column}
                      row={8 - rowIndex} // Invert row numbering to start from 1 at the bottom
                  />
              ))}
            </div>
        ))}
      </div>
  );
}

export default App;
