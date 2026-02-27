import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import axios from "axios";

function PublicacionesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Limpiamos errores previos al re-intentar
    setLoading(true);
    axios
      .get("/api/publicaciones")
      .then((res) => {
        if (res.data) {
          setData(res.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al cargar publicaciones:", err);
        setLoading(false);
      });
  }, []);

  // --- CONSTRUCCIÓN DEL ESQUEMA JSON-LD ---
  // Solo generamos el esquema si hay datos para evitar errores de mapeo
  const schemaData = data.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Catálogo de Publicaciones Teocráticas",
    "description": "Listado de libros, folletos y revistas disponibles en la congregación.",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": data.map((pub, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Book",
          "name": pub.nombre_publicacion,
          "image": pub.url_portada,
          "alternateName": pub.siglas,
        },
      })),
    },
  } : null;

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col items-center animate-pulse">
      <div className="w-full h-48 bg-gray-200 rounded-xl mb-4"></div>
      <div className="h-4 bg-gray-200 w-3/4 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 w-1/2 rounded mb-4"></div>
      <div className="mt-auto h-6 bg-gray-100 w-1/3 rounded"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Helmet>
        <title>Catálogo de Publicaciones | Gestión Local</title>
        <meta name="description" content="Explore el catálogo completo de publicaciones teocráticas." />
        {/* Solo inyectamos el script si schemaData existe */}
        {schemaData && (
          <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
        )}
      </Helmet>

      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-xl sm:text-3xl font-extrabold text-gray-800 italic uppercase tracking-tighter">
          Catálogo de Publicaciones
        </h2>
        
        {loading ? (
          <div className="w-16 h-7 bg-gray-200 rounded-full animate-pulse"></div>
        ) : (
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
            {data.length} ítems
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data.length > 0 ? (
          data.map((pub) => (
            <div
              key={pub.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all p-5 flex flex-col items-center group"
            >
              <div className="w-full h-48 bg-gray-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center border border-gray-50">
                {pub.url_portada ? (
                  <img
                    src={pub.url_portada}
                    alt={`Portada de ${pub.nombre_publicacion}`}
                    className="h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy" 
                    width="200" 
                    height="192" 
                  />
                ) : (
                  <span className="text-gray-400 italic text-xs">Sin imagen</span>
                )}
              </div>
              
              <h3 className="font-bold text-gray-800 text-center mb-2 h-12 overflow-hidden leading-tight text-sm sm:text-base">
                {pub.nombre_publicacion}
              </h3>
              
              <div className="mt-auto">
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-md uppercase tracking-tighter border border-gray-200">
                  {pub.siglas || "GLOBAL"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-10 text-gray-500">
            No se encontraron publicaciones. Por favor, revise la conexión al servidor.
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicacionesPage;