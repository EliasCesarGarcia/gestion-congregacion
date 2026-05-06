/**
 * ARCHIVO: ProfilePage.jsx
 * UBICACIÓN: frontend/src/pages/ProfilePage.jsx
 * DESCRIPCIÓN: Panel de administración centralizado del usuario.
 * Gestiona la identidad digital, seguridad, preferencias de avatar institucional
 * y la integridad de la cuenta.
 * Implementa optimizaciones de imagen (compresión y formato WebP) y
 * flujos de verificación de identidad de doble factor (PIN por correo).
 */

import React, { useContext, useState, useRef, useEffect } from "react";
import { AppContext } from "../context/AppContext";

// Iconografía institucional
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
  XCircle,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  Building2,
  Map,
  Landmark,
  Globe2,
  Compass,
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  UserRoundPlus,
  Glasses,
} from "lucide-react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";
import axios from "axios";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";

// --- COMPONENTES AUXILIARES DE INTERFAZ ---

/**
 * ReqItem: Muestra los requisitos de validación de contraseña.
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
 * PassInput: Campo de entrada especializado para contraseñas con visibilidad conmutable.
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
        className="absolute right-3 top-3 text-gray-400 hover:text-jw-blue transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/**
 * EditableRow: Fila de datos que permite disparar el flujo de edición.
 */
function EditableRow({ label, value, icon, onEdit }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-4 gap-3">
      <div className="flex items-center gap-4 text-left">
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
        Modificar
      </button>
    </div>
  );
}

// ==========================================================
// --- COMPONENTE PRINCIPAL: ProfilePage ---
// ==========================================================

