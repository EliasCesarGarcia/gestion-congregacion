/**
 * ARCHIVO: ProfilePage.jsx
 * UBICACIÓN: /frontend/src/pages/ProfilePage.jsx
 *
 * DESCRIPCIÓN TÉCNICA (SENIOR):
 * Este componente es el núcleo de gestión de identidad del usuario.
 * Implementa:
 * 1. Internacionalización (i18n) con soporte completo para idiomas RTL (Árabe/Hebreo).
 * 2. SEO 2026: Metadatos dinámicos mediante React Helmet y optimización de LCP con WebP.
 * 3. SEGURIDAD: Validación de integridad de archivos en el cliente y flujo MFA (Multi-Factor Authentication) mediante PIN.
 * 4. UX ADAPTATIVA: Uso de Propiedades Lógicas de CSS (Logical Properties) para auto-espejado de interfaz.
 */

import React, { useContext, useState, useRef, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useTranslation } from "react-i18next"; // i18n
import { Helmet } from "react-helmet-async"; // Motor de SEO para controlar títulos y etiquetas

// Colección de Iconos institucionales
import {
  User,
  Shield,
  Mail,
  Key,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCircle,
  HelpCircle,
  FileText,
  Trash2,
  ArrowRight,
  Lock,
  ShieldCheck,
  Phone,
  Hash,
  ShieldAlert,
  MapPin,
  Building2,
  Map,
  Landmark,
  Globe2,
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  UserRoundPlus,
} from "lucide-react";

