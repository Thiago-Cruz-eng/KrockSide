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

root.render(
  <React.StrictMode>
    <HubProvider>
      <Router>
        <App />
      </Router>
    </HubProvider>
  </React.StrictMode>,
);
