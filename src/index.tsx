import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './components/App';
import { BrowserRouter as Router } from 'react-router-dom';
import { HubProvider } from './hooks/useHubConnection';

// reportWebVitals saiu junto com o create-react-app: era boilerplate que chamava
// web-vitals 2.x sem nunca receber um handler, então nunca media nada.

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

/**
 * A ordem de aninhamento abaixo não é arbitrária:
 *
 * - `HubProvider` fica **acima** do `Router`, e não dentro de uma rota. A conexão SignalR é única
 *   para toda a aplicação: montada por rota, ela seria derrubada e reaberta a cada navegação, e sair
 *   do lobby para o tabuleiro cortaria a partida.
 *
 * - `StrictMode` é o mais externo. Em desenvolvimento ele monta cada componente **duas vezes** de
 *   propósito, para expor efeito que não sabe se limpar. Vale saber disso ao depurar o hub: o
 *   provider vai abrir e fechar conexão duas vezes no dev server, e isso é o comportamento esperado,
 *   não um bug. Em produção ele não faz nada.
 */
root.render(
  <React.StrictMode>
    <HubProvider>
      <Router>
        <App />
      </Router>
    </HubProvider>
  </React.StrictMode>,
);
