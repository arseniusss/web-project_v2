import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/App.css'
import './styles/Table.css';
import './styles/ServerLoads.css';
import App from './App';

import { AuthProvider } from './context/AuthContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

reportWebVitals();