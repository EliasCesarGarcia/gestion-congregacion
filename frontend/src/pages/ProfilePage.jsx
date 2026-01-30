import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { User, Shield, Mail, Key, Camera, Loader2, Eye, EyeOff, UserCircle, HelpCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal'; // Importamos el componente nuevo

function ProfilePage() {
  const { user, login } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null });
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formValues, setFormValues] = useState({ newValue: '', currentPass: '', confirmPass: '' });
  const fileInputRef = useRef(null);
  const [imgTimestamp, setImgTimestamp] = useState(Date.now());
  const urlBase = `https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/`;

  // --- VALIDACIONES ---
  const isEmailValid = (email) => /\S+@\S+\.\S+/.test(email);
  const isPassStrong = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);

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
      setModal({ show: true, type: 'success', title: '¡Hecho!', message: 'Los datos se han actualizado correctamente.' });
      setEditingField(null);
    } catch (err) {
      setModal({ show: true, type: 'error', title: 'Error', message: 'No se pudo actualizar la información.' });
    } finally { setLoading(false); }
  };

  const handleSaveClick = () => {
    // 1. Validar Email
    if (editingField === 'email' && !isEmailValid(formValues.newValue)) {
      setModal({ show: true, type: 'error', title: 'Email Inválido', message: 'Por favor, ingresa un formato de correo correcto (ejemplo@empresa.com)' });
      return;
    }
    // 2. Validar Contraseña (Igualdad)
    if (editingField === 'password' && formValues.newValue !== formValues.confirmPass) {
      setModal({ show: true, type: 'error', title: 'Error de coincidencia', message: 'Las nuevas contraseñas no son iguales.' });
      return;
    }
    // 3. Validar Contraseña (Fuerza)
    if (editingField === 'password' && !isPassStrong(formValues.newValue)) {
      setModal({ show: true, type: 'error', title: 'Contraseña Débil', message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.' });
      return;
    }

    // Si todo está bien, pedir confirmación
    setModal({ 
      show: true, 
      type: 'confirm', 
      title: '¿Confirmar cambios?', 
      message: `Estás a punto de cambiar tu ${editingField === 'username' ? 'nombre de usuario' : editingField}. ¿Deseas continuar?`,
      onConfirm: processUpdate 
    });
  };

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4">
      <Modal 
        isOpen={modal.show} 
        type={modal.type} 
        title={modal.title} 
        message={modal.message} 
        onConfirm={modal.onConfirm}
        onClose={() => setModal({ ...modal, show: false })}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3"><Shield className="w-5 h-5 text-jw-accent"/> Administración de Cuenta</h2>
          </div>
          <div className="p-8 space-y-8 text-sm">
            <EditableRow label="Nombre de Usuario" value={`@${user?.username}`} icon={<UserCircle className="text-gray-400 w-5 h-5"/>} onEdit={() => setEditingField('username')} />
            <EditableRow label="Correo Electrónico" value={user?.email} icon={<Mail className="text-gray-400 w-5 h-5"/>} onEdit={() => setEditingField('email')} />
            <EditableRow label="Seguridad / Contraseña" value="••••••••••••" icon={<Key className="text-gray-400 w-5 h-5"/>} onEdit={() => setEditingField('password')} />

            {editingField && (
              <div className="mt-4 p-6 bg-jw-body rounded-2xl border border-jw-border animate-in slide-in-from-top-4">
                <h3 className="text-sm font-bold text-jw-navy mb-6 uppercase italic">Modificar {editingField === 'username' ? 'Nombre de Usuario' : editingField}</h3>
                <div className="space-y-4 max-w-md">
                  {editingField === 'password' ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <input type={showCurrent ? "text" : "password"} placeholder="Contraseña Actual" className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none text-sm"/>
                        <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-3 text-gray-400">{showCurrent ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                      </div>
                      <div className="relative">
                        <input type={showNew ? "text" : "password"} placeholder="Nueva Contraseña" onChange={(e)=>setFormValues({...formValues, newValue: e.target.value})} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none text-sm"/>
                        <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-3 text-gray-400">{showNew ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                      </div>
                      <div className="relative">
                        <input type={showConfirm ? "text" : "password"} placeholder="Confirmar Nueva Contraseña" onChange={(e)=>setFormValues({...formValues, confirmPass: e.target.value})} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none text-sm"/>
                        <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-gray-400">{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                      </div>
                    </div>
                  ) : (
                    <input 
                      type={editingField === 'email' ? 'email' : 'text'}
                      placeholder={`Ingresar nuevo ${editingField === 'username' ? 'nombre de usuario' : 'email'}`}
                      className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none text-sm"
                      onChange={(e) => setFormValues({...formValues, newValue: e.target.value})}
                    />
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveClick} disabled={loading} className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-jw-navy transition-all">Confirmar</button>
                    <button onClick={() => setEditingField(null)} className="p-3 text-gray-400 text-xs font-bold uppercase">Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECCIÓN PERFIL PÚBLICO */}
        <section className="bg-white rounded-2xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b-4 border-jw-blue">
            <h2 className="text-lg font-light italic flex items-center gap-3"><User className="w-5 h-5 text-jw-accent"/> Mi perfil público</h2>
          </div>
          <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start">
            <div className="relative">
              <div className="w-44 h-44 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                {loading ? <Loader2 className="w-10 h-10 text-jw-blue animate-spin"/> : user?.foto_url ? 
                  <img src={`${urlBase}${user.foto_url}?v=${imgTimestamp}`} alt="P" className="w-full h-full object-cover object-center" /> 
                  : <User className="w-16 h-16 text-gray-300"/>}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleUpdateImage} className="hidden" accept="image/*"/>
              <button onClick={() => fileInputRef.current.click()} className="absolute bottom-2 right-2 bg-jw-blue text-white p-3 rounded-full shadow-lg hover:scale-110 transition-all"><Camera className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 space-y-6 text-center md:text-left pt-4">
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label><p className="text-2xl font-medium text-jw-navy leading-tight">{user?.nombre_completo}</p></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-jw-blue italic">Congregación</label>
                <p className="text-lg font-medium text-gray-700">{user?.congregacion_nombre} ({user?.numero_congregacion})</p>
                <p className="text-sm text-gray-400 italic font-light">{user?.direccion}, {user?.ciudad}, {user?.partido}</p>
              </div>
              <div className="bg-jw-body p-6 rounded-2xl border border-jw-border flex items-start gap-4">
                <HelpCircle className="w-6 h-6 text-jw-blue shrink-0 mt-1" />
                <div className="text-[13px] text-gray-600 leading-relaxed italic text-left">
                  <p className="font-bold not-italic text-jw-navy mb-1">¿Necesitas ayuda con tu perfil?</p>
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

function EditableRow({ label, value, icon, onEdit }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-50 pb-4 group">
      <div className="flex items-center gap-4 text-left">
        <div className="p-2 bg-jw-body rounded-lg group-hover:bg-blue-50 transition-colors">{icon}</div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-base text-jw-navy font-medium tracking-tight">{value}</p>
        </div>
      </div>
      <button onClick={onEdit} className="bg-jw-body px-4 py-2 rounded-lg text-jw-blue font-bold text-[10px] hover:bg-jw-blue hover:text-white transition-all uppercase tracking-widest">Modificar</button>
    </div>
  );
}

export default ProfilePage;