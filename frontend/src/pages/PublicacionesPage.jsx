import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import axios from "axios";

function PublicacionesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/publicaciones")
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // --- NUEVO: CONSTRUCCIÓN DEL ESQUEMA JSON-LD PARA IA ---
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Catálogo de Publicaciones Teocráticas",
    description:
      "Listado de libros, folletos y revistas disponibles en la congregación.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: data.map((pub, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Book", // Usamos Book por ser publicaciones
          name: pub.nombre_publicacion,
          image: pub.url_portada,
          alternateName: pub.siglas,
        },
      })),
    },
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-500">
        Cargando publicaciones...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Helmet>
        <title>Catálogo de Publicaciones | Gestión Local</title>
        {/* Inyectamos el JSON-LD en el <head> dinámicamente */}
        <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
      </Helmet>

      {/* --- BLOQUE SEO FIN --- */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-3xl font-extrabold text-gray-800">
          Catálogo de Publicaciones
        </h2>
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
          {data.length} ítems
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {data.map((pub) => (
          <div
            key={pub.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all p-5 flex flex-col items-center"
          >
            <div className="w-full h-48 bg-gray-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
              {pub.url_portada ? (
                <img
                  src={pub.url_portada}
                  alt={`Portada de ${pub.nombre_publicacion}`}
                  className="h-full object-contain"
                  loading="lazy" // SEO 2026: Solo carga si el usuario hace scroll
                  width="200" // Reserva espacio ancho
                  height="192" // Reserva espacio alto (h-48 = 192px)
                />
              ) : (
                <span className="text-gray-400 italic">Sin imagen</span>
              )}
            </div>
            <h3 className="font-bold text-gray-800 text-center mb-2 h-12 overflow-hidden leading-tight">
              {pub.nombre_publicacion}
            </h3>
            <div className="mt-auto">
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-black rounded-md uppercase tracking-tighter">
                {pub.siglas || "GLOBAL"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default PublicacionesPage;
