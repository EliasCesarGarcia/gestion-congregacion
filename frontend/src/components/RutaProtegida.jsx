import { Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

function RutaProtegida({ children }) {
  const { user } = useContext(AppContext);
  
  // Por ahora, si no hay usuario, mandamos al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
export default RutaProtegida;