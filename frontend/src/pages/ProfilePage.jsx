import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  User, Shield, Mail, Key, Camera, Loader2, CheckCircle2, 
  AlertCircle, Eye, EyeOff, UserCircle, HelpCircle, 
  FileText, Trash2, ArrowRight, Lock, ShieldCheck 
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';

function ProfilePage() {
  const { user, login, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- ESTADOS ---
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null); 
  const [verificationStep, setVerificationStep] = useState(0); // 0: cerrado, 1: enviar pin, 2: ingresar pin, 3: verificado
  const [pin, setPin] = useState('');
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null });
  const [seguridadDate, setSeguridadDate] = useState('');
  const [imgTimestamp, setImgTimestamp] = useState(Date.now());
  const [toast, setToast] = useState(false);

  // Visibilidad de contraseñas
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Valores del formulario
  const [formValues, setFormValues] = useState({ newValue: '', currentPass: '', confirmPass: '' });

  const urlBase = "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  // --- CARGA INICIAL ---
  useEffect(() => {
    axios.get('/api/seguridad-info').then(res => {
      const date = new Date(res.data.updated_at);
      setSeguridadDate(date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
    }).catch(() => setSeguridadDate('No disponible'));
  }, []);

  // --- FUNCIONES DE APOYO ---
  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}${"*".repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
  };

  const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPassStrong = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);

  // --- MANEJADORES DE SEGURIDAD (PIN) ---
  const handleEditClick = (field) => {
    setEditingField(field);
    setVerificationStep(1);
    setPin('');
    setFormValues({ newValue: '', currentPass: '', confirmPass: '' });
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      await axios.post('/api/request-pin', { 
        email: user.email, 
        username: user.username,
        congregacion: user.congregacion_nombre 
      });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
      setVerificationStep(2);
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo enviar el código.' });
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await axios.post('/api/verify-pin', { pin });
      setVerificationStep(3); // Desbloquea el formulario final
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'PIN Incorrecto', message: 'El código no es válido o ha expirado.' });
    } finally { setLoading(false); }
  };

  // --- MANEJADORES DE ACTUALIZACIÓN FINAL ---
  const handleUpdateImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const options = { maxSizeMB: 0.3, maxWidthOrHeight: 500, useWebWorker: true };
      const compressed = await imageCompression(file, options);
      const fileName = `perfil_${user.persona_id}.jpg`;
      await supabase.storage.from('People_profile').upload(fileName, compressed, { upsert: true });
      await axios.post('/api/upload-foto', { persona_id: String(user.persona_id), foto_url: fileName });
      setImgTimestamp(Date.now());
      login({ ...user, foto_url: fileName });
      setModal({ show: true, type: 'success', title: '¡Éxito!', message: 'Foto actualizada correctamente.' });
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo subir la imagen.' });
    } finally { setLoading(false); }
  };

  const processUpdate = async () => {
    setModal({ ...modal, show: false });
    setLoading(true);
    try {
      await axios.post('/api/update-profile', {
        persona_id: String(user.persona_id),
        usuario_id: user.id,
        campo: editingField,
        valor: formValues.newValue
      });
      login({ ...user, [editingField]: formValues.newValue });
      setModal({ show: true, type: 'success', title: '¡Hecho!', message: 'Información actualizada.' });
      setEditingField(null);
      setVerificationStep(0);
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo actualizar.' });
    } finally { setLoading(false); }
  };

  const handleSaveClick = () => {
    if (editingField === 'email' && !isEmailValid(formValues.newValue)) {
      setModal({ show: true, type: 'error', title: 'Email Inválido', message: 'Ingrese un formato correcto.' });
      return;
    }
    if (editingField === 'password') {
      if (formValues.newValue !== formValues.confirmPass) {
        setModal({ show: true, type: 'error', title: 'Error', message: 'Las contraseñas nuevas no coinciden.' });
        return;
      }
      if (!isPassStrong(formValues.newValue)) {
        setModal({ show: true, type: 'error', title: 'Seguridad Baja', message: 'Mínimo 8 caracteres, mayúscula, número y símbolo.' });
        return;
      }
    }
    setModal({ 
      show: true, type: 'confirm', title: 'Confirmar', 
      message: `¿Deseas modificar tu ${editingField === 'username' ? 'nombre de usuario' : editingField}?`,
      onConfirm: processUpdate 
    });
  };

  const handleConfirmDelete = () => {
    setEditingField('eliminar_cuenta');
    setVerificationStep(1);
    setPin('');
  };

  const processDeleteAccount = async () => {
    setLoading(true);
    try {
      await axios.post('/api/suspender-cuenta', { usuario_id: user.id });
      logout();
      navigate('/login');
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo procesar la baja.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4 relative font-sans text-left">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-jw-blue text-white px-8 py-3 rounded-full shadow-2xl animate-bounce text-sm font-bold tracking-widest uppercase">✅ CÓDIGO ENVIADO</div>}

      <Modal isOpen={modal.show} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onClose={() => setModal({ ...modal, show: false })} />

      {/* POPUP DE VERIFICACIÓN (Paso 1 y 2) */}
      {editingField && verificationStep < 3 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-jw-navy/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-jw-border animate-in zoom-in duration-200">
            <div className="p-8 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
              <Lock className="w-12 h-12 mx-auto mb-4 text-jw-accent" />
              <h3 className="text-xl font-bold italic tracking-tight">Verificar Identidad</h3>
            </div>
            <div className="p-8 text-center">
              {verificationStep === 1 ? (
                <>
                  <p className="text-gray-500 text-sm mb-6 font-light">Para modificar su <b>{editingField === 'username' ? 'nombre de usuario' : editingField}</b>, enviaremos un código a:<br/><span className="text-jw-blue font-bold text-lg">{maskEmail(user.email)}</span></p>
                  <button onClick={handleSendCode} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-jw-navy transition-all">{loading ? 'ENVIANDO...' : 'ENVIAR CÓDIGO'}</button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-6 font-light">Ingrese el código de 6 dígitos enviado a su correo.</p>
                  <input type="text" maxLength="6" value={pin} className="w-full text-center text-3xl tracking-[0.5em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none mb-6 text-jw-navy" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
                  <button onClick={handleVerifyCode} disabled={loading || pin.length < 6} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-green-700 transition-all">{loading ? 'VERIFICANDO...' : 'VERIFICAR Y CONTINUAR'}</button>
                </>
              )}
              <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="mt-6 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-jw-navy">Cancelar proceso</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* SECCIÓN 1: ADMINISTRACIÓN DE CUENTA */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3"><Shield className="w-5 h-5 text-jw-accent"/> Administración de Cuenta</h2>
          </div>
          <div className="p-8 space-y-8 text-sm">
            <EditableRow label="Nombre de Usuario" value={`@${user?.username}`} icon={<UserCircle size={20}/>} onEdit={() => handleEditClick('username')} />
            <EditableRow label="Correo Electrónico" value={user?.email} icon={<Mail size={20}/>} onEdit={() => handleEditClick('email')} />
            <EditableRow label="Seguridad / Contraseña" value="••••••••••••" icon={<Key size={20}/>} onEdit={() => handleEditClick('password')} />

            {/* FORMULARIO DE EDICIÓN O ELIMINACIÓN (PASO 3) */}
            {editingField && verificationStep === 3 && (
              <div className={`mt-4 p-6 rounded-2xl border animate-in slide-in-from-top-4 ${
                editingField === 'eliminar_cuenta' ? 'bg-red-50 border-red-200' : 'bg-jw-body border-jw-border'
              }`}>
                <div className={`flex items-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-widest italic ${
                  editingField === 'eliminar_cuenta' ? 'text-red-600' : 'text-green-600'
                }`}>
                  <ShieldCheck size={14}/> Identidad Verificada
                </div>

                {editingField === 'eliminar_cuenta' ? (
                  <div className="text-left space-y-4">
                    <h3 className="text-sm font-bold text-red-800 uppercase italic">Confirmar Suspensión de Acceso</h3>
                    <p className="text-red-700 text-sm leading-relaxed font-light italic">
                      Atención: Al confirmar, su cuenta será suspendida de manera inmediata. Sus datos permanecerán resguardados, pero no podrá volver a ingresar sin nueva autorización.
                    </p>
                    <div className="flex gap-2 pt-2">
                      <button onClick={processDeleteAccount} disabled={loading} className="flex-1 bg-red-600 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all transform active:scale-95">
                        {loading ? 'PROCESANDO...' : 'SÍ, SUSPENDER MI CUENTA AHORA'}
                      </button>
                      <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="p-3 text-gray-400 text-[10px] font-bold uppercase">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-md text-left">
                    <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic tracking-tight">Modificar {editingField === 'username' ? 'Nombre de Usuario' : editingField}</h3>
                    {editingField === 'password' ? (
                      <div className="space-y-4">
                        <PassInput placeholder="Contraseña Actual" show={showCurrent} setShow={setShowCurrent} />
                        <PassInput placeholder="Nueva Contraseña" show={showNew} setShow={setShowNew} onChange={(val) => setFormValues({...formValues, newValue: val})} />
                        <PassInput placeholder="Confirmar Nueva Contraseña" show={showConfirm} setShow={setShowConfirm} onChange={(val) => setFormValues({...formValues, confirmPass: val})} />
                        {formValues.newValue && !isPassStrong(formValues.newValue) && <p className="text-[10px] text-red-500 italic bg-red-50 p-2 rounded-lg">8 caracteres: Mayúscula, Número y Símbolo.</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400 italic">Dato Actual: {user[editingField]}</label>
                        <input type={editingField === 'email' ? 'email' : 'text'} placeholder={`Nuevo ${editingField === 'username' ? 'nombre de usuario' : 'e-mail'}`} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none focus:ring-2 focus:ring-jw-blue" onChange={(e) => setFormValues({...formValues, newValue: e.target.value})} />
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleSaveClick} disabled={loading} className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-jw-navy transition-all">Confirmar</button>
                      <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="p-3 text-gray-400 text-xs font-bold uppercase">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 2: SEGURIDAD Y RECORDATORIOS */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-jw-body p-6 rounded-2xl border border-jw-border">
                <div className="text-left">
                    <h3 className="text-jw-navy font-medium flex items-center gap-2 leading-tight">
                        <FileText className="w-5 h-5 text-jw-blue" /> Recordatorios y Consejos de Seguridad
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold italic">Actualizado el: {seguridadDate}</p>
                </div>
                <button onClick={() => navigate('/seguridad-tips')} className="bg-jw-blue text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-jw-navy transition-all shadow-md uppercase tracking-widest shrink-0">Ver Consejos <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-400 italic font-light">Si sospecha de un acceso no autorizado, cambie su clave.</p>
                <button onClick={handleConfirmDelete} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all uppercase tracking-widest italic border border-transparent hover:border-red-100">ELIMINAR MI CUENTA</button>
            </div>
        </section>

        {/* SECCIÓN 3: PERFIL PÚBLICO */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue"><h2 className="text-lg font-light italic flex items-center gap-3"><User className="w-5 h-5 text-jw-accent"/> Mi perfil público</h2></div>
          <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start text-left">
            <div className="relative">
              <div className="w-44 h-44 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                {loading ? <Loader2 className="w-10 h-10 text-jw-blue animate-spin"/> : user?.foto_url ? <img src={`${urlBase}${user.foto_url}?v=${imgTimestamp}`} alt="P" className="w-full h-full object-cover object-center" /> : <User className="w-16 h-16 text-gray-300"/>}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleUpdateImage} className="hidden" accept="image/*"/>
              <button onClick={() => fileInputRef.current.click()} className="absolute bottom-2 right-2 bg-jw-blue text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all"><Camera className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 space-y-6 pt-4">
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label><p className="text-2xl font-medium text-jw-navy leading-tight">{user?.nombre_completo}</p></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-jw-blue italic">Congregación Local</label>
                <p className="text-lg font-medium text-gray-700">{user?.congregacion_nombre} <span className="text-gray-400 font-light">({user?.numero_congregacion})</span></p>
                <p className="text-sm text-gray-400 italic font-light">{user?.direccion}, {user?.ciudad}, {user?.partido}</p>
              </div>
              <div className="bg-jw-body p-6 rounded-2xl border border-jw-border flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-jw-blue shrink-0 mt-1" />
                <div className="text-[13px] text-gray-600 leading-relaxed italic">
                  <p className="font-bold not-italic text-jw-navy mb-1 leading-tight text-sm">¿Necesitas ayuda?</p>
                  Pídale ayuda al <span className="text-jw-blue font-medium not-italic">Anciano Coordinador</span>, <span className="text-jw-blue font-medium not-italic">Anciano Secretario</span> o al <span className="text-jw-blue font-medium not-italic">Anciano de Servicio</span> de su congregación.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Componentes Auxiliares
function EditableRow({ label, value, icon, onEdit }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-50 pb-4">
      <div className="text-left flex items-center gap-4">
        <div className="p-2 bg-jw-body rounded-lg text-gray-400">{icon}</div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-base text-jw-navy font-medium tracking-tight">{value}</p>
        </div>
      </div>
      <button onClick={onEdit} className="bg-jw-body px-4 py-2 rounded-lg text-jw-blue font-bold text-[10px] hover:bg-jw-blue hover:text-white transition-all uppercase tracking-widest border border-transparent hover:border-jw-blue italic">Modificar</button>
    </div>
  );
}

function PassInput({ placeholder, show, setShow, onChange }) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none text-sm focus:ring-2 focus:ring-jw-blue" />
      <button onClick={() => setShow(!show)} className="absolute right-3 top-3 text-gray-400 hover:text-jw-blue transition-colors">
        {show ? <EyeOff size={16}/> : <Eye size={16}/>}
      </button>
    </div>
  );
}

export default ProfilePage;