import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './components/App';
import reportWebVitals from './utils/reportWebVitals';
import { BrowserRouter as Router } from 'react-router-dom';
import { HubProvider } from './hooks/useHubConnection';

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

reportWebVitals();
