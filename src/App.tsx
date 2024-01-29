// src/App.tsx
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import ChessLobby from './ChessLobby';
import Login from './Login';

const App = () => {
  return (
      <div className="app">
        <Routes> 
          <Route path="/" element={<Login/>} />
          <Route path="/chess-lobby" element={<ChessLobby/>} />
        </Routes>
      </div>
  );
};

export default App;
