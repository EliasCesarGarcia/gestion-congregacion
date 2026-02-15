import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios'; // <--- AGREGADO

import App from './App.jsx';
import { AppProvider } from './context/AppContext'; 

import './index.css';

// --- CONFIGURACIÓN GLOBAL DE AXIOS ---
// Detectamos si la página corre en tu computadora o en Vercel
const isLocal = window.location.hostname === 'localhost';

axios.defaults.baseURL = isLocal 
  ? 'http://localhost:8080' 
  : 'https://gestion-teocratica-backend.onrender.com';

// Este mensaje aparecerá en la consola del navegador (F12) para confirmar la conexión
console.log("🚀 Conectado al servidor:", axios.defaults.baseURL);
// -------------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);