/**
 * ARCHIVO: PersonasPage.jsx
 * UBICACIÓN: frontend/src/pages/PersonasPage.jsx
 * DESCRIPCIÓN: Módulo de personas: lista con búsqueda mientras se escribe,
 * filtros, números de la congregación y paginación. Lo ven coordinador,
 * secretario, servicio y superadmin.
 *
 * CONGREGACIÓN: coordinador, secretario y servicio ven solo la suya (lo
 * decide el backend). El superadmin elige una con el selector (arranca en la
 * suya) y NUNCA se mezclan congregaciones: todo lo que se ve es de la elegida.
 *
 * La búsqueda no distingue mayúsculas ni tildes (lo resuelve el backend) y
 * busca en apellido, nombre y situaciones. Cada cambio de filtro vuelve a la
 * página 1. Si el usuario sigue escribiendo, el pedido anterior se cancela.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. Las rutas
 * /api/personas/* devuelven 403 a quien no tenga permiso.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Boton from "../components/ui/Boton";
import Tarjeta from "../components/ui/Tarjeta";
import Etiqueta from "../components/ui/Etiqueta";
import { CampoSelect } from "../components/ui/Campo";
import ResumenPersonas from "../components/personas/ResumenPersonas";
import { FILTROS_VACIOS, ROLES } from "../config/personasConfig";

const LIMITE = 20; // personas por página
const ESPERA_BUSQUEDA_MS = 300; // pausa al escribir antes de buscar

const iniciales = (p) =>
  `${p.apellido?.[0] || ""}${p.nombre?.[0] || ""}`.toUpperCase();

function PersonasPage() {
  const { t } = useTranslation();
  const { permisos, user } = useContext(AppContext);
  const esSuper = permisos.es_superadmin;
  const autorizado =
    permisos.cargado && (esSuper || permisos.es_encargado_general);

  // --- Congregación (solo la elige el superadmin; arranca en la suya) ---
  const [congregaciones, setCongregaciones] = useState([]);
  const [errorCong, setErrorCong] = useState(false);
  const [congregacionId, setCongregacionId] = useState(
    user?.congregacion_id || "",
  );
  // El superadmin necesita una congregación concreta antes de pedir datos.
  const listo = autorizado && (!esSuper || congregacionId !== "");

  // --- Búsqueda y filtros ---
  const [busqueda, setBusqueda] = useState(""); // lo que se escribe
  const [qActiva, setQActiva] = useState(""); // lo que se busca (con pausa)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [verFiltros, setVerFiltros] = useState(false);
  const [pagina, setPagina] = useState(1);

  // --- Resultados. `clave` dice a qué pedido corresponde (si no coincide
  // con el pedido actual, se está cargando). ---
  const [resultado, setResultado] = useState({
    clave: "",
    personas: [],
    total: 0,
    limite: LIMITE,
    error: "",
  });
  const [conteos, setConteos] = useState({ datos: null, error: false });

  const clave = JSON.stringify([congregacionId, qActiva, filtros, pagina]);
  const cargando = resultado.clave !== clave;

  const cambiarFiltro = (parcial) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(1);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setQActiva("");
    setFiltros(FILTROS_VACIOS);
    setPagina(1);
  };

  const cambiarCongregacion = (id) => {
    setCongregacionId(id);
    setConteos({ datos: null, error: false }); // los números son de la anterior
    setFiltros(FILTROS_VACIOS); // los grupos y situaciones pueden ser otros
    setPagina(1);
  };

  // Pausa de 300 ms desde la última tecla.
  useEffect(() => {
    const id = setTimeout(() => {
      setQActiva(busqueda.trim());
      setPagina(1);
    }, ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(id);
  }, [busqueda]);

  // Superadmin: lista de congregaciones para el selector. Si su sesión no
  // trae congregación, se elige la primera de la lista.
  useEffect(() => {
    if (!autorizado || !esSuper) return;
    let cancelado = false;
    axios
      .get("/api/admin/congregaciones", {
        params: { q: "", estado: "todas", page: 1, limit: 100 },
      })
      .then(({ data }) => {
        if (cancelado) return;
        const filas = Array.isArray(data.congregaciones)
          ? data.congregaciones
          : [];
        setCongregaciones(filas);
        setCongregacionId((actual) => actual || filas[0]?.id || "");
      })
      .catch(() => {
        if (!cancelado) setErrorCong(true);
      });
    return () => {
      cancelado = true;
    };
  }, [autorizado, esSuper]);

  // Lista: se vuelve a pedir cada vez que cambia algo; el pedido viejo se cancela.
  useEffect(() => {
    if (!listo) return;
    const control = new AbortController();
    const params = { page: pagina, limit: LIMITE };
    if (esSuper) params.congregacion_id = congregacionId;
    if (qActiva) params.q = qActiva;
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    axios
      .get("/api/personas/buscar", { params, signal: control.signal })
      .then(({ data }) => {
        setResultado({
          clave,
          personas: Array.isArray(data.personas) ? data.personas : [],
          total: data.total || 0,
          limite: data.limit || LIMITE,
          error: "",
        });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        const detalle =
          typeof err.response?.data === "string" ? err.response.data : "";
        setResultado({
          clave,
          personas: [],
          total: 0,
          limite: LIMITE,
          error: detalle || t("per_error_lista", "No se pudo cargar la lista."),
        });
      });

    return () => control.abort();
    // `clave` ya resume congregacionId, qActiva, filtros y pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave]);

  // Números de arriba (al entrar y al cambiar de congregación).
  useEffect(() => {
    if (!listo) return;
    let cancelado = false;
    axios
      .get("/api/personas/conteos", {
        params: esSuper ? { congregacion_id: congregacionId } : {},
      })
      .then(({ data }) => {
        if (!cancelado) setConteos({ datos: data, error: false });
      })
      .catch(() => {
        if (!cancelado) setConteos({ datos: null, error: true });
      });
    return () => {
      cancelado = true;
    };
  }, [listo, esSuper, congregacionId]);

  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!autorizado) {
    return <Navigate to="/" replace />;
  }

  // Opciones de los desplegables (salen de los conteos reales).
  const valoresDe = (campo) =>
    (conteos.datos?.situaciones || [])
      .filter((s) => s.campo === campo)
      .map((s) => s.valor);
  const grupos = (conteos.datos?.grupos || [])
    .filter((g) => g.grupo !== null)
    .map((g) => g.grupo);

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;
  const hayAlgo = filtrosActivos > 0 || busqueda.trim() !== "";
  const totalPaginas = Math.max(
    1,
    Math.ceil(resultado.total / resultado.limite),
  );

  const selectSituacion = (campo, etiqueta) => (
    <CampoSelect
      id={`per-sit-${campo}`}
      label={etiqueta}
      value={filtros[`situacion_${campo}`]}
      onChange={(e) =>
        cambiarFiltro({ [`situacion_${campo}`]: e.target.value })
      }
    >
      <option value="">{t("per_todas", "Todas")}</option>
      {campo > 1 && (
        <option value="sin">{t("per_sin_situacion", "Sin situación")}</option>
      )}
      {valoresDe(campo).map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </CampoSelect>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-jw-text-main">
            {t("per_titulo", "Personas")}
          </h1>
          {!cargando && !resultado.error && (
            <span className="text-sm text-jw-text-main opacity-70">
              {resultado.total} {t("per_personas", "personas")}
            </span>
          )}
        </div>

        {esSuper && (
          <div className="w-full sm:w-72">
            <CampoSelect
              id="per-congregacion"
              label={t("per_congregacion", "Congregación")}
              value={congregacionId}
              onChange={(e) => cambiarCongregacion(e.target.value)}
              error={
                errorCong
                  ? t(
                      "per_error_congregaciones",
                      "No se pudo cargar la lista de congregaciones.",
                    )
                  : undefined
              }
            >
              {congregaciones.length === 0 && congregacionId && (
                <option value={congregacionId}>
                  {user?.congregacion_nombre || congregacionId}
                </option>
              )}
              {congregaciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.numero_congregacion ? ` (${c.numero_congregacion})` : ""}
                </option>
              ))}
            </CampoSelect>
          </div>
        )}
      </div>

      <ResumenPersonas
        conteos={conteos.datos}
        error={conteos.error}
        filtros={filtros}
        onFiltro={cambiarFiltro}
      />

      <Tarjeta className="space-y-4">
        {/* Búsqueda y botón de filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute start-3 top-1/2 -translate-y-1/2 text-jw-text-main opacity-50"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t(
                "per_buscar_ph",
                "Buscar por apellido, nombre o situación",
              )}
              aria-label={t("per_buscar", "Buscar personas")}
              className="w-full bg-jw-body text-jw-text-main border border-jw-border rounded-xl ps-9 pe-3 py-2 text-sm outline-none focus:border-jw-accent transition-colors"
            />
          </div>
          <Boton
            variante="suave"
            icono={SlidersHorizontal}
            aria-expanded={verFiltros}
            onClick={() => setVerFiltros((v) => !v)}
          >
            {t("per_filtros", "Filtros")}
            {filtrosActivos > 0 && ` (${filtrosActivos})`}
          </Boton>
          {hayAlgo && (
            <Boton variante="suave" onClick={limpiarTodo}>
              {t("per_limpiar", "Limpiar")}
            </Boton>
          )}
        </div>

        {verFiltros && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <CampoSelect
              id="per-estado"
              label={t("per_f_estado", "Estado")}
              value={filtros.estado}
              onChange={(e) => cambiarFiltro({ estado: e.target.value })}
            >
              <option value="">{t("per_todos", "Todos")}</option>
              <option value="ALTA">{t("per_alta", "Alta")}</option>
              <option value="BAJA">{t("per_baja", "Baja")}</option>
            </CampoSelect>

            <CampoSelect
              id="per-condicion"
              label={t("per_f_condicion", "Condición")}
              value={filtros.condicion}
              onChange={(e) => cambiarFiltro({ condicion: e.target.value })}
            >
              <option value="">{t("per_todas", "Todas")}</option>
              <option value="A">{t("per_activo", "Activo")}</option>
              <option value="I">{t("per_inactivo", "Inactivo")}</option>
            </CampoSelect>

            {selectSituacion(1, t("per_f_sit1", "Situación 1"))}
            {selectSituacion(2, t("per_f_sit2", "Situación 2"))}
            {selectSituacion(3, t("per_f_sit3", "Situación 3"))}

            <CampoSelect
              id="per-grupo"
              label={t("per_f_grupo", "Grupo")}
              value={filtros.grupo}
              onChange={(e) => cambiarFiltro({ grupo: e.target.value })}
            >
              <option value="">{t("per_todos", "Todos")}</option>
              <option value="sin">{t("per_sin_grupo", "Sin grupo")}</option>
              {grupos.map((g) => (
                <option key={g} value={String(g)}>
                  {t("per_grupo", "Grupo")} {g}
                </option>
              ))}
            </CampoSelect>

            <CampoSelect
              id="per-rol"
              label={t("per_f_rol", "Rol")}
              value={filtros.rol_app}
              onChange={(e) => cambiarFiltro({ rol_app: e.target.value })}
            >
              <option value="">{t("per_todos", "Todos")}</option>
              {Object.entries(ROLES).map(([id, [claveRol, textoRol]]) => (
                <option key={id} value={id}>
                  {t(claveRol, textoRol)}
                </option>
              ))}
            </CampoSelect>
          </div>
        )}

        {/* Estado de la carga */}
        {cargando && (
          <div className="flex justify-center py-6" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
          </div>
        )}

        {!cargando && resultado.error && (
          <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2">
            {resultado.error}
          </p>
        )}

        {!cargando && !resultado.error && resultado.personas.length === 0 && (
          <p className="text-sm text-jw-text-main opacity-70 py-4 text-center">
            {t(
              "per_sin_resultados",
              "No hay personas que coincidan con la búsqueda.",
            )}
          </p>
        )}

        {/* Lista */}
        {!cargando && !resultado.error && resultado.personas.length > 0 && (
          <ul className="divide-y divide-jw-border">
            {resultado.personas.map((p) => {
              const deBaja = p.estado === "BAJA";
              const rol = ROLES[p.rol_app];
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 py-3 ${deBaja ? "opacity-70" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-jw-body border border-jw-border flex items-center justify-center text-xs text-jw-text-main shrink-0">
                    {p.foto_url ? (
                      <img
                        src={p.foto_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      iniciales(p)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/personas/${p.id}`}
                      className="block text-sm font-medium text-jw-text-main truncate hover:underline"
                    >
                      {p.apellido} {p.nombre}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.situacion_1 && <Etiqueta>{p.situacion_1}</Etiqueta>}
                      {p.situacion_2 && <Etiqueta>{p.situacion_2}</Etiqueta>}
                      {p.situacion_3 && <Etiqueta>{p.situacion_3}</Etiqueta>}
                      {rol && p.rol_app !== "publicador" && (
                        <Etiqueta tono="ok">{t(rol[0], rol[1])}</Etiqueta>
                      )}
                      {deBaja && (
                        <Etiqueta tono="aviso">
                          {t("per_baja", "Baja")}
                        </Etiqueta>
                      )}
                      {!deBaja && p.condicion === "I" && (
                        <Etiqueta tono="aviso">
                          {t("per_inactivo", "Inactivo")}
                        </Etiqueta>
                      )}
                    </div>
                  </div>

                  {p.grupo != null && (
                    <span className="text-xs text-jw-text-main opacity-60 shrink-0">
                      {t("per_grupo", "Grupo")} {p.grupo}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Boton
              variante="suave"
              disabled={cargando || pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              {t("per_anterior", "Anterior")}
            </Boton>
            <span className="text-xs text-jw-text-main opacity-70">
              {t("per_pagina", "Página")} {pagina} / {totalPaginas}
            </span>
            <Boton
              variante="suave"
              disabled={cargando || pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              {t("per_siguiente", "Siguiente")}
            </Boton>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

export default PersonasPage;
