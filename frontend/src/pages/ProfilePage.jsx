import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  User, Shield, Mail, Key, Camera, Loader2, CheckCircle2, 
  AlertCircle, Eye, EyeOff, UserCircle, HelpCircle, 
  FileText, Trash2, ArrowRight, Lock, ShieldCheck, Phone, Hash, XCircle
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';

// --- COMPONENTES AUXILIARES ---

function ReqItem({ met, text }) {
    return (
      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter transition-colors ${met ? 'text-green-600' : 'text-gray-300'}`}>
        <div className={`w-2 h-2 rounded-full transition-all ${met ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-200'}`} />
        {text}
      </div>
    );
}

function PassInput({ placeholder, show, setShow, value, onChange, isValidMatch }) {
    let borderColor = 'border-jw-border';
    if (isValidMatch === true) borderColor = 'border-green-500 bg-green-50';
    if (isValidMatch === false) borderColor = 'border-red-500 bg-red-50';

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
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    );
}

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

// --- COMPONENTE PRINCIPAL ---

function ProfilePage() {
  const { user, login, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null); 
  const [verificationStep, setVerificationStep] = useState(0); 
  const [pin, setPin] = useState('');
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null });
  const [seguridadDate, setSeguridadDate] = useState('');
  const [imgTimestamp, setImgTimestamp] = useState(Date.now());
  const [toast, setToast] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formValues, setFormValues] = useState({ newValue: '', currentPass: '', confirmPass: '' });

  const urlBase = "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  const [usernameExists, setUsernameExists] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  
  const [reqs, setReqs] = useState({ length: false, upper: false, number: false, symbol: false });

  // REQUISITOS: Se ha modificado la lógica de Símbolo para aceptar CUALQUIERA
  const validateRequirements = (val) => {
    setReqs({
      length: val.length >= 8,
      upper: /[A-Z]/.test(val),
      number: /[0-9]/.test(val),
      // Esta Regex busca cualquier carácter que NO sea letra (a-z) ni número (0-9)
      symbol: /[^a-zA-Z0-9]/.test(val)
    });
  };

  useEffect(() => {
    axios.get('/api/seguridad-info').then(res => {
      const date = new Date(res.data.updated_at);
      setSeguridadDate(date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
    }).catch(() => setSeguridadDate('No disponible'));
  }, []);

  useEffect(() => {
    if (editingField === 'username' && formValues.newValue.length > 2) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(`/api/check-username?username=${formValues.newValue}&persona_id=${user.persona_id}`);
          setUsernameExists(res.data.exists);
          setSuggestions(res.data.suggestions || []);
        } catch (err) { console.error("Error validando usuario"); }
      }, 400);
      return () => clearTimeout(delay);
    }
  }, [formValues.newValue, editingField, user.persona_id]);

  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}${"*".repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
  };

  const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const isPassStrong = (p) => {
    const hasLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasNum = /[0-9]/.test(p);
    const hasSym = /[^a-zA-Z0-9]/.test(p); // Cualquier símbolo
    return hasLen && hasUpper && hasNum && hasSym;
  };

  const handleEditClick = (field) => {
    setEditingField(field);
    setVerificationStep(1);
    setPin('');
    setReqs({ length: false, upper: false, number: false, symbol: false });

    let initialVal = '';
    if (field === 'contacto') initialVal = (user.contacto || '').replace(/\D/g, '');
    if (field === 'email') initialVal = user.email || '';
    
    setFormValues({ newValue: initialVal, currentPass: '', confirmPass: '' });
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
      setVerificationStep(3);
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'PIN Incorrecto', message: 'El código no es válido o ha expirado.' });
    } finally { setLoading(false); }
  };

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
      const cleanValue = editingField === 'contacto' ? formValues.newValue.replace(/\D/g, '') : formValues.newValue;

      if (editingField === 'password') {
        await axios.post('/api/reset-password', { 
            username: user.username, 
            current_password: formValues.currentPass, // Enviamos la actual
            new_password: formValues.newValue,
            persona_id: String(user.persona_id)
        });
      } else {
        await axios.post('/api/update-profile', {
            persona_id: String(user.persona_id),
            usuario_id: user.id || "", 
            campo: editingField,
            valor: cleanValue
        });
      }
      
      login({ ...user, [editingField]: cleanValue });
      setModal({ show: true, type: 'success', title: '¡Hecho!', message: 'Información actualizada correctamente.' });
      setEditingField(null);
      setVerificationStep(0);
      setUsernameExists(false);
    } catch (err) {
      // Manejo específico del error de contraseña actual incorrecta
      const errMsg = err.response?.status === 401 ? "La contraseña actual ingresada es incorrecta." : "No se pudo actualizar la información.";
      setModal({ show: true, type: 'error', title: 'Error', message: errMsg });
    } finally { setLoading(false); }
  };

  const handleSaveClick = () => {
    if (editingField === 'email' && !isEmailValid(formValues.newValue)) {
      setModal({ show: true, type: 'error', title: 'Email Inválido', message: 'Ingrese un formato de correo electrónico correcto.' });
      return;
    }
    if (editingField === 'contacto' && formValues.newValue.length < 8) {
      setModal({ show: true, type: 'error', title: 'Teléfono Inválido', message: 'Ingrese un número válido.' });
      return;
    }
    if (editingField === 'password') {
        if (!formValues.currentPass) {
            setModal({ show: true, type: 'error', title: 'Dato Faltante', message: 'Debe ingresar su contraseña actual.' });
            return;
        }
      if (formValues.newValue !== formValues.confirmPass) {
        setModal({ show: true, type: 'error', title: 'Error', message: 'Las contraseñas nuevas no coinciden.' });
        return;
      }
      if (!isPassStrong(formValues.newValue)) {
        setModal({ show: true, type: 'error', title: 'Seguridad Baja', message: 'Mínimo 8 caracteres, una mayúscula, un número y un símbolo.' });
        return;
      }
    }
    setModal({ 
      show: true, type: 'confirm', title: 'Confirmar', 
      message: `¿Deseas modificar tu ${editingField === 'username' ? 'nombre de usuario' : editingField === 'contacto' ? 'teléfono' : editingField === 'password' ? 'contraseña' : editingField}?`,
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

  // --- BLOQUE DE FORMULARIO DE EDICIÓN ---
  const renderEditForm = () => {
    const passwordsMatch = formValues.newValue === formValues.confirmPass && formValues.confirmPass !== '';
    
    return (
        <div className="mt-4 p-6 rounded-2xl border bg-jw-body border-jw-border animate-in slide-in-from-top-4">
            <div className="flex items-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-widest italic text-green-600">
                <ShieldCheck size={14}/> Identidad Verificada
            </div>

            <div className="space-y-4 max-w-md text-left">
                <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic tracking-tight">
                    Modificar {editingField === 'contacto' ? 'Teléfono' : editingField === 'username' ? 'Nombre de Usuario' : editingField === 'password' ? 'Contraseña' : editingField}
                </h3>
                
                {editingField === 'password' ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-400 italic">Contraseña Actual</label>
                            <PassInput placeholder="Escriba su clave actual" show={showCurrent} setShow={setShowCurrent} value={formValues.currentPass} onChange={(val) => setFormValues({...formValues, currentPass: val})} />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-400 italic">Nueva Contraseña</label>
                            <PassInput placeholder="Mínimo 8 caracteres" show={showNew} setShow={setShowNew} value={formValues.newValue} onChange={(val) => { setFormValues({...formValues, newValue: val}); validateRequirements(val); }} />
                            
                            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <ReqItem met={reqs.length} text="8+ caracteres" />
                                <ReqItem met={reqs.upper} text="Una Mayúscula" />
                                <ReqItem met={reqs.number} text="Un Número" />
                                <ReqItem met={reqs.symbol} text="Un Símbolo" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-gray-400 italic">Confirmar Nueva Contraseña</label>
                            <PassInput 
                                placeholder="Repita la nueva clave" 
                                show={showConfirm} 
                                setShow={setShowConfirm} 
                                value={formValues.confirmPass} 
                                onChange={(val) => setFormValues({...formValues, confirmPass: val})}
                                isValidMatch={formValues.confirmPass === '' ? null : passwordsMatch}
                            />
                            {formValues.confirmPass !== '' && (
                                <p className={`text-[10px] font-bold uppercase italic flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                                    {passwordsMatch ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                    {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                                </p>
                            )}
                        </div>
                    </div>
                ) : editingField === 'username' ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <input 
                                type="text" 
                                className={`w-full p-4 rounded-2xl border-2 transition-all outline-none ${usernameExists ? 'border-orange-400 bg-orange-50 text-jw-navy' : 'border-jw-blue bg-white text-jw-navy'}`} 
                                placeholder="Nuevo nombre de usuario" 
                                value={formValues.newValue} 
                                onChange={(e) => {
                                    setFormValues({...formValues, newValue: e.target.value});
                                    validateRequirements(e.target.value);
                                }} 
                            />
                            <div className="absolute right-4 top-4">{!usernameExists && formValues.newValue.length >= 8 && <CheckCircle2 className="text-green-500" />}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <ReqItem met={reqs.length} text="8+ caracteres" /><ReqItem met={reqs.upper} text="Una Mayúscula" /><ReqItem met={reqs.number} text="Un Número" /><ReqItem met={reqs.symbol} text="Un Símbolo" />
                        </div>
                        {usernameExists && (
                            <div className="bg-orange-100 p-4 rounded-2xl border border-orange-200">
                            <p className="text-orange-800 text-[11px] font-bold mb-3 flex items-center gap-2"><AlertCircle size={14}/> Usuario no disponible. Sugerencias:</p>
                            <div className="flex flex-wrap gap-2">{suggestions.map((s, i) => (<button key={i} onClick={() => { setFormValues({...formValues, newValue: s}); validateRequirements(s); setUsernameExists(false); }} className="bg-white text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-300 hover:bg-orange-600 hover:text-white transition-all">{s}</button>))}</div>
                            </div>
                        )}
                    </div>
                ) : editingField === 'contacto' ? (
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400 italic">Nuevo Teléfono (Solo números)</label>
                        <input 
                            type="text" 
                            className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none focus:ring-2 focus:ring-jw-blue text-jw-navy" 
                            value={formValues.newValue}
                            placeholder="Ej: 5491100000000"
                            onChange={(e) => setFormValues({...formValues, newValue: e.target.value.replace(/\D/g, '')})} 
                        />
                    </div>
                ) : editingField === 'email' ? (
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400 italic">Nuevo Correo Electrónico</label>
                        <input 
                            type="email" 
                            className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none focus:ring-2 focus:ring-jw-blue text-jw-navy" 
                            value={formValues.newValue}
                            placeholder="ejemplo@correo.com"
                            onChange={(e) => setFormValues({...formValues, newValue: e.target.value})} 
                        />
                    </div>
                ) : null}

                <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveClick} disabled={loading || (editingField === 'username' && usernameExists)} className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-xs uppercase hover:bg-jw-navy transition-all">Confirmar Cambio</button>
                    <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="p-3 text-gray-400 text-xs font-bold uppercase hover:text-jw-navy">Cancelar</button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4 relative font-sans text-left">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-jw-blue text-white px-8 py-3 rounded-full shadow-2xl animate-bounce text-sm font-bold tracking-widest uppercase">✅ CÓDIGO ENVIADO</div>}

      <Modal isOpen={modal.show} type={modal.type} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onClose={() => setModal({ ...modal, show: false })} />

      {/* POPUP DE PIN (Paso 1 y 2) */}
      {editingField && editingField !== 'eliminar_cuenta' && verificationStep < 3 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-jw-navy/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-jw-border animate-in zoom-in duration-200">
            <div className="p-8 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
              <Lock className="w-12 h-12 mx-auto mb-4 text-jw-accent" />
              <h3 className="text-xl font-bold italic tracking-tight">Verificar Identidad</h3>
            </div>
            <div className="p-8 text-center">
              {verificationStep === 1 ? (
                <>
                  <p className="text-gray-500 text-sm mb-6 font-light">Para modificar sus datos, enviaremos un código a:<br/><span className="text-jw-blue font-bold text-lg">{maskEmail(user.email)}</span></p>
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
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3"><Shield className="w-5 h-5 text-jw-accent"/> Administración de Cuenta</h2>
          </div>
          <div className="p-8 space-y-6 text-sm">
            
            <div className="pb-4 border-b border-gray-50 opacity-60">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-400"><Hash size={20}/></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">ID Personal</p>
                        <p className="text-base text-jw-navy font-mono">#{user?.persona_id}</p>
                    </div>
                </div>
            </div>

            <div className="pb-4 border-b border-gray-50 opacity-60">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-400"><UserCircle size={20}/></div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Nombre de usuario activo</p>
                        <p className="text-base text-jw-navy font-medium">@{user?.username}</p>
                    </div>
                </div>
            </div>

            <div className="group">
                <EditableRow label="Nombre de Usuario" value="Modificar alias de acceso" icon={<UserCircle size={20}/>} onEdit={() => handleEditClick('username')} />
                {editingField === 'username' && verificationStep === 3 && renderEditForm()}
            </div>

            <div className="group">
                <EditableRow label="Correo Electrónico" value={user?.email} icon={<Mail size={20}/>} onEdit={() => handleEditClick('email')} />
                {editingField === 'email' && verificationStep === 3 && renderEditForm()}
            </div>

            <div className="group">
                <EditableRow label="Teléfono de Contacto" value={user?.contacto || 'Cargar teléfono'} icon={<Phone size={20}/>} onEdit={() => handleEditClick('contacto')} />
                {editingField === 'contacto' && verificationStep === 3 && renderEditForm()}
            </div>

            <div className="group">
                <EditableRow label="Seguridad / Contraseña" value="••••••••••••" icon={<Key size={20}/>} onEdit={() => handleEditClick('password')} />
                {editingField === 'password' && verificationStep === 3 && renderEditForm()}
            </div>

          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-jw-border p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-jw-body p-6 rounded-2xl border border-jw-border">
                <div className="text-left">
                    <h3 className="text-jw-navy font-medium flex items-center gap-2 leading-tight">
                        <FileText className="w-5 h-5 text-jw-blue" /> Recordatorios de Seguridad
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold italic">Actualizado el: {seguridadDate}</p>
                </div>
                <button onClick={() => navigate('/seguridad-tips')} className="bg-jw-blue text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-jw-navy transition-all shadow-md uppercase tracking-widest shrink-0">Ver Consejos <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-400 italic font-light">Si sospecha de un acceso no autorizado, cambie su clave.</p>
                <button onClick={handleConfirmDelete} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all uppercase italic border border-transparent hover:border-red-100">ELIMINAR MI CUENTA</button>
            </div>
        </section>

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

export default ProfilePage;