import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { BookOpen, BarChart3, Map, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function HomePage() {
  const { user } = useContext(AppContext);

  const modulos = [
    { titulo: 'Publicaciones', icon: <BookOpen />, path: '/publicaciones' },
    { titulo: 'Informes', icon: <BarChart3 />, path: '/informes' },
    { titulo: 'Reuniones', icon: <Calendar />, path: '/reuniones' },
    { titulo: 'Predicación', icon: <Map />, path: '/predicacion' },
  ];

  return (
    <div className="bg-jw-body min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <header className="mb-14 border-b border-jw-border pb-10">
          <h1 className="text-5xl text-jw-navy font-light tracking-tight mb-4">
            Bienvenido, <span className="font-medium text-jw-blue">{user?.nombre_completo}</span>
          </h1>
          <p className="text-xl text-gray-500 italic">Panel de gestión congregacional.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {modulos.map((mod, i) => (
            <Link key={i} to={mod.path} className="group bg-white border border-jw-border rounded-lg hover:border-jw-blue transition-all shadow-sm hover:shadow-xl flex flex-col">
              <div className="p-10 flex flex-col items-center grow">
                <div className="mb-6 text-jw-blue opacity-80 group-hover:scale-110 transition-transform">
                  {React.cloneElement(mod.icon, { size: 48, strokeWidth: 1.2 })}
                </div>
                <h3 className="text-xl font-medium text-jw-navy">{mod.titulo}</h3>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-between items-center group-hover:bg-jw-navy group-hover:text-white transition-colors">
                <span className="text-xs uppercase font-black tracking-widest">Entrar</span>
                <ChevronRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
export default HomePage;