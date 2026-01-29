import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { User, Shield, Mail, Key, Camera, Loader2, CheckCircle2, AlertCircle, X, Check, Eye, EyeOff, UserCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { supabase } from '../lib/supabase';

function ProfilePage() {
  const { user, login } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [editingField, setEditingField] = useState(null); // 'email', 'username', 'password'
  const [modal, setModal] = useState({ show: false, type: '', message: '' });
  const [showPass, setShowPass] = useState(false);
  const fileInputRef = useRef(null);

  const [formValues, setFormValues] = useState({ newValue: '', currentPass: '', confirmPass: '' });

  const urlBase = "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  // --- LÓGICA DE IMAGEN (REEMPLAZO) ---
  const handleUpdateImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const options = { maxSizeMB: 0.3, maxWidthOrHeight: 500, useWebWorker: true };
      const compressed = await imageCompression(file, options);
      
      // NOMBRE FIJO: perfil_ID.jpg para que reemplace siempre el mismo archivo
      const fileName = `perfil_${user.persona_id}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('People_profile')
        .upload(fileName, compressed, { upsert: true }); // UPSERT reemplaza el archivo

      if (uploadError) throw uploadError;

      await axios.post('/api/upload-foto', { persona_id: String(user.persona_id), foto_url: fileName });
      login({ ...user, foto_url: fileName });
      setModal({ show: true, type: 'success', message: 'Imagen de perfil actualizada correctamente.' });
    } catch (err) {
      setModal({ show: true, type: 'error', message: 'No se pudo subir la imagen.' });
    } finally { setLoading(false); }
  };

  // --- LÓGICA DE ACTUALIZACIÓN DE DATOS ---
  const handleSaveData = async () => {
    if (!formValues.newValue) return;
    setLoading(true);
    try {
      await axios.post('/api/update-profile', {
        persona_id: String(user.persona_id),
        usuario_id: user.id,
        campo: editingField,
        valor: formValues.newValue
      });
      
      // Actualizamos estado local
      const updatedUser = { ...user, [editingField]: formValues.newValue };
      login(updatedUser);
      setModal({ show: true, type: 'success', message: `¡${editingField} actualizado con éxito!` });
      setEditingField(null);
    } catch (err) {
      const msg = err.response?.status === 409 ? "Ese nombre de usuario ya existe." : "Error al actualizar.";
      setModal({ show: true, type: 'error', message: msg });
    } finally { setLoading(false); }
  };

  const isPassValid = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4">
      {/* MODAL GLOBAL */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-jw-navy/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            {modal.type === 'success' ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4"/> : <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4"/>}
            <h3 className="text-xl font-medium text-jw-navy mb-6">{modal.message}</h3>
            <button onClick={() => setModal({show:false})} className="w-full bg-jw-navy text-white py-3 rounded-xl font-bold">ENTENDIDO</button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* SECCIÓN CUENTA Y SEGURIDAD */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white"><h2 className="text-lg font-light italic flex items-center gap-3"><Shield className="w-5 h-5 text-jw-accent"/> Administración de Cuenta</h2></div>
          
          <div className="p-8 space-y-8">
            {/* USERNAME */}
            <EditableRow 
                label="Nombre de Usuario" 
                value={`@${user?.username}`} 
                icon={<UserCircle className="text-gray-400 w-5 h-5"/>}
                onEdit={() => setEditingField('username')}
            />

            {/* EMAIL */}
            <EditableRow 
                label="Correo Personal" 
                value={user?.email} 
                icon={<Mail className="text-gray-400 w-5 h-5"/>}
                onEdit={() => setEditingField('email')}
            />

            {/* PASSWORD */}
            <EditableRow 
                label="Seguridad" 
                value="••••••••••••" 
                icon={<Key className="text-gray-400 w-5 h-5"/>}
                onEdit={() => setEditingField('password')}
            />

            {/* FORMULARIO DINÁMICO ÚNICO */}
            {editingField && (
                <div className="mt-4 p-6 bg-jw-body rounded-2xl border border-jw-border animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-sm font-bold text-jw-navy mb-4 uppercase italic">Modificar {editingField}</h3>
                    
                    <div className="space-y-4 max-w-md">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-400">Dato Actual</label>
                            <p className="text-jw-navy font-medium opacity-60">
                                {editingField === 'password' ? 'Confidencial' : user[editingField]}
                            </p>
                        </div>

                        {editingField !== 'password' ? (
                            <input 
                                type="text" 
                                placeholder={`Ingresar nuevo ${editingField}`}
                                className="w-full p-3 rounded-xl border border-jw-border outline-none focus:ring-2 focus:ring-jw-blue bg-white"
                                onChange={(e) => setFormValues({...formValues, newValue: e.target.value})}
                            />
                        ) : (
                            <div className="space-y-3">
                                <input type="password" placeholder="Contraseña Actual" className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none"/>
                                <div className="relative">
                                    <input type={showPass ? "text" : "password"} placeholder="Nueva Contraseña" onChange={(e) => setFormValues({...formValues, newValue: e.target.value})} className="w-full p-3 rounded-xl border border-jw-border bg-white outline-none"/>
                                    <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                                </div>
                                {!isPassValid(formValues.newValue) && formValues.newValue && (
                                    <p className="text-[10px] text-red-500 italic">Debe tener 8 caracteres, una Mayúscula, un Número y un Símbolo.</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button 
                                onClick={handleSaveData}
                                disabled={loading || (editingField === 'password' && !isPassValid(formValues.newValue))}
                                className="flex-1 bg-jw-blue text-white p-3 rounded-xl font-bold text-sm disabled:bg-gray-300"
                            >
                                {loading ? 'PROCESANDO...' : 'CONFIRMAR CAMBIO'}
                            </button>
                            <button onClick={() => setEditingField(null)} className="p-3 text-gray-400 font-bold text-sm">CANCELAR</button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </section>

        {/* SECCIÓN PERFIL PÚBLICO (Mantenemos tu diseño con object-cover) */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
            <div className="p-5 bg-jw-navy text-white border-b border-white/10"><h2 className="text-lg font-light italic flex items-center gap-3"><User className="w-5 h-5 text-jw-accent"/> Mi perfil público</h2></div>
            <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start">
                <div className="relative">
                    <div className="w-44 h-44 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                        {loading ? <Loader2 className="w-10 h-10 text-jw-blue animate-spin"/> : user?.foto_url ? <img src={`${urlBase}${user.foto_url}`} alt="P" className="w-full h-full object-cover object-center" key={user.foto_url}/> : <User className="w-16 h-16 text-gray-300"/>}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleUpdateImage} className="hidden" accept="image/*"/>
                    <button onClick={() => fileInputRef.current.click()} className="absolute bottom-2 right-2 bg-jw-blue text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform"><Camera className="w-5 h-5"/></button>
                </div>
                <div className="flex-1 space-y-6 text-center md:text-left pt-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label><p className="text-2xl font-medium text-jw-navy">{user?.nombre_completo}</p></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-jw-blue">Congregación Local</label><p className="text-lg font-medium text-gray-700">{user?.congregacion_nombre} <span className="text-gray-400 font-light">({user?.numero_congregacion})</span></p><p className="text-sm text-gray-400 italic">{user?.direccion}, {user?.ciudad}, {user?.partido}</p></div>
                </div>
            </div>
        </section>
      </div>
    </div>
  );
}

// Subcomponente para las filas editables
function EditableRow({ label, value, icon, onEdit }) {
    return (
        <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <div className="flex items-center gap-4">
                {icon}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                    <p className="text-base text-jw-navy font-medium">{value}</p>
                </div>
            </div>
            <button onClick={onEdit} className="bg-jw-body px-4 py-2 rounded-lg text-jw-blue font-medium text-xs hover:bg-jw-blue hover:text-white transition-all uppercase tracking-widest">Modificar</button>
        </div>
    );
}

export default ProfilePage;