function ProfilePage() {
  // --- 1. GESTIÓN DE SESIÓN Y DATOS (Nesting Fix aplicado) ---
  const { user: session, login, logout } = useContext(AppContext);

  // Extraemos los datos reales del usuario (session.user) o usamos la raíz si ya vienen directos
  const user = session?.user || session;

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // URL Base para imágenes almacenadas en Supabase Storage
  const urlBase =
    "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  // --- 2. ESTADOS DINÁMICOS ---
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null); // Campo que se está modificando
  const [verificationStep, setVerificationStep] = useState(0); // Control del flujo de PIN
  const [pin, setPin] = useState(""); // Almacena el código ingresado por el usuario
  const [modal, setModal] = useState({
    show: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [seguridadDate, setSeguridadDate] = useState("");
  const [imgTimestamp, setImgTimestamp] = useState(Date.now()); // Para forzar refresco de caché de imagen
  const [toast, setToast] = useState(false); // Feedback visual rápido

  // Estados para visibilidad de contraseñas
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Valores de los formularios de edición
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

  // Estados de la Galería de Avatares locales
  const [avatarGender, setAvatarGender] = useState(null);
  const [showGallery, setShowGallery] = useState(true);

  // --- 3. LÓGICA DE CARGA INICIAL ---
  useEffect(() => {
    // Obtiene la fecha de la última actualización de seguridad del sistema
    axios
      .get("/api/seguridad-info")
      .then((res) => {
        const date = new Date(res.data.updated_at);
        setSeguridadDate(
          date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
      })
      .catch(() => setSeguridadDate("No disponible"));

    // Manejo de anclaje directo a la sección de seguridad
    if (window.location.hash === "#seguridad") {
      const element = document.getElementById("seguridad");
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "instant", block: "start" });
        }, 0);
      }
    }
  }, []);

  // --- 4. VALIDACIONES Y UTILIDADES ---

  /**
   * Valida disponibilidad de nombre de usuario en tiempo real (Debounce manual).
   */
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

  //const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isPassStrong = (p) => {
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasNum = /[0-9]/.test(p);
    const hasSym = /[^a-zA-Z0-9]/.test(p);
    return hasLen && hasUpper && hasNum && hasSym;
  };

  // --- 5. MANEJADORES DE ACCIONES (API CALLS) ---

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

  /**
   * handleSendCode: Solicita el envío de un PIN de seguridad al correo del usuario.
   */
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
        title: "Error",
        message: "Fallo al enviar PIN.",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleVerifyCode: Valida el PIN para desbloquear el formulario de edición.
   */
  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await axios.post("/api/verify-pin", { pin });
      setVerificationStep(4);
    } catch {
      setModal({
        show: true,
        type: "error",
        title: "PIN Incorrecto",
        message: "PIN inválido o expirado.",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleUpdateImage: Gestiona la carga de fotos reales con compresión en el cliente.
   */
  const handleUpdateImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      // 1. Obtener el token real desde la sesión (No usar sessionStorage directamente aquí)
      const token = session?.token;

      if (!token) {
        console.error("No hay token disponible");
        throw new Error("Sesión expirada");
      }

      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 500,
        useWebWorker: true,
      };
      const compressed = await imageCompression(file, options);
      const fileName = `perfil_${user.persona_id}.jpg`;

      // 2. Subida a Supabase
      await supabase.storage
        .from("People_profile")
        .upload(fileName, compressed, { upsert: true });

      // 3. Notificar al Backend con el Token EXPLÍCITO
      await axios.post(
        "/api/upload-foto",
        {
          persona_id: String(user.persona_id),
          foto_url: fileName,
        },
        {
          headers: { Authorization: `Bearer ${token}` }, // <--- AQUÍ ESTABA EL ERROR
        },
      );

      setImgTimestamp(Date.now());
      login({ foto_url: fileName });

      setModal({
        show: true,
        type: "success",
        title: "¡Éxito!",
        message: "Foto actualizada correctamente.",
      });
    } catch (err) {
      console.error("Error detallado:", err);
      setModal({
        show: true,
        type: "error",
        title: "Error de Permisos",
        message:
          "No se pudo actualizar. Por seguridad, cierra sesión y vuelve a entrar.",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * handleSelectAvatar: Establece una imagen WebP de la carpeta local como foto de perfil.
   */
  const handleSelectAvatar = (imagePath) => {
    setModal({
      show: true,
      type: "confirm",
      title: "¿Establecer avatar?",
      message: "¿Deseas usar esta ilustración como foto de perfil?",
      onConfirm: async () => {
        setLoading(true);
        setModal({ ...modal, show: false }); // Cerrar el confirm
        try {
          const token = session?.token; // Obtener token del contexto

          await axios.post(
            "/api/upload-foto",
            {
              persona_id: String(user.persona_id),
              foto_url: imagePath,
            },
            {
              headers: { Authorization: `Bearer ${token}` }, // <--- TOKEN CORREGIDO
            },
          );

          login({ foto_url: imagePath });
          setImgTimestamp(Date.now());

          setModal({
            show: true,
            type: "success",
            title: "¡Éxito!",
            message: "Avatar institucional establecido.",
          });
        } catch (err) {
          console.error("Error en avatar:", err);
          setModal({
            show: true,
            type: "error",
            title: "Error",
            message: "Error de autenticación.",
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /**
   * processUpdate: Ejecuta el cambio final de datos (email, usuario, contacto o clave).
   */
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
        title: "¡Hecho!",
        message: "Actualizado correctamente.",
      });
      setEditingField(null);
      setVerificationStep(0);
    } catch (err) {
      const errMsg =
        err.response?.status === 401
          ? "Clave incorrecta."
          : "Fallo al guardar.";
      setModal({ show: true, type: "error", title: "Error", message: errMsg });
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
          title: "Error",
          message: "La contraseña no cumple los requisitos.",
        });
        return;
      }
      if (formValues.newValue !== formValues.confirmPass) {
        setModal({
          show: true,
          type: "error",
          title: "Error",
          message: "Las contraseñas no coinciden.",
        });
        return;
      }
    }
    processUpdate();
  };

  /**
   * handlePublicarUpdate: Difusión de correos masivos (Solo para Administradores Locales).
   */
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
        title: "¡Difusión Exitosa!",
        message: "Actualización guardada y enviada por email.",
      });
      setFormValues({ ...formValues, adminNote: "", descripcionLarga: "" });
      setShowAdminBroadcast(false);
    } catch {
      setModal({
        show: true,
        type: "error",
        title: "Error",
        message: "Fallo al difundir.",
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
        title: "Incompleto",
        message: "Llene título y descripción.",
      });
      return;
    }
    setModal({
      show: true,
      type: "confirm",
      title: "¿Confirmar Envío?",
      message: "Se enviará un mail masivo a la congregación.",
      onConfirm: handlePublicarUpdate,
    });
  };

  /**
   * processDeleteAccountFinal: Ejecuta la baja lógica de la cuenta.
   */
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
        title: "Error",
        message: "Fallo al desactivar.",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- 6. RENDERIZADO DE COMPONENTES DE VISTA ---

  /**
   * renderEditForm: Dibuja el formulario de edición una vez verificada la identidad.
   */
  const renderEditForm = () => {
    const passwordsMatch =
      formValues.newValue === formValues.confirmPass &&
      formValues.confirmPass !== "";
    return (
      <div className="mt-4 p-6 rounded-2xl border bg-jw-body border-jw-border animate-in slide-in-from-top-4">
        <div className="flex items-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-widest italic text-green-600">
          <ShieldCheck size={14} /> Identidad Verificada
        </div>
        <div className="space-y-4 max-w-md text-left">
          <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic tracking-tight">
            Modificar {editingField}
          </h3>
          {editingField === "password" ? (
            <div className="space-y-4">
              <PassInput
                placeholder="Contraseña Actual"
                show={showCurrent}
                setShow={setShowCurrent}
                value={formValues.currentPass}
                onChange={(val) =>
                  setFormValues({ ...formValues, currentPass: val })
                }
              />
              <div className="space-y-2">
                <PassInput
                  placeholder="Nueva Contraseña"
                  show={showNew}
                  setShow={setShowNew}
                  value={formValues.newValue}
                  onChange={(val) => {
                    setFormValues({ ...formValues, newValue: val });
                    validateRequirements(val);
                  }}
                />
                <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <ReqItem met={reqs.length} text="8+ carac." />
                  <ReqItem met={reqs.upper} text="Mayúscula" />
                  <ReqItem met={reqs.number} text="Número" />
                  <ReqItem met={reqs.symbol} text="Símbolo" />
                </div>
              </div>
              <PassInput
                placeholder="Confirmar Nueva"
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
                placeholder="Nuevo usuario"
                value={formValues.newValue}
                onChange={(e) => {
                  setFormValues({ ...formValues, newValue: e.target.value });
                  validateRequirements(e.target.value);
                }}
              />
              <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <ReqItem met={reqs.length} text="8+ carac." />
                <ReqItem met={reqs.upper} text="Mayúscula" />
                <ReqItem met={reqs.number} text="Número" />
                <ReqItem met={reqs.symbol} text="Símbolo" />
              </div>
              {usernameExists && (
                <div className="bg-orange-100 p-4 rounded-2xl border border-orange-200">
                  <p className="text-orange-800 text-[11px] font-bold mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> No disponible. Sugerencias:
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
              Confirmar Cambio
            </button>
            <button
              onClick={() => {
                setEditingField(null);
                setVerificationStep(0);
              }}
              className="p-3 text-gray-400 text-xs font-bold uppercase transition-all duration-300 hover:scale-105 active:scale-95 hover:text-jw-navy"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-transparent min-h-screen py-10 px-4 relative font-sans text-left text-jw-navy transition-colors duration-700">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-jw-blue text-white px-6 sm:px-8 py-3 rounded-full shadow-2xl animate-bounce text-[12px] sm:text-sm font-bold uppercase whitespace-nowrap">
          ✅ CÓDIGO ENVIADO
        </div>
      )}

      {/* --- MODAL DE SISTEMA --- */}
      <Modal
        isOpen={modal.show}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onClose={() => setModal({ ...modal, show: false })}
      />

      {/* --- POPUP DE VERIFICACIÓN DE SEGURIDAD (MFA) --- */}
      {editingField && verificationStep < 4 && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-jw-navy/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-[360px] w-full overflow-hidden border border-jw-border/50 animate-in zoom-in-95 duration-300">
            {/* Cabecera Minimalista */}
            <div className="pt-8 pb-4 text-center">
              <div className="w-14 h-14 bg-jw-body rounded-2xl flex items-center justify-center mx-auto mb-4 border border-jw-border shadow-sm">
                <Lock className="w-6 h-6 text-jw-blue" />
              </div>
              {/* FUENTE: text-base en móvil, text-sm en PC */}
              <h3 className="text-base sm:text-sm font-black italic tracking-[0.2em] uppercase text-jw-navy">
                Verificación
              </h3>
            </div>

            <div className="px-8 sm:px-10 pb-10 text-center">
              {verificationStep === 1 ? (
                /* Advertencia de Baja de Cuenta */
                <div className="space-y-5">
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    {/* FUENTE: text-xs en móvil, text-[11px] en PC */}
                    <div className="mt-2 mb-1 text-left">
                      {/* Etiqueta de Advertencia superior */}
                      <span className="text-[13px] font-black text-red-500 uppercase tracking-[0.2em] block mb-0 ml-0">
                        ADVERTENCIA:
                      </span>

                      {/* Contenedor del texto y la línea animada */}
                      <div className="relative inline-block">
                        <p className="text-xs sm:text-[13px] leading-tight font-medium uppercase tracking-tighter text-red-700 pb-1">
                          Tu cuenta pasará a estado de "BAJA"
                        </p>

                        {/* Línea roja animada (Scanner) */}
                        <motion.div
                          className="absolute bottom-0 left-0 h-[2.5px] bg-red-600 rounded-full"
                          initial={{ width: "30%", left: "0%" }}
                          animate={{
                            left: ["0%", "70%", "0%"],
                          }}
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
                    CONTINUAR
                  </button>
                </div>
              ) : verificationStep === 2 ? (
                <div className="space-y-6">
                  {/* FUENTE: text-sm en móvil, text-[15px] en PC */}
                  <p className="text-sm sm:text-[15px] text-gray-400 font-medium leading-relaxed italic">
                    Enviaremos un código de seguridad a:
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
                    ENVIAR PIN
                  </button>
                </div>
              ) : (
                /* Ingreso de PIN */
                <div className="space-y-8">
                  <div>
                    {/* FUENTE: text-xs en móvil, text-[10px] en PC */}
                    <p className="text-xs sm:text-[13px] text-gray-400 font-black uppercase tracking-widest mb-4">
                      Ingresa el código
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
                    {loading ? "VERIFICANDO..." : "VERIFICAR AHORA"}
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
                Cancelar proceso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DISEÑO DEL PANEL PRINCIPAL --- */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* SECCIÓN 1: ADMINISTRACIÓN DE CREDENCIALES */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3">
              <Shield className="w-9 h-9 text-slate-400" /> Administración de
              Cuenta
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
                    ID Personal
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
                    Usuario activo
                  </p>
                  <p className="text-base text-jw-navy font-medium">
                    @{user?.username}
                  </p>
                </div>
              </div>
            </div>
            <div className="group">
              <EditableRow
                label="Usuario"
                value="Cambiar alias"
                icon={<UserCircle size={25} />}
                onEdit={() => handleEditClick("username")}
              />
              {editingField === "username" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
            <div className="group">
              <EditableRow
                label="E-mail"
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
                label="Teléfono"
                value={user?.contacto || "Sin cargar"}
                icon={<Phone size={25} />}
                onEdit={() => handleEditClick("contacto")}
              />
              {editingField === "contacto" &&
                verificationStep === 4 &&
                renderEditForm()}
            </div>
            <div className="group">
              <EditableRow
                label="Contraseña"
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

        {/* SECCIÓN 2: RECORDATORIOS Y DIFUSIÓN (SOLO ADMINS) */}
        <section
          id="seguridad"
          className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden scroll-mt-20"
        >
          <div className="p-8 text-left">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-jw-body p-6 rounded-2xl border border-jw-border">
              <div className="text-left flex-1">
                <h3 className="text-jw-navy font-medium flex items-center gap-2 leading-tight text-base sm:text-lg">
                  <FileText className="w-5 h-5 text-jw-blue" /> Recordatorios de
                  Seguridad
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-medium italic">
                  Última revisión: {seguridadDate}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/seguridad-tips")}
                  className="bg-jw-blue text-white px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 shadow-md uppercase"
                >
                  Ver Consejos <ArrowRight className="w-4 h-4" />
                </button>
                {user?.es_admin_local && (
                  <button
                    onClick={() => setShowAdminBroadcast(!showAdminBroadcast)}
                    className={`p-2.5 rounded-lg transition-all duration-300 hover:scale-110 active:scale-90 ${showAdminBroadcast ? "bg-amber-100 text-amber-600 rotate-180" : "bg-gray-100 text-gray-400"}`}
                    title="Panel de Difusión"
                  >
                    <ChevronDown size={20} />
                  </button>
                )}
              </div>
            </div>
            {/* Panel de Difusión para Administradores Locales */}
            {user?.es_admin_local && showAdminBroadcast && (
              <div className="mt-8 p-8 bg-amber-50 border-2 border-dashed border-amber-200 rounded-[2rem] animate-in slide-in-from-top-4 duration-500 text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-inner">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-amber-900 font-black text-sm uppercase tracking-tighter">
                      Difusión Masiva
                    </h3>
                    <p className="text-[10px] text-amber-600 font-bold uppercase italic tracking-widest leading-none">
                      Solo Administradores
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-amber-700 uppercase ml-2 mb-1 block">
                      Título Alerta
                    </label>
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl border border-amber-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white font-bold"
                      placeholder="Título..."
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
                    <label className="text-[10px] font-black text-amber-700 uppercase ml-2 mb-1 block">
                      Descripción HTML
                    </label>
                    <textarea
                      className="w-full p-6 rounded-3xl border border-amber-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white font-light min-h-[250px]"
                      placeholder="Mensaje..."
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
                    PUBLICAR Y DIFUNDIR
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 3: GALERÍA DE AVATARES INSTITUCIONALES (WEBP LOCAL) */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden text-jw-navy">
          <div className="p-5 bg-jw-navy text-white border-b-3 border-jw-blue flex justify-between items-center">
            <h2 className="text-lg font-normal italic flex items-center gap-3 text-left">
              <UserRoundPlus className="w-9 h-9 text-slate-400" /> Galería de
              Avatares
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
              <motion.div
                initial={false}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 space-y-1">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    {/* CONTENEDOR DE FILTROS: En móvil es columna (flex-col), en PC es fila (sm:flex-row) */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-2 mb-1 mt-4">
                      {/* ETIQUETA: Identidad Visual */}
                      {/* Ajustamos: text-[12px] en móvil / text-[15px] en PC. Quitamos el borde derecho en móvil y ponemos uno inferior */}
                      <span className="text-[12px] sm:text-[19px] tracking-[0.2em] uppercase text-jw-navy/70 font-normal border-b sm:border-b-0 sm:border-r border-jw-navy/10 pb-2 sm:pb-0 sm:pr-6 leading-none text-center">
                        Elige tu Avatar
                      </span>

                      {/* CONTENEDOR DE BOTONES: gap-2 en móvil para ahorrar espacio */}
                      <div className="flex gap-2 sm:gap-3">
                        {/* BOTÓN MASCULINO */}
                        <button
                          onClick={() => setAvatarGender("male")}
                          aria-pressed={avatarGender === "male"}
                          className={`px-4 sm:px-6 py-2 rounded-full text-[12px] sm:text-[15px] tracking-[0.15em] transition-all duration-150 border-2 active:scale-95 ${
                            avatarGender === "male"
                              ? "bg-jw-navy border-jw-navy text-white shadow-md"
                              : "bg-white border-slate-300 text-slate-700"
                          }`}
                        >
                          Masculino
                        </button>

                        {/* BOTÓN FEMENINO */}
                        <button
                          onClick={() => setAvatarGender("female")}
                          aria-pressed={avatarGender === "female"}
                          className={`px-4 sm:px-6 py-2 rounded-full text-[12px] sm:text-[15px] tracking-[0.15em] transition-all duration-150 border-2 active:scale-95 ${
                            avatarGender === "female"
                              ? "bg-jw-navy border-jw-navy text-white shadow-md"
                              : "bg-white border-slate-300 text-slate-700"
                          }`}
                        >
                          Femenino
                        </button>
                      </div>
                    </div>
                  </div>

                  {avatarGender && (
                    <div className="relative group/gallery">
                      {/* Controles de Navegación Horizontal */}
                      <button
                        onClick={() =>
                          scrollRef.current?.scrollBy({
                            left: -320,
                            behavior: "smooth",
                          })
                        }
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-white shadow-xl rounded-full text-jw-blue hover:bg-jw-blue hover:text-white transition-all -ml-2 border border-gray-100"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        onClick={() =>
                          scrollRef.current?.scrollBy({
                            left: 320,
                            behavior: "smooth",
                          })
                        }
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-white shadow-xl rounded-full text-jw-blue hover:bg-jw-blue hover:text-white transition-all -mr-2 border border-gray-100"
                      >
                        <ChevronRight size={24} />
                      </button>

                      <div
                        ref={scrollRef}
                        className="flex overflow-x-auto gap-10 py-12 no-scrollbar scroll-smooth px-10"
                      >
                        {Array.from({ length: 15 }).map((_, i) => {
                          const index = i + 1;
                          // Definimos la carpeta y el nombre con la nueva extensión .webp
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
                                  <motion.div
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
                                      alt={`Ilustración de perfil opción ${index}`}
                                      className="w-full h-full object-cover"
                                      // --- PARÁMETROS SEO 2026 ---
                                      loading="lazy" // Carga solo cuando el usuario hace scroll
                                      fetchPriority="low" // No bloquea la carga del resto de la página
                                      width="160" // Evita saltos de diseño (CLS)
                                      height="160" // Evita saltos de diseño (CLS)
                                      onError={(e) => {
                                        if (!e.target.dataset.error) {
                                          e.target.dataset.error = "true"; // Marcamos que ya falló una vez
                                          e.target.src =
                                            "https://ui-avatars.com/api/?name=Error&background=random";
                                        }
                                      }}
                                    />
                                  </motion.div>
                                </div>

                                {/* Botón de selección con área táctil optimizada */}
                                <button
                                  onClick={() => handleSelectAvatar(fullPath)}
                                  className="absolute inset-0 bg-jw-navy/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 active:scale-95"
                                >
                                  <CheckCircle2
                                    className="text-white mb-2"
                                    size={32}
                                  />
                                  <span className="text-white text-[10px] font-black uppercase tracking-widest bg-jw-blue px-4 py-1.5 rounded-full shadow-lg">
                                    Establecer
                                  </span>
                                </button>
                              </div>

                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">
                                Avatar Institucional {index}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* SECCIÓN 4: ZONA DE PELIGRO (SUSPENSIÓN DE CUENTA) */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-red-600 text-white border-b-4 border-red-800 text-left">
            <h2 className="text-lg font-bold italic flex items-center gap-3">
              <Trash2 className="w-9 h-9 text-slate-300" /> Zona de Peligro
            </h2>
          </div>
          <div className="p-8 text-jw-navy text-left">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-red-600 uppercase italic leading-tight">
                  Desactivar mi acceso
                </h3>
                <p className="text-xs text-gray-400 font-light italic mt-1 leading-tight">
                  Su cuenta pasará a estado de BAJA de manera permanente.
                </p>
              </div>
              <button
                onClick={() => handleEditClick("eliminar_cuenta")}
                className="w-full sm:w-auto bg-red-50 text-red-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200 transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-red-600 hover:text-white shadow-sm italic"
              >
                ELIMINAR CUENTA
              </button>
            </div>
            {editingField === "eliminar_cuenta" && verificationStep === 4 && (
              <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-3xl animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-2 mb-4 text-red-600 font-bold text-[10px] uppercase italic">
                  <ShieldCheck size={14} /> Verificado
                </div>
                <p className="text-red-800 text-sm font-light italic mb-6 leading-relaxed">
                  PIN validado. Al confirmar ahora, su sesión se cerrará
                  inmediatamente.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={processDeleteAccountFinal}
                    disabled={loading}
                    className="flex-1 bg-red-600 text-white p-4 rounded-xl font-black text-[11px] uppercase shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-red-700"
                  >
                    SÍ, CONFIRMO ELIMINACIÓN
                  </button>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setVerificationStep(0);
                    }}
                    className="p-4 text-gray-400 font-bold uppercase text-[10px] transition-all duration-300 hover:scale-105 active:scale-95 hover:text-jw-navy"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 5: PERFIL PÚBLICO E INFORMACIÓN GEOGRÁFICA */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden text-jw-navy">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue text-left">
            <h2 className="text-lg font-light italic flex items-center gap-3">
              <User className="w-9 h-9 text-slate-400" /> Mi perfil público
            </h2>
          </div>
          <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start text-left">
            <div className="relative">
              <div className="w-44 h-44 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                {loading ? (
                  <Loader2 className="w-10 h-10 text-jw-blue animate-spin" />
                ) : user?.foto_url ? (
                  <img
                    // El key obliga a React a destruir la imagen vieja y poner la nueva al instante
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
                className="absolute bottom-2 right-2 bg-jw-blue text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-90 shadow-blue-500/50"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 pt-4 w-full">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Nombre Completo
                </label>
                <p className="text-2xl font-medium leading-tight">
                  {user?.nombre_completo}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-jw-blue italic">
                  Congregación Local
                </label>
                <p className="text-lg font-medium text-gray-700 leading-tight mb-4">
                  {user?.congregacion_nombre}{" "}
                  <span className="text-gray-400 font-light">
                    ({user?.numero_congregacion})
                  </span>
                </p>
                {/* Desglose de dirección postal detallada */}
                <div className="space-y-3 mt-4 border-l-4 border-jw-blue/10 pl-5 text-left">
                  <AddressLine
                    icon={<MapPin />}
                    value={user?.direccion}
                    label="Calle"
                  />
                  <AddressLine
                    icon={<Building2 />}
                    value={user?.ciudad}
                    label="Localidad"
                  />
                  <AddressLine
                    icon={<Map />}
                    value={user?.partido}
                    label="Ciudad / Partido"
                  />
                  <AddressLine
                    icon={<Landmark />}
                    value={user?.provincia}
                    label="Provincia"
                  />
                  <AddressLine
                    icon={<Globe2 />}
                    value={user?.pais}
                    label="País"
                  />
                  <AddressLine
                    icon={<Globe />}
                    value={user?.region}
                    label="Región"
                  />
                </div>
              </div>
              {/* Bloque Informativo de Ayuda */}
              <div className="bg-jw-body p-6 rounded-2xl border flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-jw-blue mt-1" />
                <div className="text-[13px] text-gray-600 leading-relaxed italic">
                  <p className="font-bold not-italic text-jw-navy mb-1 leading-tight text-sm">
                    ¿Necesitas ayuda?
                  </p>
                  Pídale ayuda al{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    Anciano Coordinador
                  </span>
                  ,{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    Anciano Secretario
                  </span>{" "}
                  o al{" "}
                  <span className="text-jw-blue font-medium not-italic">
                    Anciano de Servicio
                  </span>{" "}
                  de su congregación.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * AddressLine: Componente minimalista para renderizar líneas de dirección con etiqueta.
 */
function AddressLine({ icon, value, label }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-slate-800 py-0.5 text-left">
      <span className="text-jw-blue shrink-0 opacity-90">
        {React.cloneElement(icon, { size: 18 })}
      </span>
      <p className="text-sm font-semibold italic leading-tight">
        {value}{" "}
        <span className="text-[10px] text-slate-500 not-italic font-black ml-1 uppercase tracking-tighter">
          ({label})
        </span>
      </p>
    </div>
  );
}

export default ProfilePage;
