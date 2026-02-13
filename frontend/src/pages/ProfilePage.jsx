import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  User, Shield, Mail, Key, Camera, Loader2, CheckCircle2, 
  AlertCircle, Eye, EyeOff, UserCircle, HelpCircle, 
  FileText, Trash2, ArrowRight, Lock, ShieldCheck, Phone, Hash, XCircle, ShieldAlert,
  AlertTriangle // <--- IMPORTADO CORRECTAMENTE AQUÍ
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
        <input type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} 
            className={`w-full p-3 rounded-xl border-2 ${borderColor} outline-none text-sm focus:ring-2 focus:ring-jw-blue text-jw-navy transition-all`} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-gray-400 hover:text-jw-blue transition-colors">
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    );
}

function EditableRow({ label, value, icon, onEdit }) {
    return (
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-gray-100 pb-4 gap-3">
        <div className="flex items-center gap-4 text-left">
          <div className="p-2.5 bg-jw-body rounded-xl text-gray-400 shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm sm:text-base text-jw-navy font-semibold truncate">{value}</p>
          </div>
        </div>
        <button onClick={onEdit} className="w-full sm:w-auto bg-jw-body px-5 py-2.5 sm:px-4 sm:py-2 rounded-xl text-jw-blue font-bold text-[11px] hover:bg-jw-blue hover:text-white transition-all uppercase tracking-widest border border-jw-border sm:border-transparent hover:border-jw-blue italic shadow-sm sm:shadow-none">
          Modificar
        </button>
      </div>
    );
}

