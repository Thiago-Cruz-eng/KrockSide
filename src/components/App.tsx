// src/App.tsx
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ChessLobby from './ChessLobby';
import Login from './Login';
import ChessBoard from "./ChessBoard";
import { SignalRProvider } from './SignalRContext';

const App = () => {
  return (
      <div className="app">
        <Routes> 
          <Route path="/" element={<Login/>} />
          <Route path="/chess-lobby/:id" element={<ChessLobby />} />
          <Route path="/chess-board/:roomName/:id" element={<ChessBoard />} />
        </Routes>
      </div>
  );
};

export default App;
