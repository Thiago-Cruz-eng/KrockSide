import React, { useState } from 'react';
import './ChessLobby.css';


const ChessLobby: React.FC = () => {
  const [isNewGame, setIsNewGame] = useState<boolean>(false);

  const handleToggleNewGame = () => {
    setIsNewGame(!isNewGame);
  };

  const handleEnterGame = (gameId: number) => {
    // Adicione a lógica para entrar no jogo aqui
    console.log(`Entrando no jogo ${gameId}`);
  };

  const handleCreateGame = () => {
    // Adicione a lógica para criar um novo jogo aqui
    console.log('Criando um novo jogo');
  };

  return (
    <div className="ChessLobby">
      <h2>Recepção de Novos Jogos de Xadrez</h2>
      <div className="lobby-container">
        <div className="lobby-options">
          <button onClick={handleToggleNewGame}>
            {isNewGame ? 'Entrar em um Jogo Existente' : 'Criar Novo Jogo'}
          </button>
          <button>Voltar para o Login</button>
        </div>
        {isNewGame ? (
          <div className="new-game-form">
            <button onClick={handleCreateGame}>Criar Jogo</button>
          </div>
        ) : (
          <div className="existing-games">
            <h3>Jogos Existentes</h3>
            <ul>
              <li onClick={() => handleEnterGame(1)}>Jogo 1</li>
              <li onClick={() => handleEnterGame(2)}>Jogo 2</li>
              {/* Adicione mais jogos conforme necessário */}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChessLobby;
