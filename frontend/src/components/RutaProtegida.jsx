// Nombre: RutaProtegida.jsx
// Ubicación: GESTION-CONGREGACION/frontend/src/components/RutaProtegida.jsx

import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

function RutaProtegida({ children }) {
  const { user } = useContext(AppContext);
  
  // Si no hay usuario en el estado global, bloqueamos el paso.
  // Como ahora no hay token que verificar manualmente, confiamos en el objeto 'user'...
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
export default RutaProtegida;