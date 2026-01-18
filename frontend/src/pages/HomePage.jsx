import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { BookOpen, BarChart3, Users, Map, Settings, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

function HomePage() {
  const { user } = useContext(AppContext);

  // Definimos los módulos para el tablero
  const modulos = [
    {
      titulo: 'Publicaciones',
      desc: 'Suscripciones, pedidos y stock de literatura.',
      icon: <BookOpen className="w-8 h-8 text-blue-600" />,
      path: '/publicaciones',
      color: 'bg-blue-50'
    },
    {
      titulo: 'Informes',
      desc: 'Carga de actividad mensual y estadísticas.',
      icon: <BarChart3 className="w-8 h-8 text-green-600" />,
      path: '/informes',
      color: 'bg-green-50'
    },
    {
      titulo: 'Reuniones',
      desc: 'Programa semanal y asignaciones.',
      icon: <Calendar className="w-8 h-8 text-purple-600" />,
      path: '/reuniones',
      color: 'bg-purple-50'
    },
    {
      titulo: 'Predicación',
      desc: 'Territorios, tarjetas y salidas al campo.',
      icon: <Map className="w-8 h-8 text-orange-600" />,
      path: '/predicacion',
      color: 'bg-orange-50'
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-12">
      {/* Sección de Bienvenida */}
      <header className="mb-12">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          ¡Hola, <span className="text-blue-600">{user?.username}</span>! 👋
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Bienvenido al sistema de gestión de la congregación.
        </p>
      </header>

      {/* Grid de Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modulos.map((mod, index) => (
          <Link 
            key={index} 
            to={mod.path}
            className="group relative bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
          >
            <div className={`w-16 h-16 ${mod.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
              {mod.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{mod.titulo}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{mod.desc}</p>
            
            <div className="mt-6 flex items-center text-blue-600 font-bold text-sm">
              Acceder ahora
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer del Dashboard / Acciones Rápidas */}
      <section className="mt-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-8 lg:p-12 text-white shadow-xl shadow-blue-200">
        <div className="md:flex items-center justify-between">
          <div className="mb-8 md:mb-0">
            <h2 className="text-3xl font-bold mb-2 text-white">Anuncios de la Congregación</h2>
            <p className="text-blue-100">Mantente al día con las últimas novedades de los departamentos.</p>
          </div>
          <button className="bg-white text-blue-700 font-black px-8 py-4 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg">
            VER ANUNCIOS
          </button>
        </div>
      </section>
    </div>
  );
}

export default HomePage;