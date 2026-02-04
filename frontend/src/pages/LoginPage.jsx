import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Lock, User, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Mail } from 'lucide-react';
import axios from 'axios';

function LoginPage() {
  const { login, user } = useContext(AppContext);
  const [step, setStep] = useState('login'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [recoveryData, setRecoveryData] = useState(null);
  const [inputs, setInputs] = useState({ username: '', password: '', persona_id: '', pin: '', confirmPass: '' });

  useEffect(() => { if (user) window.location.href = '/'; }, [user]);

  const isPassStrong = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);
  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}**********${name.slice(-1)}@${domain}`;
  };

  const handleLogin = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await axios.post('/api/login-final', { username: inputs.username, password: inputs.password });
      login(res.data);
    } catch (err) { setErrorMsg("Usuario o clave incorrectos"); }
    finally { setLoading(false); }
  };

  const startRecovery = async (type) => {
    setLoading(true);
    try {
      const url = type === 'user' ? '/api/recover-user-id' : '/api/identify-user';
      const body = type === 'user' ? { persona_id: inputs.persona_id } : { username: inputs.username };
      const res = await axios.post(url, body);
      setRecoveryData({ ...res.data, type });
      await axios.post('/api/request-pin', { email: res.data.email, username: inputs.username || 'Hermano', congregacion: 'Recuperación' });
      setStep('verify_pin');
    } catch (err) { setErrorMsg("Datos no encontrados"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]">
      <div className="absolute inset-0 bg-jw-navy/40 backdrop-blur-3xl"></div>
      
      <div className="bg-white w-full max-w-[340px] rounded-[2rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in duration-300">
        <div className="p-6 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
            <Lock className="mx-auto mb-2 w-6 h-6 text-jw-accent" />
            <h2 className="text-xs font-black tracking-widest uppercase">Sistema de Gestión</h2>
        </div>

        <div className="p-8 space-y-5">
          {step === 'login' && (
            <div className="space-y-4">
              <input className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center" placeholder="Usuario" onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center" placeholder="Contraseña" onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
                <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
              {errorMsg && <p className="text-[10px] text-red-500 text-center font-bold">{errorMsg}</p>}
              <button onClick={handleLogin} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs tracking-widest uppercase shadow-lg">
                {loading ? <Loader2 className="animate-spin mx-auto w-4 h-4"/> : 'Entrar'}
              </button>
              <div className="text-center pt-2 space-y-2">
                <p onClick={()=>setStep('forgot_user')} className="text-[10px] text-gray-400 font-bold cursor-pointer hover:text-jw-blue uppercase">¿Olvidó su usuario?</p>
                <p onClick={()=>setStep('forgot_pass')} className="text-[10px] text-gray-400 font-bold cursor-pointer hover:text-jw-blue uppercase">¿Olvidó su contraseña?</p>
              </div>
            </div>
          )}

          {step === 'forgot_user' && (
            <div className="space-y-4 text-center">
              <button onClick={()=>setStep('login')} className="flex items-center text-[10px] text-gray-400"><ChevronLeft size={14}/> VOLVER</button>
              <h3 className="text-sm font-bold text-jw-navy uppercase italic">Recuperar Usuario</h3>
              <input type="number" className="w-full p-4 bg-jw-body rounded-2xl text-center" placeholder="Número de Usuario (Ej: 41)" onChange={(e)=>setInputs({...inputs, persona_id: e.target.value})}/>
              <button onClick={()=>startRecovery('user')} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs uppercase">Siguiente</button>
            </div>
          )}

          {step === 'verify_pin' && (
            <div className="text-center space-y-4">
              <p className="text-xs text-gray-500 italic">PIN enviado a:<br/><b>{maskEmail(recoveryData?.email)}</b></p>
              <input maxLength="6" className="w-full text-center text-3xl tracking-[0.4em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none" onChange={(e)=>setInputs({...inputs, pin: e.target.value})}/>
              <button onClick={async () => { 
                await axios.post('/api/verify-pin', {pin: inputs.pin});
                setStep(recoveryData.type === 'user' ? 'success_user' : 'new_pass');
              }} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-xs uppercase">Verificar</button>
            </div>
          )}

          {step === 'new_pass' && (
            <div className="space-y-4">
               <h3 className="text-xs font-bold text-jw-navy text-center uppercase">Nueva Contraseña</h3>
               <div className="relative">
                 <input type={showPass ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center ${isPassStrong(inputs.password) ? 'border-green-500' : 'border-transparent'}`} placeholder="Clave nueva" onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
               </div>
               <div className="relative">
                 <input type={showConfirm ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center ${inputs.password === inputs.confirmPass && inputs.confirmPass !== '' ? 'border-green-500' : 'border-transparent'}`} placeholder="Confirmar" onChange={(e)=>setInputs({...inputs, confirmPass: e.target.value})}/>
               </div>
               <button onClick={async () => { await axios.post('/api/reset-password', { username: inputs.username, new_password: inputs.password }); setStep('login'); }} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase">Guardar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;