import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './components/App';
import reportWebVitals from './utils/reportWebVitals';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { SignalRProvider } from './components/SignalRContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
      <SignalRProvider>
          <Router>
              <Routes>
                  <Route path="*" element={ <App /> }>
                  </Route>
              </Routes>
          </Router>
      </SignalRProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
