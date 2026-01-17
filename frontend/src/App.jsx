import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {
  const [publicaciones, setPublicaciones] = useState([])
  const [status, setStatus] = useState('Cargando...')

  useEffect(() => {
    // Gracias al Proxy que configuramos en vite.config.js, 
    // solo necesitamos pedir "/api/publicaciones"
    axios.get("/api/publicaciones")
      .then(response => {
        console.log("✅ Datos recibidos del Proxy:", response.data)
        setPublicaciones(response.data)
        setStatus('✅ Conexión Exitosa con Go y Supabase')
      })
      .catch(error => {
        console.error("❌ Error en la conexión:", error)
        setStatus('❌ Error al conectar con el servidor')
      })
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 style={{ color: '#1a1a1a' }}>Sistema de Gestión - Congregación</h1>
        <div style={{ 
          display: 'inline-block', 
          padding: '10px 20px', 
          borderRadius: '20px', 
          backgroundColor: status.includes('✅') ? '#d4edda' : '#f8d7da',
          color: status.includes('✅') ? '#155724' : '#721c24',
          fontWeight: 'bold'
        }}>
          {status}
        </div>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {publicaciones.map(pub => (
          <div key={pub.id} style={{ 
            border: '1px solid #ddd', 
            borderRadius: '12px', 
            padding: '15px', 
            textAlign: 'center', 
            backgroundColor: '#fff',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            {pub.url_portada ? (
              <img 
                src={pub.url_portada} 
                alt={pub.siglas} 
                style={{ width: '100%', height: '180px', objectFit: 'contain', marginBottom: '15px' }} 
              />
            ) : (
              <div style={{ height: '180px', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', borderRadius: '8px' }}>
                Sin Portada
              </div>
            )}
            <h3 style={{ fontSize: '15px', color: '#333', marginBottom: '10px' }}>{pub.nombre_publicacion}</h3>
            <span style={{ fontSize: '12px', backgroundColor: '#007bff', color: '#fff', padding: '3px 10px', borderRadius: '15px' }}>
              {pub.siglas || 'S/S'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ESTA LÍNEA ES LA QUE SOLUCIONA EL ERROR DE PANTALLA BLANCA:
export default App