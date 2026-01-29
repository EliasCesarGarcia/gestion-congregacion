import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { User, Shield, Mail, Key, Trash2, Camera, HelpCircle, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { supabase } from '../lib/supabase';

function ProfilePage() {
  const { user, login } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // URL base para mostrar la imagen (Asegúrate que el BUCKET sea 'People_profile')
  const urlBase = "https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/";

  // --- LÓGICA DE SUBIDA DE IMAGEN ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    console.log("🚀 Iniciando proceso de imagen para:", file.name);

    try {
      // 1. Comprimir (500KB máximo)
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      console.log("📦 Imagen comprimida con éxito");

      // 2. Generar nombre único usando el ID de persona
      const fileName = `${user.persona_id}_perfil_${Date.now()}.jpg`;

      // 3. Subir a Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('People_profile')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true // Si el archivo existe, lo reemplaza
        });

      if (uploadError) {
        console.error("❌ Error de Supabase Storage:", uploadError.message);
        throw new Error("No se pudo subir el archivo al servidor de imágenes.");
      }

      console.log("✅ Archivo físico subido a Storage:", data.path);

      // 4. Avisar a Go para actualizar la base de datos
      await axios.post('/api/upload-foto', {
        persona_id: String(user.persona_id),
        foto_url: fileName
      });

      // 5. ACTUALIZAR ESTADO SIN PERDER DATOS DEL USUARIO
      const updatedUser = { 
        ...user, 
        foto_url: fileName 
      };
      
      login(updatedUser);
      console.log("✨ Perfil actualizado en el sistema");
      alert("¡Imagen actualizada correctamente!");

    } catch (error) {
      console.error("❌ Error completo:", error);
      alert(error.message || "Error desconocido al procesar la imagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* SECCIÓN 1: CUENTA DE USUARIO */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b border-white/10">
            <h2 className="text-lg font-medium flex items-center gap-3 italic">
              <Shield className="w-5 h-5 text-jw-accent" /> Cuenta de usuario
            </h2>
          </div>
          <div className="p-6 space-y-4 text-sm">
            <div className="flex justify-between items-center border-b border-jw-body pb-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuario de acceso</p>
                <p className="text-lg font-medium text-jw-navy">@{user?.username}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-jw-blue mt-1" />
                <div>
                  <p className="font-medium text-gray-700">Correo personal</p>
                  <p className="text-gray-500 italic">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="w-4 h-4 text-jw-blue mt-1" />
                <div>
                  <p className="font-medium text-gray-700">Seguridad</p>
                  <p className="text-xs text-gray-400 italic">Contraseña actualizada</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: MI PERFIL */}
        <section className="bg-white rounded-xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-5 bg-jw-navy text-white border-b border-white/10">
            <h2 className="text-lg font-medium flex items-center gap-3 italic">
              <User className="w-5 h-5 text-jw-accent" /> Mi perfil público
            </h2>
          </div>

          <div className="p-8 flex flex-col md:flex-row gap-10 items-center md:items-start">
            {/* COMPONENTE DE IMAGEN CON ESTADO DE CARGA */}
            <div className="relative">
              <div className="w-40 h-40 rounded-full border-4 border-jw-body shadow-xl overflow-hidden bg-jw-body flex items-center justify-center">
                {loading ? (
                  <Loader2 className="w-10 h-10 text-jw-blue animate-spin" />
                ) : user?.foto_url ? (
                  <img 
                    src={`${urlBase}${user.foto_url}`} 
                    alt="Perfil" 
                    className="w-full h-full object-cover"
                    key={user.foto_url} // Obliga a React a refrescar la imagen
                    onError={(e) => e.target.style.display = 'none'}
                  />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
              </div>
              
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              
              <button 
                onClick={() => fileInputRef.current.click()}
                disabled={loading}
                className="absolute bottom-2 right-2 bg-jw-blue text-white p-3 rounded-full shadow-lg hover:scale-110 transition-transform disabled:bg-gray-400"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {/* INFO PERSONAL Y DE CONGREGACIÓN */}
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label>
                <p className="text-2xl font-medium text-jw-navy leading-tight">{user?.nombre_completo}</p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Congregación Local</label>
                <p className="text-lg font-medium text-gray-700">
                  {user?.congregacion_nombre} <span className="text-jw-blue">({user?.numero_congregacion})</span>
                </p>
                <p className="text-sm text-gray-500 italic mt-1">
                  {user?.direccion}, {user?.ciudad}, {user?.partido}, {user?.provincia}
                </p>
              </div>

              <div className="bg-jw-body p-5 rounded-xl border border-jw-border flex items-start gap-4">
                <HelpCircle className="w-5 h-5 text-jw-blue shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 italic">
                  Pídale al coordinador o al secretario ayuda con la configuración de su cuenta.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default ProfilePage;