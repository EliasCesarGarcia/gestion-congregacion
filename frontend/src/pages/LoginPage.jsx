import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Lock, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Mail, ShieldCheck } from 'lucide-react';
import axios from 'axios';

function LoginPage() {
  const { login, user } = useContext(AppContext);
  const [step, setStep] = useState('login'); // login, recover_user_init, recover_pass_init, verify_pin, new_pass, success_msg
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [tempData, setTempData] = useState(null); // { email, type: 'user' | 'pass' }
  const [inputs, setInputs] = useState({ username: '', password: '', persona_id: '', pin: '', confirmPass: '' });

  useEffect(() => { if (user) window.location.href = '/'; }, [user]);

  const isPassStrong = (p) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(p);
  const maskEmail = (e) => e ? `${e[0]}**********${e.slice(-10)}` : "";

  // --- ACCIONES ---
  const handleLogin = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await axios.post('/api/login-final', { username: inputs.username, password: inputs.password });
      login(res.data);
    } catch (err) { setErrorMsg("Usuario o clave incorrectos"); }
    finally { setLoading(false); }
  };

  const startRecoverUser = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/recover-user-id', { persona_id: inputs.persona_id });
      setTempData({ email: res.data.email, type: 'user' });
      await axios.post('/api/request-pin', { email: res.data.email, username: 'Hermano', congregacion: 'Recuperación' });
      setStep('verify_pin');
    } catch (err) { setErrorMsg("ID de persona no encontrado"); }
    finally { setLoading(false); }
  };

  const startRecoverPass = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/identify-user', { username: inputs.username });
      setTempData({ email: res.data.email, type: 'pass' });
      await axios.post('/api/request-pin', { email: res.data.email, username: inputs.username, congregacion: 'Seguridad' });
      setStep('verify_pin');
    } catch (err) { setErrorMsg("Usuario no encontrado"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]">
      <div className="absolute inset-0 bg-jw-navy/40 backdrop-blur-3xl"></div>
      
      <div className="bg-white w-full max-w-[340px] rounded-[2rem] shadow-2xl overflow-hidden relative z-10 border border-white/40 animate-in zoom-in duration-300">
        <div className="p-6 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
            <Lock className="mx-auto mb-2 w-6 h-6 text-jw-accent" />
            <h2 className="text-xs font-black tracking-widest uppercase">Sistema de Gestión</h2>
        </div>

        <div className="p-8 space-y-5">
          {/* 1. LOGIN NORMAL */}
          {step === 'login' && (
            <div className="space-y-4 animate-in fade-in">
              <input className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" placeholder="Usuario" onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" placeholder="Contraseña" onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
                <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
              {errorMsg && <p className="text-[10px] text-red-500 text-center font-bold italic">{errorMsg}</p>}
              <button onClick={handleLogin} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs tracking-widest uppercase shadow-lg hover:bg-jw-navy transition-all">{loading ? <Loader2 className="animate-spin mx-auto w-4 h-4"/> : 'Entrar'}</button>
              <div className="text-center pt-2 space-y-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter cursor-pointer italic">
                <p onClick={()=>setStep('recover_user_init')} className="hover:text-jw-blue">¿Olvidó su usuario?</p>
                <p onClick={()=>setStep('recover_pass_init')} className="hover:text-jw-blue">¿Olvidó su contraseña?</p>
              </div>
            </div>
          )}

          {/* 2. RECUOPERAR USUARIO (ID) */}
          {step === 'recover_user_init' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <button onClick={()=>setStep('login')} className="flex items-center text-[10px] text-gray-400"><ChevronLeft size={14}/> VOLVER</button>
              <h3 className="text-sm font-bold text-jw-navy text-center uppercase italic">Recuperar Usuario</h3>
              <input type="number" className="w-full p-4 bg-jw-body rounded-2xl text-center font-bold outline-none border-2 border-transparent focus:border-jw-blue" placeholder="Número de Usuario (ID)" onChange={(e)=>setInputs({...inputs, persona_id: e.target.value})}/>
              {errorMsg && <p className="text-[10px] text-red-500 text-center">{errorMsg}</p>}
              <button onClick={startRecoverUser} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest">Enviar PIN</button>
            </div>
          )}

          {/* 3. RECUPERAR PASS (USERNAME) */}
          {step === 'recover_pass_init' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
              <button onClick={()=>setStep('login')} className="flex items-center text-[10px] text-gray-400"><ChevronLeft size={14}/> VOLVER</button>
              <h3 className="text-sm font-bold text-jw-navy text-center uppercase italic">Recuperar Clave</h3>
              <input className="w-full p-4 bg-jw-body rounded-2xl text-center italic text-sm outline-none border-2 border-transparent focus:border-jw-blue" placeholder="Nombre de Usuario" onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              {errorMsg && <p className="text-[10px] text-red-500 text-center">{errorMsg}</p>}
              <button onClick={startRecoverPass} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest">Siguiente</button>
            </div>
          )}

          {/* 4. VERIFICAR PIN (Paso común) */}
          {step === 'verify_pin' && (
            <div className="text-center space-y-4 animate-in zoom-in">
              <p className="text-xs text-gray-500 italic">PIN enviado a:<br/><b>{maskEmail(tempData?.email)}</b></p>
              <input maxLength="6" className="w-full text-center text-3xl tracking-[0.4em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none text-jw-navy" onChange={(e)=>setInputs({...inputs, pin: e.target.value})}/>
              <button onClick={async () => {
                try {
                    await axios.post('/api/verify-pin', { pin: inputs.pin });
                    if (tempData.type === 'user') {
                        await axios.post('/api/send-username-real', { email: tempData.email });
                        setStep('success_msg');
                    } else { setStep('new_pass'); }
                } catch { alert("PIN Incorrecto"); }
              }} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-xs uppercase">Verificar</button>
            </div>
          )}

          {/* 5. NUEVA CLAVE */}
          {step === 'new_pass' && (
            <div className="space-y-4 animate-in slide-in-from-right-4">
               <h3 className="text-xs font-bold text-jw-navy text-center uppercase italic font-black">Restablecer Clave</h3>
               <div className="relative">
                 <input type={showPass ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center ${isPassStrong(inputs.password) ? 'border-green-500' : 'border-transparent'}`} placeholder="Clave Nueva" onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
                 <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>
               <div className="relative">
                 <input type={showConfirm ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 text-sm text-center ${inputs.password === inputs.confirmPass && inputs.confirmPass !== '' ? 'border-green-500' : 'border-transparent'}`} placeholder="Confirmar" onChange={(e)=>setInputs({...inputs, confirmPass: e.target.value})}/>
                 <button onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-4 top-4 text-gray-400">{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>
               <button onClick={async () => {
                  await axios.post('/api/reset-password', { username: inputs.username, new_password: inputs.password });
                  setStep('success_msg_pass');
                }} disabled={inputs.password !== inputs.confirmPass || !isPassStrong(inputs.password)} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase disabled:opacity-20 shadow-lg">Guardar y Acceder</button>
            </div>
          )}

          {/* 6. MENSAJES DE ÉXITO */}
          {(step === 'success_msg' || step === 'success_msg_pass') && (
            <div className="text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center"><CheckCircle2 size={32}/></div>
              <p className="text-sm font-medium text-jw-navy italic leading-relaxed">
                {step === 'success_msg' ? "Su nombre de usuario ha sido enviado vía E-mail satisfactoriamente." : "Su contraseña ha sido actualizada con éxito."}
              </p>
              <button onClick={()=>setStep('login')} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase">Ir al Login</button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default LoginPage;