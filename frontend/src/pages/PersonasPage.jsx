/**
 * ARCHIVO: PersonasPage.jsx
 * UBICACIÓN: frontend/src/pages/PersonasPage.jsx
 * DESCRIPCIÓN: Módulo de personas. Lo ven coordinador, secretario, servicio y
 * superadmin.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. Las rutas
 * /api/personas/* devuelven 403 a quien no tenga permiso.
 */

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Tarjeta from "../components/ui/Tarjeta";

function PersonasPage() {
  const { t } = useTranslation();
  const { permisos } = useContext(AppContext);

  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!permisos.es_superadmin && !permisos.es_encargado_general) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-jw-text-main">
        {t("per_titulo", "Personas")}
      </h1>
      <Tarjeta>
        <p className="text-sm text-jw-text-main opacity-70">
          {t("per_en_construccion", "Pantalla en construcción.")}
        </p>
      </Tarjeta>
    </div>
  );
}

export default PersonasPage;