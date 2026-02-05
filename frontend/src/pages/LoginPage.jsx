import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Lock, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Mail } from 'lucide-react';
import axios from 'axios';

function LoginPage() {
  const { login, user } = useContext(AppContext);
  const [step, setStep] = useState('login'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Visibilidad de contraseñas (Siempre inician en false)
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [tempData, setTempData] = useState(null);
  const [inputs, setInputs] = useState({ username: '', password: '', persona_id: '', pin: '', confirmPass: '' });

  // Si ya hay sesión, ir al inicio
  useEffect(() => { if (user) window.location.href = '/'; }, [user]);

  // Validaciones
  const isPassStrong = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);
  const matches = inputs.password === inputs.confirmPass && inputs.confirmPass !== '';
  const maskEmail = (e) => e ? `${e[0]}**********${e.slice(-10)}` : "";

  // Función para cambiar de paso limpiando todo rastro anterior
  const goToStep = (target) => {
    setErrorMsg('');
    setShowPass(false);
    setShowConfirm(false);
    setStep(target);
  };

  const handleLogin = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await axios.post('/api/login-final', { username: inputs.username, password: inputs.password });
      login(res.data);
    } catch (err) { 
      setErrorMsg("Usuario o clave incorrectos"); 
    } finally { setLoading(false); }
  };

  const startRecoverPass = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await axios.post('/api/identify-user', { username: inputs.username });
      setTempData({ email: res.data.email, type: 'pass' });
      await axios.post('/api/request-pin', { 
        email: res.data.email, 
        username: inputs.username, 
        congregacion: res.data.congregacion_nombre || 'Seguridad' 
      });
      goToStep('verify_pin');
    } catch (err) { 
      setErrorMsg("Nombre de usuario no encontrado"); 
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]">
      <div className="absolute inset-0 bg-jw-navy/40 backdrop-blur-3xl"></div>
      
      <div className="bg-white w-full max-w-[340px] rounded-[2rem] shadow-2xl overflow-hidden relative z-10 border border-white/40 animate-in zoom-in duration-300">
        <div className="p-6 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
            <Lock className="mx-auto mb-2 w-6 h-6 text-jw-accent" />
            <h2 className="text-xs font-black tracking-widest uppercase italic">Sistema de Gestión</h2>
        </div>

        <div className="p-8 space-y-5">
          {/* STEP 1: LOGIN DIRECTO */}
          {step === 'login' && (
            <div className="space-y-4 animate-in fade-in">
              <input 
                className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" 
                placeholder="Usuario" 
                value={inputs.username}
                onChange={(e)=>{setErrorMsg(''); setInputs({...inputs, username: e.target.value})}}
              />
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" 
                  placeholder="Contraseña" 
                  onChange={(e)=>{setErrorMsg(''); setInputs({...inputs, password: e.target.value})}}
                />
                <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {errorMsg && <p className="text-[10px] text-red-500 text-center font-bold">{errorMsg}</p>}
              <button onClick={handleLogin} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs tracking-widest uppercase shadow-lg hover:bg-jw-navy transition-all">
                {loading ? <Loader2 className="animate-spin mx-auto w-4 h-4"/> : 'Entrar'}
              </button>
              <div className="text-center pt-2 space-y-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter cursor-pointer italic">
                <p onClick={()=>goToStep('recover_user_init')} className="hover:text-jw-blue transition-colors">¿Olvidó su usuario?</p>
                <p onClick={()=>goToStep('recover_pass_init')} className="hover:text-jw-blue transition-colors">¿Olvidó su contraseña?</p>
              </div>
            </div>
          )}

          {/* STEP 2: OLVIDÓ USUARIO */}
          {step === 'recover_user_init' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <button onClick={()=>goToStep('login')} className="flex items-center text-[10px] text-gray-400"><ChevronLeft size={14}/> VOLVER</button>
              <h3 className="text-sm font-bold text-jw-navy text-center uppercase italic">Recuperar Usuario</h3>
              <input type="number" className="w-full p-4 bg-jw-body rounded-2xl text-center font-bold border-2 border-transparent focus:border-jw-blue outline-none" placeholder="ID (Ej: 41)" onChange={(e)=>setInputs({...inputs, persona_id: e.target.value})}/>
              <button onClick={async () => {
                setLoading(true);
                try {
                  const res = await axios.post('/api/recover-user-id', { persona_id: inputs.persona_id });
                  setTempData({ email: res.data.email, type: 'user' });
                  await axios.post('/api/request-pin', { email: res.data.email, username: 'Hermano', congregacion: 'Recuperación' });
                  goToStep('verify_pin');
                } catch { setErrorMsg("ID no encontrado"); }
                finally { setLoading(false); }
              }} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest">Enviar PIN</button>
              {errorMsg && <p className="text-[10px] text-red-500 text-center">{errorMsg}</p>}
            </div>
          )}

          {/* STEP 3: OLVIDÓ PASS */}
          {step === 'recover_pass_init' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <button onClick={()=>goToStep('login')} className="flex items-center text-[10px] text-gray-400"><ChevronLeft size={14}/> VOLVER</button>
              <h3 className="text-sm font-bold text-jw-navy text-center uppercase italic">Recuperar Clave</h3>
              <input className="w-full p-4 bg-jw-body rounded-2xl text-center italic text-sm border-2 border-transparent focus:border-jw-blue outline-none" placeholder="Nombre de Usuario" onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              <button onClick={startRecoverPass} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest">
                {loading ? 'BUSCANDO...' : 'SIGUIENTE'}
              </button>
              {errorMsg && <p className="text-[10px] text-red-500 text-center">{errorMsg}</p>}
            </div>
          )}

          {/* STEP 4: VERIFICAR PIN */}
          {step === 'verify_pin' && (
            <div className="text-center space-y-4 animate-in zoom-in">
              <p className="text-xs text-gray-500 italic font-light">PIN enviado a:<br/><b>{maskEmail(tempData?.email)}</b></p>
              <input maxLength="6" className="w-full text-center text-3xl tracking-[0.4em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none text-jw-navy" onChange={(e)=>setInputs({...inputs, pin: e.target.value})}/>
              <button onClick={async () => {
                try {
                  await axios.post('/api/verify-pin', { pin: inputs.pin });
                  if (tempData.type === 'user') {
                    await axios.post('/api/send-username-real', { email: tempData.email });
                    goToStep('success_msg_user');
                  } else { goToStep('new_pass'); }
                } catch { alert("PIN Incorrecto"); }
              }} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-xs uppercase shadow-lg">Verificar</button>
            </div>
          )}

          {/* STEP 5: NUEVA CLAVE (CON OJOS) */}
          {step === 'new_pass' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
               <h3 className="text-xs font-bold text-jw-navy text-center uppercase italic">Restablecer Clave</h3>
               <div className="relative">
                 <input 
                   type={showPass ? "text" : "password"} 
                   className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center transition-all ${isPassStrong(inputs.password) ? 'border-green-500' : 'border-transparent'}`} 
                   placeholder="Clave Nueva" 
                   onChange={(e)=>setInputs({...inputs, password: e.target.value})}
                 />
                 <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>
               <div className="relative">
                 <input 
                   type={showConfirm ? "text" : "password"} 
                   className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center transition-all ${matches ? 'border-green-500' : 'border-transparent'}`} 
                   placeholder="Confirmar" 
                   onChange={(e)=>setInputs({...inputs, confirmPass: e.target.value})}
                 />
                 <button onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-4 top-4 text-gray-400">{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>
               <button onClick={async () => {
                  await axios.post('/api/reset-password', { username: inputs.username, new_password: inputs.password });
                  goToStep('success_msg_pass');
                }} disabled={!matches || !isPassStrong(inputs.password)} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase disabled:opacity-20 shadow-lg">Guardar e Ingresar</button>
            </div>
          )}

          {/* STEP 6: ÉXITO */}
          {(step === 'success_msg_user' || step === 'success_msg_pass') && (
            <div className="text-center space-y-4 animate-in fade-in">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-sm font-medium text-jw-navy italic leading-relaxed">
                {step === 'success_msg_user' ? "Su usuario fue enviado por email." : "Su contraseña ha sido actualizada satisfactoriamente."}
              </p>
              <button onClick={()=>goToStep('login')} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase">Ir al Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;