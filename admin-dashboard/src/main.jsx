import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AdminAuthProviderWrapper } from './state/adminAuth.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AdminAuthProviderWrapper>
        <App />
      </AdminAuthProviderWrapper>
    </BrowserRouter>
  </React.StrictMode>
);