// Motor de animaciones (Alias 'Motion' para cumplir reglas de calidad de código)
import { motion as Motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression"; // Compresor de imágenes inteligente
import axios from "axios"; // Cliente para comunicación con el servidor
import { supabase } from "../lib/supabase"; // Conexión con el almacenamiento de la nube
import { useNavigate } from "react-router-dom"; // Navegador interno de la aplicación
import Modal from "../components/Modal"; // Ventanas emergentes de aviso

// ==========================================================
// --- COMPONENTES AUXILIARES (PIEZAS PEQUEÑAS DE LA WEB) ---
// ==========================================================

/**
 * ReqItem: Muestra una bolita verde o gris para indicar si la contraseña cumple un requisito.
 */
function ReqItem({ met, text }) {
  return (
    <div
      className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter transition-colors ${met ? "text-green-600" : "text-gray-300"}`}
    >
      <div
        className={`w-2 h-2 rounded-full transition-all ${met ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-gray-200"}`}
      />
      {text}
    </div>
  );
}

/**
 * PassInput: Un cuadro de texto especial para contraseñas que permite ver/ocultar los puntos.
 */
function PassInput({
  placeholder,
  show,
  setShow,
  value,
  onChange,
  isValidMatch,
}) {
  let borderColor = "border-jw-border";
  if (isValidMatch === true) borderColor = "border-green-500 bg-green-50";
  if (isValidMatch === false) borderColor = "border-red-500 bg-red-50";
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-3 rounded-xl border-2 ${borderColor} outline-none text-sm focus:ring-2 focus:ring-jw-blue text-jw-navy transition-all`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-inline-end-3 top-3 text-gray-400 hover:text-jw-blue transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/**
 * EditableRow: Una fila elegante que muestra un dato y tiene un botón de "Modificar".
 */
function EditableRow({ label, value, icon, onEdit }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-4 gap-3">
      <div className="flex items-center gap-4 text-start">
        <div className="p-2.5 bg-slate-300 rounded-xl text-gray-600 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-600 uppercase tracking-widest mb-0.5">
            {label}
          </p>
          <p className="text-sm sm:text-base text-jw-navy font-semibold truncate">
            {value}
          </p>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="w-full sm:w-auto bg-slate-200 px-5 py-2.5 sm:px-4 sm:py-2 rounded-xl text-jw-blue font-bold text-[11px] hover:bg-jw-blue hover:text-white transition-all duration-300 hover:scale-105 active:scale-95 uppercase tracking-widest border border-jw-border sm:border-transparent hover:border-jw-blue italic shadow-sm sm:shadow-none"
      >
        {t("profile_btn_modify")}
      </button>
    </div>
  );
}

// ==========================================================
// --- COMPONENTE PRINCIPAL (LA PÁGINA ENTERA) ---
// ==========================================================

function ProfilePage() {
  // --- BLOQUE 1: CONFIGURACIÓN E IDIOMAS ---
  const { t, i18n, ready } = useTranslation(); // Herramienta para traducir textos
  
  const { user: session, login, logout } = useContext(AppContext); // Datos de la persona conectada
  const user = session?.user || session;
  const navigate = useNavigate(); // Herramienta para moverse entre páginas
  const fileInputRef = useRef(null); // Referencia oculta para el selector de archivos
  const scrollRef = useRef(null); // Referencia para mover la galería de fotos

  // Enlace base para las imágenes de perfil en la nube
  const urlBase =
    "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  // --- BLOQUE 2: ESTADOS (LA MEMORIA DE LA PÁGINA) ---
  const [loading, setLoading] = useState(false); // Indica si el sistema está trabajando
  const [editingField, setEditingField] = useState(null); // Qué campo estamos cambiando ahora
  const [verificationStep, setVerificationStep] = useState(0); // En qué paso de seguridad estamos
  const [pin, setPin] = useState(""); // El código secreto que escribe el usuario
  const [modal, setModal] = useState({
    show: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [seguridadDate, setSeguridadDate] = useState(""); // Fecha traducida de seguridad
  const [imgTimestamp, setImgTimestamp] = useState(Date.now()); // Para refrescar la foto al instante
  const [toast, setToast] = useState(false); // Pequeño aviso flotante

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formValues, setFormValues] = useState({
    newValue: "",
    currentPass: "",
    confirmPass: "",
    adminNote: "",
    descripcionLarga: "",
  });
  const [usernameExists, setUsernameExists] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [reqs, setReqs] = useState({
    length: false,
    upper: false,
    number: false,
    symbol: false,
  });
  const [showAdminBroadcast, setShowAdminBroadcast] = useState(false);
  const [avatarGender, setAvatarGender] = useState(null);
  const [showGallery, setShowGallery] = useState(true);

  // --- BLOQUE 3: FUNCIONES DE CARGA Y SEGURIDAD ---

  // Se ejecuta al abrir la página: busca la fecha de seguridad y la traduce
  useEffect(() => {
    axios
      .get("/api/seguridad-info")
      .then((res) => {
        const date = new Date(res.data.updated_at);
        setSeguridadDate(
          date.toLocaleDateString(i18n.language, {
            // Localización dinámica de fecha
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
      })
      .catch(() => setSeguridadDate(t("profile_not_available")));

    if (window.location.hash === "#seguridad") {
      const element = document.getElementById("seguridad");
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "instant", block: "start" });
        }, 0);
      }
    }
  }, [i18n.language, t]);

  // Revisa si el nombre de usuario ya está ocupado mientras escribes
  useEffect(() => {
    if (editingField === "username" && formValues.newValue.length > 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(
            `/api/check-username?username=${formValues.newValue}&persona_id=${user.persona_id}`,
          );
          setUsernameExists(res.data.exists);
          setSuggestions(res.data.suggestions || []);
        } catch {
          console.error("Error validando usuario");
        }
      }, 400);
      return () => clearTimeout(delay);
    }
  }, [formValues.newValue, editingField, user?.persona_id]);

  if (!ready) return null; // Si el idioma no cargó, esperamos un milisegundo antes de renderizar

  // --- BLOQUE 4: ACCIONES (CAMBIAR DATOS, SUBIR FOTOS) ---

  const validateRequirements = (val) => {
    setReqs({
      length: val.length >= 8,
      upper: /[A-Z]/.test(val),
      number: /[0-9]/.test(val),
      symbol: /[^a-zA-Z0-9]/.test(val),
    });
  };

  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}${"*".repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
  };

  const isPassStrong = (p) => {
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasNum = /[0-9]/.test(p);
    const hasSym = /[^a-zA-Z0-9]/.test(p);
    return hasLen && hasUpper && hasNum && hasSym;
  };

  // --- MANEJADORES DE ACCIONES ---
  const handleEditClick = (field) => {
    setEditingField(field);
    setVerificationStep(field === "eliminar_cuenta" ? 1 : 2);
    setPin("");
    setReqs({ length: false, upper: false, number: false, symbol: false });
    let initialVal = "";
    if (field === "contacto")
      initialVal = (user.contacto || "").replace(/\D/g, "");
    if (field === "email") initialVal = user.email || "";
    setFormValues({
      ...formValues,
      newValue: initialVal,
      currentPass: "",
      confirmPass: "",
    });
  };

  // Envía un PIN secreto al correo para verificar que eres tú
  const handleSendCode = async () => {
    setLoading(true);
    try {
      await axios.post("/api/request-pin", {
        email: user.email,
        username: user.username,
        congregacion: user.congregacion_nombre,
      });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
      setVerificationStep(3);
    } catch {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: t("profile_error_pin_send"),
      });
    } finally {
      setLoading(false);
    }
  };

  // Revisa si el código que escribiste es el correcto
  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await axios.post("/api/verify-pin", { pin });
      setVerificationStep(4);
    } catch {
      setModal({
        show: true,
        type: "error",
        title: t("profile_verify_title"),
        message: t("profile_error_pin_invalid"),
      });
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIÓN REFORZADA (SEGURIDAD ELITE): Subir una foto real ---
  const handleUpdateImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // VALIDACIÓN DE SEGURIDAD 2026:
    // Solo permitimos imágenes y prohibimos archivos de más de 5 Megas
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: "Solo se admiten imágenes JPG, PNG o WebP.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: "La imagen es demasiado grande (Máximo 5MB).",
      });
      return;
    }

    setLoading(true);
    try {
      const token = session?.token;
      if (!token) throw new Error("Sesión expirada");

      // Comprimimos la imagen para que el sitio sea rápido
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 500,
        useWebWorker: true,
      };
      const compressed = await imageCompression(file, options);
      const fileName = `perfil_${user.persona_id}.jpg`;

      // Subida a la nube
      await supabase.storage
        .from("People_profile")
        .upload(fileName, compressed, { upsert: true });

      await axios.post(
        "/api/upload-foto",
        { persona_id: String(user.persona_id), foto_url: fileName },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setImgTimestamp(Date.now()); // Refrescar visualmente
      login({ foto_url: fileName });
      setModal({
        show: true,
        type: "success",
        title: t("success"),
        message: t("profile_photo_success"),
      });
    } catch {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: t("profile_error_auth"),
      });
    } finally {
      setLoading(false);
    }
  };

  // Elige una ilustración institucional como avatar
  const handleSelectAvatar = (imagePath) => {
    setModal({
      show: true,
      type: "confirm",
      title: t("profile_avatar_confirm_title"),
      message: t("profile_avatar_confirm_msg"),
      onConfirm: async () => {
        setLoading(true);
        setModal({ ...modal, show: false });
        try {
          const token = session?.token;
          await axios.post(
            "/api/upload-foto",
            { persona_id: String(user.persona_id), foto_url: imagePath },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          login({ foto_url: imagePath });
          setImgTimestamp(Date.now());
          setModal({
            show: true,
            type: "success",
            title: t("success"),
            message: t("profile_avatar_success"),
          });
        } catch {
          setModal({
            show: true,
            type: "error",
            title: t("error"),
            message: t("profile_error_auth"),
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Finaliza el cambio de datos (email, clave, etc) en la base de datos
  const processUpdate = async () => {
    setModal({ ...modal, show: false });
    setLoading(true);
    try {
      const cleanValue =
        editingField === "contacto"
          ? formValues.newValue.replace(/\D/g, "")
          : formValues.newValue;
      if (editingField === "password") {
        await axios.post("/api/reset-password", {
          username: user.username,
          current_password: formValues.currentPass,
          new_password: formValues.newValue,
          persona_id: String(user.persona_id),
        });
      } else {
        await axios.post("/api/update-profile", {
          persona_id: String(user.persona_id),
          usuario_id: user.id || "",
          campo: editingField,
          valor: cleanValue,
        });
      }
      login({ ...user, [editingField]: cleanValue });
      setModal({
        show: true,
        type: "success",
        title: t("done"),
        message: t("profile_update_success"),
      });
      setEditingField(null);
      setVerificationStep(0);
    } catch (err) {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message:
          err.response?.status === 401
            ? t("profile_error_pass")
            : t("profile_error_save"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = () => {
    if (editingField === "password") {
      if (!isPassStrong(formValues.newValue)) {
        setModal({
          show: true,
          type: "error",
          title: t("error"),
          message: t("profile_error_strong_pass"),
        });
        return;
      }
      if (formValues.newValue !== formValues.confirmPass) {
        setModal({
          show: true,
          type: "error",
          title: t("error"),
          message: t("profile_error_match_pass"),
        });
        return;
      }
    }
    processUpdate();
  };

  const handlePublicarUpdate = async () => {
    setModal({ ...modal, show: false });
    setLoading(true);
    try {
      await axios.post("/api/broadcast-seguridad", {
        titulo: formValues.adminNote,
        descripcion_larga: formValues.descripcionLarga,
      });
      setModal({
        show: true,
        type: "success",
        title: t("profile_broadcast_success_title"),
        message: t("profile_broadcast_success_msg"),
      });
      setFormValues({ ...formValues, adminNote: "", descripcionLarga: "" });
      setShowAdminBroadcast(false);
    } catch {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: t("profile_error_broadcast"),
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerConfirmPublicar = () => {
    if (!formValues.adminNote || !formValues.descripcionLarga) {
      setModal({
        show: true,
        type: "error",
        title: t("incomplete"),
        message: t("profile_error_incomplete"),
      });
      return;
    }
    setModal({
      show: true,
      type: "confirm",
      title: t("profile_confirm_broadcast_title"),
      message: t("profile_confirm_broadcast_msg"),
      onConfirm: handlePublicarUpdate,
    });
  };

  const processDeleteAccountFinal = async () => {
    setLoading(true);
    try {
      await axios.post("/api/suspender-cuenta", {
        persona_id: String(user.persona_id),
        usuario_id: user.id || "",
      });
      logout();
      navigate("/login");
    } catch {
      setModal({
        show: true,
        type: "error",
        title: t("error"),
        message: t("profile_error_deactivate"),
      });
    } finally {
      setLoading(false);
    }
  };

  // --- BLOQUE 5: DISEÑO Y VISTA (EL HTML) ---

  // Formulario pequeño que aparece al editar
  const renderEditForm = () => {
    const passwordsMatch =
      formValues.newValue === formValues.confirmPass &&
      formValues.confirmPass !== "";
    return (
      <div className="mt-4 p-6 rounded-2xl border bg-jw-body border-jw-border animate-in slide-in-from-top-4">
        <div className="flex items-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-widest italic text-green-600">
          <ShieldCheck size={14} /> {t("profile_edit_verified")}
        </div>
        <div className="space-y-4 max-w-md text-start">
          <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic tracking-tight">
            {t("profile_edit_modify")} {t(`profile_${editingField}_label`)}
          </h3>
          {editingField === "password" ? (
            <div className="space-y-4">
              <PassInput
                placeholder={t("profile_edit_placeholder_current")}
                show={showCurrent}
                setShow={setShowCurrent}
                value={formValues.currentPass}
                onChange={(val) =>
                  setFormValues({ ...formValues, currentPass: val })
                }
              />
              <div className="space-y-2">
                <PassInput
                  placeholder={t("profile_edit_placeholder_new")}
                  show={showNew}
                  setShow={setShowNew}
                  value={formValues.newValue}
                  onChange={(val) => {
                    setFormValues({ ...formValues, newValue: val });
                    validateRequirements(val); // Usamos la función que ya definiste arriba para mantener el código limpio
                  }}
                />

                <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <ReqItem met={reqs.length} text={t("profile_edit_req_len")} />
                  <ReqItem
                    met={reqs.upper}
                    text={t("profile_edit_req_upper")}
                  />
                  <ReqItem met={reqs.number} text={t("profile_edit_req_num")} />
                  <ReqItem met={reqs.symbol} text={t("profile_edit_req_sym")} />
                </div>
              </div>
              <PassInput
                placeholder={t("profile_edit_placeholder_confirm")}
                show={showConfirm}
                setShow={setShowConfirm}
                value={formValues.confirmPass}
                onChange={(val) =>
                  setFormValues({ ...formValues, confirmPass: val })
                }
                isValidMatch={
                  formValues.confirmPass === "" ? null : passwordsMatch
                }
              />
            </div>
          ) : editingField === "username" ? (
            <div className="space-y-4">
              <input
                type="text"
                className={`w-full p-4 rounded-2xl border-2 transition-all outline-none ${usernameExists ? "border-orange-400 bg-orange-50 text-jw-navy" : "border-jw-blue bg-white text-jw-navy"}`}
                placeholder={t("profile_edit_placeholder_user")}
                value={formValues.newValue}
                onChange={(e) => {
                  setFormValues({ ...formValues, newValue: e.target.value });
                  validateRequirements(e.target.value);
                }}
              />
              <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <ReqItem met={reqs.length} text={t("profile_edit_req_len")} />
                <ReqItem met={reqs.upper} text={t("profile_edit_req_upper")} />
                <ReqItem met={reqs.number} text={t("profile_edit_req_num")} />
                <ReqItem met={reqs.symbol} text={t("profile_edit_req_sym")} />
              </div>
              {usernameExists && (
                <div className="bg-orange-100 p-4 rounded-2xl border border-orange-200">
                  <p className="text-orange-800 text-[11px] font-bold mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> {t("profile_edit_suggestions")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setFormValues({ ...formValues, newValue: s });
                          validateRequirements(s);
                          setUsernameExists(false);
                        }}
                        className="bg-white text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-300"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <input
              type={editingField === "email" ? "email" : "text"}
              className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none focus:ring-2 focus:ring-jw-blue text-jw-navy"
              value={formValues.newValue}
              onChange={(e) =>
                setFormValues({
                  ...formValues,
                  newValue:
                    editingField === "contacto"
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value,
                })
              }
            />
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveClick}
              disabled={
                loading || (editingField === "username" && usernameExists)
              }
              className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-xs uppercase hover:bg-jw-navy transition-all duration-300 hover:scale-105 active:scale-95 shadow-md"
            >
              {t("profile_edit_btn_confirm")}
            </button>
            <button
              onClick={() => {
                setEditingField(null);
                setVerificationStep(0);
              }}
              className="p-3 text-gray-400 text-xs font-bold uppercase transition-all duration-300 hover:scale-105 active:scale-95 hover:text-jw-navy"
            >
              {t("profile_edit_btn_cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-transparent min-h-screen py-10 px-4 relative font-sans text-start text-jw-navy transition-colors duration-700">
      {/* BLOQUE SEO: Control de cabeceras para buscadores e IA */}
      <Helmet>
        <html lang={i18n.language} /> {/* CRÍTICO PARA SEO 2026 */}
        <title>{t("profile_title")} | Gestión Local Teocrática</title>
        <meta
          name="description"
          content="Panel de administración de cuenta, seguridad digital y perfil institucional."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {toast && (
        <div className="fixed top-20 inset-inline-start-1/2 -translate-x-1/2 z-[200] bg-jw-blue text-white px-6 sm:px-8 py-3 rounded-full shadow-2xl animate-bounce text-[12px] sm:text-sm font-bold uppercase whitespace-nowrap">
          {t("profile_toast_sent")}
        </div>
      )}

      <Modal
        isOpen={modal.show}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onClose={() => setModal({ ...modal, show: false })}
      />

      {/* VENTANA DE SEGURIDAD (MFA) */}
      {editingField && verificationStep < 4 && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-jw-navy/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-[360px] w-full overflow-hidden border border-jw-border/50 animate-in zoom-in-95 duration-300">
            <div className="pt-8 pb-4 text-center">
              <div className="w-14 h-14 bg-jw-body rounded-2xl flex items-center justify-center mx-auto mb-4 border border-jw-border shadow-sm">
                <Lock className="w-6 h-6 text-jw-blue" />
              </div>
              <h3 className="text-base sm:text-sm font-black italic tracking-[0.2em] uppercase text-jw-navy">
                {t("profile_verify_title")}
              </h3>
            </div>

            <div className="px-8 sm:px-10 pb-10 text-center">
              {verificationStep === 1 ? (
                <div className="space-y-5">
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="mt-2 mb-1 text-start">
                      <span className="text-[13px] font-black text-red-500 uppercase tracking-[0.2em] block mb-0 ms-0">
                        {t("profile_verify_warning")}
                      </span>
                      <div className="relative inline-block">
                        <p className="text-xs sm:text-[13px] leading-tight font-medium uppercase tracking-tighter text-red-700 pb-1">
                          {t("profile_verify_deactivate_note")}
                        </p>
                        <Motion.div
                          className="absolute bottom-0 inset-inline-start-0 h-[2.5px] bg-red-600 rounded-full"
                          initial={{ width: "30%", left: "0%" }}
                          animate={{ left: ["0%", "70%", "0%"] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setVerificationStep(2)}
                    className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    {t("profile_verify_continue")}
                  </button>
                </div>
              ) : verificationStep === 2 ? (
                <div className="space-y-6">
                  <p className="text-sm sm:text-[15px] text-gray-400 font-medium leading-relaxed italic">
                    {t("profile_verify_send_note")}
                    <br />
                    <span className="text-jw-blue font-black not-italic text-base sm:text-xs">
                      {maskEmail(user?.email)}
                    </span>
                  </p>
                  <button
                    onClick={handleSendCode}
                    disabled={loading}
                    className="w-full bg-jw-blue text-white py-3.5 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-widest hover:bg-jw-navy transition-all shadow-lg shadow-blue-100"
                  >
                    {t("profile_verify_btn_pin")}
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <p className="text-xs sm:text-[13px] text-gray-400 font-black uppercase tracking-widest mb-4">
                      {t("profile_verify_enter_code")}
                    </p>
                    <input
                      type="text"
                      maxLength="6"
                      value={pin}
                      className="w-full text-center text-3xl sm:text-3xl tracking-[0.4em] font-medium py-3 bg-jw-body rounded-2xl border-2 border-jw-border focus:border-jw-blue outline-none text-jw-navy transition-all"
                      onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </div>
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || pin.length < 6}
                    className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    {loading
                      ? t("profile_verify_status_verifying")
                      : t("profile_verify_btn_now")}
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setEditingField(null);
                  setVerificationStep(0);
                }}
                className="mt-6 text-gray-600 hover:text-red-400 text-[13px] sm:text-[13px] font-black uppercase tracking-widest transition-colors"
              >
                {t("profile_verify_cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL DE CONTROL CENTRAL */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* SECCIÓN 1: ADMINISTRACIÓN - DATOS DE ACCESO */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3">
              <Shield className="w-9 h-9 text-slate-400" /> {t("profile_title")}
            </h2>
          </div>
          <div className="p-8 space-y-6 text-sm">
            <div className="pb-4 border-b border-gray-50 opacity-60">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-gray-200 rounded-xl text-gray-700">
                  <Hash size={25} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-700 uppercase">
                    {t("profile_personal_id")}
                  </p>
                  <p className="text-base text-jw-navy font-mono">
                    #{user?.persona_id}
                  </p>
                </div>
              </div>
            </div>
            <div className="pb-4 border-b border-gray-50 opacity-60">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-gray-200 rounded-xl text-gray-700">
                  <UserCircle size={25} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-700 uppercase">
                    {t("profile_active_user")}
                  </p>
                  <p className="text-base text-jw-navy font-medium">
                    @{user?.username}
                  </p>
                </div>
              </div>
            </div>
            <div className="group">
              <EditableRow
                label={t("profile_user_label")}
                value={t("profile_change_alias")}
                icon={<UserCircle size={25} />}
                onEdit={() => handleEditClick("username")}
              />
              {editingField === "username" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
            <div className="group">
              <EditableRow
                label={t("profile_email_label")}
                value={user?.email}
                icon={<Mail size={25} />}
                onEdit={() => handleEditClick("email")}
              />
              {editingField === "email" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
            <div className="group">
              <EditableRow
                label={t("profile_phone_label")}
                value={user?.contacto || t("profile_not_loaded")}
                icon={<Phone size={25} />}
                onEdit={() => handleEditClick("contacto")}
              />
              {editingField === "contacto" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
            <div className="group">
              <EditableRow
                label={t("profile_password_label")}
                value="••••••••••••"
                icon={<Key size={25} />}
                onEdit={() => handleEditClick("password")}
              />
              {editingField === "password" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: SEGURIDAD DIGITAL*/}
        <section
          id="seguridad"
          className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden scroll-mt-20"
        >
          <div className="p-8 text-start">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-jw-body p-6 rounded-2xl border border-jw-border">
              <div className="text-start flex-1">
                <h3 className="text-jw-navy font-medium flex items-center gap-2 leading-tight text-base sm:text-lg">
                  <FileText className="w-5 h-5 text-jw-blue" />{" "}
                  {t("profile_sec_title")}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-medium italic">
                  {t("profile_sec_last_review")} {seguridadDate}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/seguridad-tips")}
                  className="bg-jw-blue text-white px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 shadow-md uppercase"
                >
                  {t("profile_sec_btn_tips")} <ArrowRight className="w-4 h-4" />
                </button>
                {user?.es_admin_local && (
                  <button
                    onClick={() => setShowAdminBroadcast(!showAdminBroadcast)}
                    className={`p-2.5 rounded-lg transition-all duration-300 hover:scale-110 active:scale-90 ${showAdminBroadcast ? "bg-amber-100 text-amber-600 rotate-180" : "bg-gray-100 text-gray-400"}`}
                    title={t("profile_sec_admin_broadcast")}
                  >
                    <ChevronDown size={20} />
                  </button>
                )}
              </div>
            </div>
            {user?.es_admin_local && showAdminBroadcast && (
              <div className="mt-8 p-8 bg-amber-50 border-2 border-dashed border-amber-200 rounded-[2rem] animate-in slide-in-from-top-4 duration-500 text-start">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-inner">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-amber-900 font-black text-sm uppercase tracking-tighter">
                      {t("profile_sec_admin_broadcast")}
                    </h3>
                    <p className="text-[10px] text-amber-600 font-bold uppercase italic tracking-widest leading-none">
                      {t("profile_sec_admin_only")}
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase ms-2 mb-1 block">
                      {t("profile_sec_admin_label_title")}
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-amber-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white font-bold"
                      placeholder="..."
                      value={formValues.adminNote}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          adminNote: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase ms-2 mb-1 block">
                      {t("profile_sec_admin_label_html")}
                    </label>
                    <textarea
                      className="w-full p-6 rounded-3xl border border-amber-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white font-light min-h-[250px]"
                      placeholder="..."
                      value={formValues.descripcionLarga}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          descripcionLarga: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={triggerConfirmPublicar}
                    disabled={loading}
                    className="w-full bg-amber-600 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-amber-700 flex items-center justify-center gap-3 transition-all active:scale-95 shadow-amber-200"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Mail size={20} />
                    )}{" "}
                    {t("profile_sec_admin_btn_publish")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 3: GALERÍA DE AVATARES */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden text-jw-navy">
          <div className="p-5 bg-jw-navy text-white border-b-3 border-jw-blue flex justify-between items-center">
            <h2 className="text-lg font-normal italic flex items-center gap-3 text-start">
              <UserRoundPlus className="w-9 h-9 text-slate-400" />{" "}
              {t("profile_avatar_title")}
            </h2>
            <button
              onClick={() => setShowGallery(!showGallery)}
              className="p-2 hover:bg-white/10 rounded-full transition-all"
            >
              {showGallery ? (
                <ChevronUp size={24} />
              ) : (
                <ChevronDown size={24} />
              )}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showGallery && (
              <Motion.div
                initial={false}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 space-y-1">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2 mb-1 mt-4">
                      <span className="text-[12px] sm:text-[19px] tracking-[0.2em] uppercase text-jw-navy/70 font-normal border-b sm:border-b-0 sm:border-s border-jw-navy/10 pb-2 sm:pb-0 sm:ps-6 leading-none text-center">
                        {t("profile_avatar_subtitle")}
                      </span>
                      <div className="flex gap-2 sm:gap-3">
                        <button
                          onClick={() => setAvatarGender("male")}
                          className={`px-4 sm:px-6 py-2 rounded-full text-[12px] sm:text-[15px] tracking-[0.15em] transition-all duration-150 border-2 ${avatarGender === "male" ? "bg-jw-navy border-jw-navy text-white" : "bg-white border-slate-300"}`}
                        >
                          {t("profile_avatar_male")}
                        </button>
                        <button
                          onClick={() => setAvatarGender("female")}
                          className={`px-4 sm:px-6 py-2 rounded-full text-[12px] sm:text-[15px] tracking-[0.15em] transition-all duration-150 border-2 ${avatarGender === "female" ? "bg-jw-navy border-jw-navy text-white" : "bg-white border-slate-300"}`}
                        >
                          {t("profile_avatar_female")}
                        </button>
                      </div>
                    </div>
                  </div>
                  {avatarGender && (
                    <div className="relative group/gallery">
                      <button
                        onClick={() =>
                          scrollRef.current?.scrollBy({
                            left: i18n.dir() === "rtl" ? 320 : -320,
                            behavior: "smooth",
                          })
                        }
                        className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-white shadow-xl rounded-full text-jw-blue hover:bg-jw-blue hover:text-white transition-all -ms-2 border border-gray-100"
                      >
                        <ChevronLeft
                          size={24}
                          className={i18n.dir() === "rtl" ? "rotate-180" : ""}
                        />
                      </button>
                      <button
                        onClick={() =>
                          scrollRef.current?.scrollBy({
                            left: i18n.dir() === "rtl" ? -320 : 320,
                            behavior: "smooth",
                          })
                        }
                        className="absolute inset-inline-end-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-white shadow-xl rounded-full text-jw-blue hover:bg-jw-blue hover:text-white transition-all -me-2 border border-gray-100"
                      >
                        <ChevronRight
                          size={24}
                          className={i18n.dir() === "rtl" ? "rotate-180" : ""}
                        />
                      </button>
                      <div
                        ref={scrollRef}
                        className="flex overflow-x-auto gap-10 py-12 no-scrollbar scroll-smooth px-10"
                      >
                        {Array.from({ length: 15 }).map((_, i) => {
                          const index = i + 1;
                          const folder =
                            avatarGender === "male" ? "hombres" : "mujeres";
                          const imgName =
                            avatarGender === "male"
                              ? `hombre_${index}.webp`
                              : `mujer_${index}.webp`;
                          const fullPath = `/avatars/${folder}/${imgName}`;
                          return (
                            <div
                              key={index}
                              className="flex-shrink-0 flex flex-col items-center gap-4"
                            >
                              <div className="relative group">
                                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-jw-body border-[6px] border-white shadow-2xl overflow-hidden cursor-pointer flex items-center justify-center">
                                  <Motion.div
                                    className="w-full h-full"
                                    animate={{
                                      rotate: [0, 1, -1, 0],
                                      y: [0, -3, 0],
                                      scale: [1, 1.02, 1],
                                    }}
                                    transition={{
                                      duration: 4,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                      delay: i * 0.2,
                                    }}
                                  >
                                    <img
                                      src={fullPath}
                                      alt={`Avatar ${index}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      width="160"
                                      height="160"
                                    />
                                  </Motion.div>
                                </div>
                                <button
                                  onClick={() => handleSelectAvatar(fullPath)}
                                  className="absolute inset-0 bg-jw-navy/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                                >
                                  <CheckCircle2
                                    className="text-white mb-2"
                                    size={32}
                                  />
                                  <span className="text-white text-[10px] font-black uppercase tracking-widest bg-jw-blue px-4 py-1.5 rounded-full">
                                    {t("profile_avatar_btn_set")}
                                  </span>
                                </button>
                              </div>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">
                                {t("profile_avatar_inst")} {index}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* SECCIÓN 4: ZONA DE PELIGRO */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-red-600 text-white border-b-4 border-red-800 text-start">
            <h2 className="text-lg font-bold italic flex items-center gap-3">
              <Trash2 className="w-9 h-9 text-slate-300" />{" "}
              {t("profile_danger_title")}
            </h2>
          </div>
          <div className="p-8 text-jw-navy text-start">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-red-600 uppercase italic leading-tight">
                  {t("profile_danger_label")}
                </h3>
                <p className="text-xs text-gray-400 font-light italic mt-1 leading-tight">
                  {t("profile_danger_desc")}
                </p>
              </div>
              <button
                onClick={() => handleEditClick("eliminar_cuenta")}
                className="w-full sm:w-auto bg-red-50 text-red-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200 transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-red-600 hover:text-white shadow-sm italic"
              >
                {t("profile_danger_btn")}
              </button>
            </div>
            {editingField === "eliminar_cuenta" && verificationStep === 4 && (
              <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-3xl animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 mb-4 text-red-600 font-bold text-[10px] uppercase italic">
                  <ShieldCheck size={14} /> {t("profile_edit_verified")}
                </div>
                <p className="text-red-800 text-sm font-light italic mb-6 leading-relaxed">
                  {t("profile_danger_final_confirm_msg")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={processDeleteAccountFinal}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white p-4 rounded-xl font-black text-[11px] uppercase shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-red-700"
                  >
                    {t("profile_danger_final_confirm")}
                  </button>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setVerificationStep(0);
                    }}
                    className="p-4 text-gray-400 font-bold uppercase text-[10px] transition-all duration-300 hover:scale-105 active:scale-95 hover:text-jw-navy"
                  >
                    {t("profile_edit_btn_cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 5: PERFIL PÚBLICO (DATOS DE LA BASE DE DATOS) */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden text-jw-navy">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue text-start">
            <h2 className="text-lg font-light italic flex items-center gap-3">
              <User className="w-9 h-9 text-slate-400" />{" "}
              {t("profile_pub_title")}
            </h2>
          </div>
          <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start text-start">
            <div className="relative">
              <div className="w-44 h-44 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                {loading ? (
                  <Loader2 className="w-10 h-10 text-jw-blue animate-spin" />
                ) : user?.foto_url ? (
                  <img
                    key={`${user.foto_url}-${imgTimestamp}`}
                    src={
                      user.foto_url.startsWith("/avatars/")
                        ? `${user.foto_url}?v=${imgTimestamp}`
                        : `${urlBase}${user.foto_url}?v=${imgTimestamp}`
                    }
                    alt="Perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpdateImage}
                className="hidden"
                accept="image/*"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute bottom-2 inset-inline-end-2 bg-jw-blue text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-90 shadow-blue-500/50"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 pt-4 w-full">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("profile_pub_name")}
                </label>
                <p className="text-2xl font-medium leading-tight">
                  {user?.nombre_completo}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-jw-blue italic">
                  {t("profile_pub_cong")}
                </label>
                <p className="text-lg font-medium text-gray-700 leading-tight mb-4">
                  {user?.congregacion_nombre}{" "}
                  <span className="text-gray-400 font-light">
                    ({user?.numero_congregacion})
                  </span>
                </p>
                <div className="space-y-3 mt-4 border-s-4 border-jw-blue/10 ps-5 text-start">
                  <AddressLine
                    icon={<MapPin />}
                    value={user?.direccion}
                    label={t("profile_pub_label_street")}
                  />
                  <AddressLine
                    icon={<Building2 />}
                    value={user?.ciudad}
                    label={t("profile_pub_label_locality")}
                  />
                  <AddressLine
                    icon={<Map />}
                    value={user?.partido}
                    label={t("profile_pub_label_city")}
                  />
                  <AddressLine
                    icon={<Landmark />}
                    value={user?.provincia}
                    label={t("profile_pub_label_province")}
                  />
                  <AddressLine
                    icon={<Globe2 />}
                    value={user?.pais}
                    label={t("profile_pub_label_country")}
                  />
                  <AddressLine
                    icon={<Globe />}
                    value={user?.region}
                    label={t("profile_pub_label_region")}
                  />
                </div>
              </div>
              <div className="bg-jw-body p-6 rounded-2xl border flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-jw-blue mt-1" />
                <div className="text-[13px] text-gray-600 leading-relaxed italic">
                  <p className="font-bold not-italic text-jw-navy mb-1 leading-tight text-sm">
                    {t("profile_pub_help_title")}
                  </p>
                  {t("profile_pub_help_text")}{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    {t("profile_pub_help_coord")}
                  </span>
                  ,{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    {t("profile_pub_help_sec")}
                  </span>{" "}
                  {t("profile_pub_help_or") || "o"}{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    {t("profile_pub_help_service")}
                  </span>{" "}
                  {t("profile_pub_help_suffix")}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// COMPONENTE MINIMALISTA PARA LAS LÍNEAS DE DIRECCIÓN
function AddressLine({ icon, value, label }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-slate-800 py-0.5 text-start">
      <span className="text-jw-blue shrink-0 opacity-90">
        {React.cloneElement(icon, { size: 18 })}
      </span>
      <p className="text-sm font-semibold italic leading-tight">
        {value}{" "}
        <span className="text-[10px] text-slate-500 not-italic font-black ms-1 uppercase tracking-tighter">
          ({label})
        </span>
      </p>
    </div>
  );
}

export default ProfilePage;