// --- COMPONENTE PRINCIPAL ---
function ProfilePage() {
  const { user, login, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const urlBase = "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

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
  const [formValues, setFormValues] = useState({ newValue: '', currentPass: '', confirmPass: '', adminNote: '' });
  const [usernameExists, setUsernameExists] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [reqs, setReqs] = useState({ length: false, upper: false, number: false, symbol: false });

  const validateRequirements = (val) => {
    setReqs({
      length: val.length >= 8,
      upper: /[A-Z]/.test(val),
      number: /[0-9]/.test(val),
      symbol: /[^a-zA-Z0-9]/.test(val)
    });
  };

  useEffect(() => {
    axios.get('/api/seguridad-info').then(res => {
      const date = new Date(res.data.updated_at);
      setSeguridadDate(date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
    }).catch(() => setSeguridadDate('No disponible'));

    if (window.location.hash === '#seguridad') {
      const element = document.getElementById('seguridad');
      if (element) {
        setTimeout(() => { element.scrollIntoView({ behavior: 'instant', block: 'start' }); }, 0);
      }
    }
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
    const hasSym = /[^a-zA-Z0-9]/.test(p);
    return hasLen && hasUpper && hasNum && hasSym;
  };

  const handleEditClick = (field) => {
    setEditingField(field);
    if (field === 'eliminar_cuenta') { setVerificationStep(1); } else { setVerificationStep(2); }
    setPin('');
    setReqs({ length: false, upper: false, number: false, symbol: false });
    let initialVal = '';
    if (field === 'contacto') initialVal = (user.contacto || '').replace(/\D/g, '');
    if (field === 'email') initialVal = user.email || '';
    setFormValues({ ...formValues, newValue: initialVal, currentPass: '', confirmPass: '' });
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      await axios.post('/api/request-pin', { email: user.email, username: user.username, congregacion: user.congregacion_nombre });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
      setVerificationStep(3);
    } catch (err) { setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo enviar el código.' }); } 
    finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await axios.post('/api/verify-pin', { pin });
      setVerificationStep(4);
    } catch (err) { setModal({ show: true, type: 'error', title: 'PIN Incorrecto', message: 'PIN inválido o expirado.' }); } 
    finally { setLoading(false); }
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
      setModal({ show: true, type: 'success', title: '¡Éxito!', message: 'Foto actualizada.' });
    } catch (err) { setModal({ show: true, type: 'error', title: 'Error', message: 'Fallo al subir imagen.' }); } 
    finally { setLoading(false); }
  };

  const processUpdate = async () => {
    setModal({ ...modal, show: false });
    setLoading(true);
    try {
      const cleanValue = editingField === 'contacto' ? formValues.newValue.replace(/\D/g, '') : formValues.newValue;
      if (editingField === 'password') {
        await axios.post('/api/reset-password', { username: user.username, current_password: formValues.currentPass, new_password: formValues.newValue, persona_id: String(user.persona_id) });
      } else {
        await axios.post('/api/update-profile', { persona_id: String(user.persona_id), usuario_id: user.id || "", campo: editingField, valor: cleanValue });
      }
      login({ ...user, [editingField]: cleanValue });
      setModal({ show: true, type: 'success', title: '¡Hecho!', message: 'Actualizado correctamente.' });
      setEditingField(null);
      setVerificationStep(0);
    } catch (err) {
      const errMsg = err.response?.status === 401 ? "Clave actual incorrecta." : "Error al actualizar.";
      setModal({ show: true, type: 'error', title: 'Error', message: errMsg });
    } finally { setLoading(false); }
  };

  const handleSaveClick = () => {
    if (editingField === 'email' && !isEmailValid(formValues.newValue)) { setModal({ show: true, type: 'error', title: 'Inválido', message: 'Email incorrecto.' }); return; }
    if (editingField === 'contacto' && formValues.newValue.length < 8) { setModal({ show: true, type: 'error', title: 'Inválido', message: 'Mínimo 8 dígitos.' }); return; }
    if (editingField === 'password') {
        if (!formValues.currentPass) { setModal({ show: true, type: 'error', title: 'Faltante', message: 'Ingrese clave actual.' }); return; }
        if (formValues.newValue !== formValues.confirmPass) { setModal({ show: true, type: 'error', title: 'Error', message: 'No coinciden.' }); return; }
        if (!isPassStrong(formValues.newValue)) { setModal({ show: true, type: 'error', title: 'Débil', message: 'Mínimo 8 caracteres, Mayúscula, Número y Símbolo.' }); return; }
    }
    setModal({ show: true, type: 'confirm', title: 'Confirmar', message: `¿Modificar ${editingField === 'username' ? 'usuario' : editingField}?`, onConfirm: processUpdate });
  };

  const processDeleteAccountFinal = async () => {
    setLoading(true);
    try {
      await axios.post('/api/suspender-cuenta', { persona_id: String(user.persona_id), usuario_id: user.id || "" });
      logout();
      navigate('/login');
    } catch (err) { setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo procesar.' }); } 
    finally { setLoading(false); }
  };

  const renderEditForm = () => {
    const passwordsMatch = formValues.newValue === formValues.confirmPass && formValues.confirmPass !== '';
    return (
        <div className="mt-4 p-6 rounded-2xl border bg-jw-body border-jw-border animate-in slide-in-from-top-4">
            <div className="flex items-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-widest italic text-green-600"><ShieldCheck size={14}/> Identidad Verificada</div>
            <div className="space-y-4 max-w-md text-left">
                <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic tracking-tight">Modificar {editingField}</h3>
                {editingField === 'password' ? (
                    <div className="space-y-4">
                        <PassInput placeholder="Contraseña Actual" show={showCurrent} setShow={setShowCurrent} value={formValues.currentPass} onChange={(val) => setFormValues({...formValues, currentPass: val})} />
                        <div className="space-y-2">
                            <PassInput placeholder="Nueva Contraseña" show={showNew} setShow={setShowNew} value={formValues.newValue} onChange={(val) => { setFormValues({...formValues, newValue: val}); validateRequirements(val); }} />
                            <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"><ReqItem met={reqs.length} text="8+ carac." /><ReqItem met={reqs.upper} text="Mayúscula" /><ReqItem met={reqs.number} text="Número" /><ReqItem met={reqs.symbol} text="Símbolo" /></div>
                        </div>
                        <PassInput placeholder="Confirmar Nueva" show={showConfirm} setShow={setShowConfirm} value={formValues.confirmPass} onChange={(val) => setFormValues({...formValues, confirmPass: val})} isValidMatch={formValues.confirmPass === '' ? null : passwordsMatch} />
                    </div>
                ) : editingField === 'username' ? (
                    <div className="space-y-4">
                        <input type="text" className={`w-full p-4 rounded-2xl border-2 transition-all outline-none ${usernameExists ? 'border-orange-400 bg-orange-50 text-jw-navy' : 'border-jw-blue bg-white text-jw-navy'}`} placeholder="Nuevo usuario" value={formValues.newValue} onChange={(e) => {setFormValues({...formValues, newValue: e.target.value}); validateRequirements(e.target.value);}} />
                        <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"><ReqItem met={reqs.length} text="8+ carac." /><ReqItem met={reqs.upper} text="Mayúscula" /><ReqItem met={reqs.number} text="Número" /><ReqItem met={reqs.symbol} text="Símbolo" /></div>
                        {usernameExists && <div className="bg-orange-100 p-4 rounded-2xl border border-orange-200"><p className="text-orange-800 text-[11px] font-bold mb-3 flex items-center gap-2"><AlertCircle size={14}/> No disponible. Sugerencias:</p><div className="flex flex-wrap gap-2">{suggestions.map((s, i) => (<button key={i} onClick={() => { setFormValues({...formValues, newValue: s}); validateRequirements(s); setUsernameExists(false); }} className="bg-white text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-300">{s}</button>))}</div></div>}
                    </div>
                ) : (
                    <input type={editingField === 'email' ? 'email' : 'text'} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none focus:ring-2 focus:ring-jw-blue text-jw-navy" value={formValues.newValue} onChange={(e) => setFormValues({...formValues, newValue: (editingField === 'contacto' ? e.target.value.replace(/\D/g, '') : e.target.value)})} />
                )}
                <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveClick} disabled={loading || (editingField === 'username' && usernameExists)} className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-xs uppercase hover:bg-jw-navy transition-all shadow-md">Confirmar Cambio</button>
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

      {/* POPUP DE VERIFICACIÓN (ARREGLADO AlertTriangle) */}
      {editingField && verificationStep < 4 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-jw-navy/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-jw-border animate-in zoom-in duration-200">
            <div className="p-8 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
              <Lock className="w-12 h-12 mx-auto mb-4 text-jw-accent" />
              <h3 className="text-xl font-bold italic tracking-tight">Verificar Identidad</h3>
            </div>
            <div className="p-8 text-center">
              {verificationStep === 1 ? (
                <div className="space-y-4 text-left">
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-700 text-sm leading-relaxed italic">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                    <p><b>¡Atención!</b> Su estado pasará a <b>BAJA</b>. No podrá volver a ingresar sin autorización.</p>
                  </div>
                  <button onClick={() => setVerificationStep(2)} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs">ENTIENDO, CONTINUAR</button>
                </div>
              ) : verificationStep === 2 ? (
                <>
                  <p className="text-gray-500 text-sm mb-6 font-light">Código a:<br/><span className="text-jw-blue font-bold text-lg">{maskEmail(user.email)}</span></p>
                  <button onClick={handleSendCode} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg">ENVIAR CÓDIGO</button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-6 font-light">Ingrese el código de 6 dígitos.</p>
                  <input type="text" maxLength="6" value={pin} className="w-full text-center text-3xl tracking-[0.5em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none mb-6 text-jw-navy" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
                  <button onClick={handleVerifyCode} disabled={loading || pin.length < 6} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs">VERIFICAR Y CONTINUAR</button>
                </>
              )}
              <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="mt-6 text-gray-400 text-[10px] font-bold uppercase tracking-widest">Cancelar proceso</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue"><h2 className="text-lg font-light italic flex items-center gap-3"><Shield className="w-5 h-5 text-jw-accent"/> Administración de Cuenta</h2></div>
          <div className="p-8 space-y-6 text-sm">
            <div className="pb-4 border-b border-gray-50 opacity-60"><div className="flex items-center gap-4"><div className="p-2.5 bg-gray-100 rounded-xl text-gray-400"><Hash size={20}/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">ID Personal</p><p className="text-base text-jw-navy font-mono">#{user?.persona_id}</p></div></div></div>
            <div className="pb-4 border-b border-gray-50 opacity-60"><div className="flex items-center gap-4"><div className="p-2.5 bg-gray-100 rounded-xl text-gray-400"><UserCircle size={20}/></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Usuario activo</p><p className="text-base text-jw-navy font-medium">@{user?.username}</p></div></div></div>
            <div className="group"><EditableRow label="Usuario" value="Modificar alias" icon={<UserCircle size={20}/>} onEdit={() => handleEditClick('username')} />{editingField === 'username' && verificationStep === 4 && renderEditForm()}</div>
            <div className="group"><EditableRow label="E-mail" value={user?.email} icon={<Mail size={20}/>} onEdit={() => handleEditClick('email')} />{editingField === 'email' && verificationStep === 4 && renderEditForm()}</div>
            <div className="group"><EditableRow label="Teléfono" value={user?.contacto || 'Cargar teléfono'} icon={<Phone size={20}/>} onEdit={() => handleEditClick('contacto')} />{editingField === 'contacto' && verificationStep === 4 && renderEditForm()}</div>
            <div className="group"><EditableRow label="Contraseña" value="••••••••••••" icon={<Key size={20}/>} onEdit={() => handleEditClick('password')} />{editingField === 'password' && verificationStep === 4 && renderEditForm()}</div>
          </div>
        </section>

        <section id="seguridad" className="bg-white rounded-xl shadow-sm border border-jw-border p-8 scroll-mt-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-jw-body p-6 rounded-2xl border border-jw-border">
                <div className="text-left"><h3 className="text-jw-navy font-medium flex items-center gap-2 leading-tight"><FileText className="w-5 h-5 text-jw-blue" /> Recordatorios de Seguridad</h3><p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold italic">Actualizado: {seguridadDate}</p></div>
                <button onClick={() => navigate('/seguridad-tips')} className="bg-jw-blue text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-jw-navy transition-all shadow-md uppercase tracking-widest">Ver Consejos <ArrowRight className="w-4 h-4" /></button>
            </div>
            {user.es_admin_local && (
                <div className="mt-10 p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl text-left">
                    <h3 className="text-amber-800 font-black text-xs uppercase mb-4 flex items-center gap-2"><ShieldAlert size={18}/> Panel Admin</h3>
                    <textarea className="w-full p-4 rounded-2xl border border-amber-200 text-sm outline-none focus:ring-2 focus:ring-amber-400 mb-4 bg-white" placeholder="Nueva alerta..." rows="3" value={formValues.adminNote || ''} onChange={(e) => setFormValues({...formValues, adminNote: e.target.value})} />
                    <button onClick={async () => { if(!formValues.adminNote) return; setLoading(true); try { await axios.post('/api/save-seguridad-info', { contenido: formValues.adminNote }); setModal({ show: true, type: 'success', title: '¡Hecho!', message: 'Actualizado.' }); setFormValues({...formValues, adminNote: ''}); } catch { setModal({ show: true, type: 'error', title: 'Error', message: 'Fallo al guardar.' }); } finally { setLoading(false); } }} disabled={loading} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-amber-700 transition-all shadow-md">PUBLICAR</button>
                </div>
            )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-red-600 text-white border-b-4 border-red-800"><h2 className="text-lg font-bold italic flex items-center gap-3"><Trash2 className="w-5 h-5"/> Zona de Peligro</h2></div>
          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-left">
                <div><h3 className="text-sm font-black text-red-600 uppercase italic">Desactivar mi acceso</h3><p className="text-xs text-gray-400 font-light italic mt-1 leading-tight">Su cuenta pasará a estado de BAJA permanentemente.</p></div>
                <button onClick={() => handleEditClick('eliminar_cuenta')} className="w-full sm:w-auto bg-red-50 text-red-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm italic">ELIMINAR MI CUENTA</button>
            </div>
            {editingField === 'eliminar_cuenta' && verificationStep === 4 && (
                <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-3xl animate-in slide-in-from-bottom-4 text-left">
                    <div className="flex items-center gap-2 mb-4 text-red-600 font-bold text-[10px] uppercase italic"><ShieldCheck size={14}/> Verificado</div>
                    <p className="text-red-800 text-sm font-light italic mb-6 leading-relaxed">Ha verificado mediante PIN. Al confirmar, su sesión se cerrará inmediatamente.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={processDeleteAccountFinal} disabled={loading} className="flex-1 bg-red-600 text-white p-4 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-red-700">CONFIRMO ELIMINACIÓN</button>
                        <button onClick={() => {setEditingField(null); setVerificationStep(0);}} className="p-4 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
                    </div>
                </div>
            )}
          </div>
        </section>

        {/* SECCIÓN 4: PERFIL PÚBLICO (DATOS DE CONGREGACIÓN RESTAURADOS) */}
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
                <p className="text-lg font-medium text-gray-700 leading-tight">{user?.congregacion_nombre} <span className="text-gray-400 font-light">({user?.numero_congregacion})</span></p>
                {/* DIRECCIÓN Y UBICACIÓN RESTAURADA */}
                <p className="text-sm text-gray-400 italic font-light">
                    {user?.direccion}<br/>
                    {user?.ciudad}, {user?.partido}<br/>
                    {user?.provincia}, {user?.pais} ({user?.region})
                </p>
              </div>
              <div className="bg-jw-body p-6 rounded-2xl border border-jw-border flex items-start gap-4"><HelpCircle className="w-6 h-6 text-jw-blue shrink-0 mt-1" /><div className="text-[13px] text-gray-600 leading-relaxed italic"><p className="font-bold not-italic text-jw-navy mb-1 leading-tight text-sm">¿Necesitas ayuda?</p>Pídale ayuda al <span className="text-jw-blue font-medium not-italic">Anciano Coordinador</span>, <span className="text-jw-blue font-medium not-italic">Anciano Secretario</span> o al <span className="text-jw-blue font-medium not-italic">Anciano de Servicio</span> de su congregación.</div></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ProfilePage;