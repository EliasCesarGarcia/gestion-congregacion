import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Lock, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ChevronLeft, HelpCircle, RefreshCcw } from 'lucide-react';
import axios from 'axios';

function LoginPage() {
  const { login, user } = useContext(AppContext);
  
  // Estados de navegación
  const [step, setStep] = useState('login'); 
  const [recoveryType, setRecoveryType] = useState(''); 
  
  // Estados de control
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tempEmail, setTempEmail] = useState('');

  // Datos de entrada
  const [inputs, setInputs] = useState({ 
    username: '', 
    password: '', 
    persona_id: '', 
    numero_cong: '', 
    telefono: '', 
    pin: '', 
    confirmPass: '' 
  });

  useEffect(() => { if (user) window.location.href = '/'; }, [user]);

  // Añade este useEffect después de los otros que ya tienes
useEffect(() => {
  // Intentar capturar datos si el navegador autocompleta al cargar
  const timer = setTimeout(() => {
    const userField = document.querySelector('input[placeholder="Usuario"]');
    const passField = document.querySelector('input[placeholder="Contraseña"]');
    
    if (userField?.value || passField?.value) {
      setInputs(prev => ({
        ...prev,
        username: userField?.value || prev.username,
        password: passField?.value || prev.password
      }));
    }
  }, 500);
  return () => clearTimeout(timer);
}, [step]);

  // --- VARIABLES DE VALIDACIÓN (DEFINIDAS AL INICIO PARA EVITAR PANTALLA EN BLANCO) ---
  const hasUpper = /[A-Z]/.test(inputs.password);
  const hasNumber = /\d/.test(inputs.password);
  const hasSymbol = /[!@#$%^&*]/.test(inputs.password);
  const hasMin = inputs.password.length >= 8;
  const passwordsMatch = inputs.password === inputs.confirmPass && inputs.confirmPass !== '';
  const canSavePassword = hasUpper && hasNumber && hasSymbol && hasMin && passwordsMatch;
  const canSendPin = (inputs.persona_id && inputs.numero_cong.length >= 4) || (inputs.telefono.length === 8);

  // --- FUNCIONES DE APOYO ---
  const maskEmail = (email) => {
    if (!email) return "";
    const [name, domain] = email.split("@");
    return `${name[0]}${"*".repeat(name.length - 2)}${name.slice(-1)}@${domain}`;
  };

  const resetAll = () => {
    setStep('login');
    setErrorMsg('');
    setLoading(false);
    setShowPass(false);
    setInputs({ username: '', password: '', persona_id: '', numero_cong: '', telefono: '', pin: '', confirmPass: '' });
  };

  const handleNumericInput = (e, field, max) => {
    const val = e.target.value.replace(/\D/g, ""); 
    setInputs({ ...inputs, [field]: val.slice(0, max) });
    setErrorMsg('');
  };

  // --- MANEJADORES DE ACCIONES ---

  const handleLoginDirect = async () => {
    setLoading(true); setErrorMsg('');
    try {
      await axios.post('/api/identify-user', { username: inputs.username });
      const res = await axios.post('/api/login-final', { username: inputs.username, password: inputs.password });
      login(res.data);
    } catch (err) {
      setErrorMsg("El usuario y/o contraseña no es correcto.");
    } finally { setLoading(false); }
  };

  const startRecovery = async (type) => {
    setLoading(true); setErrorMsg('');
    const metodo = inputs.telefono.length === 8 ? 'phone' : 'id_cong';
    try {
      // Si es pass, validamos usuario antes de seguir
      if (type === 'pass') {
        await axios.post('/api/identify-user', { username: inputs.username });
      }

      const res = await axios.post('/api/recover-user-id', { 
        metodo, persona_id: inputs.persona_id, numero_congregacion: inputs.numero_cong, telefono: inputs.telefono 
      });
      setTempEmail(res.data.email);
      setRecoveryType(type);
      await axios.post('/api/request-pin', { 
        email: res.data.email, 
        username: inputs.username || 'Hermano', 
        congregacion: inputs.numero_cong || 'SISTEMA' 
      });
      setStep('verify_pin');
    } catch (err) {
      setErrorMsg("Los datos ingresados no existen en el sistema.");
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    setLoading(true); setErrorMsg('');
    try {
      await axios.post('/api/verify-pin', { pin: inputs.pin });
      if (recoveryType === 'user') {
        await axios.post('/api/send-username-real', { email: tempEmail });
        setStep('success');
      } else {
        setStep('new_pass');
      }
    } catch {
      setErrorMsg("PIN Incorrecto o expirado.");
    } finally { setLoading(false); }
  };

  const handleFinalReset = async () => {
    setLoading(true);
    try {
      await axios.post('/api/reset-password', { username: inputs.username, new_password: inputs.password });
      setStep('success');
    } catch {
      setErrorMsg("Error al guardar la contraseña.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]">
      <div className="absolute inset-0 bg-jw-navy/40 backdrop-blur-3xl"></div>
      
      <div className="bg-white w-full max-w-[340px] rounded-[2rem] shadow-2xl overflow-hidden relative z-10 border border-white/40 animate-in zoom-in duration-300">
        <div className="p-4 bg-jw-navy text-white text-center border-b-4 border-jw-blue">
            <Lock className="mx-auto mb-1 w-5 h-5 text-jw-accent" />
            <h2 className="text-xs font-black tracking-widest uppercase italic leading-tight">Sistema de Gestión</h2>
        </div>

        <div className="p-6">
          {/* 1. LOGIN */}
          {step === 'login' && (
            <div className="space-y-4 animate-in fade-in">
              <input className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" placeholder="Usuario" value={inputs.username} onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="w-full p-4 bg-jw-body rounded-2xl outline-none focus:ring-2 focus:ring-jw-blue text-sm text-center italic" placeholder="Contraseña" value={inputs.password} onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
                <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
              {errorMsg && <p className="text-[10px] text-red-500 text-center font-bold italic">{errorMsg}</p>}
              <button onClick={handleLoginDirect} disabled={loading} className="w-full bg-jw-blue text-white py-4 rounded-2xl font-bold text-xs tracking-widest uppercase shadow-lg disabled:opacity-30">Entrar</button>
              <div className="text-center pt-1 space-y-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter cursor-pointer italic">
                <p onClick={() => { setRecoveryType('user'); setStep('identify'); }} className="hover:text-jw-blue transition-all">¿Olvidó su usuario?</p>
                <p onClick={() => { setRecoveryType('pass'); setStep('identify'); }} className="hover:text-jw-blue transition-all">¿Olvidó su contraseña?</p>
              </div>
            </div>
          )}

          {/* 2. IDENTIFICACIÓN */}
          {step === 'identify' && (
            <div className="space-y-3 animate-in slide-in-from-right-4 text-left">
              <h3 className="text-xs font-bold text-jw-navy text-center uppercase italic border-b border-gray-100 pb-2">Identificación de Cuenta</h3>
              
              {recoveryType === 'pass' && (
                <input className="w-full p-3 bg-jw-body rounded-xl outline-none text-center text-sm border border-jw-blue/10 italic" placeholder="Su Nombre de Usuario" value={inputs.username} onChange={(e)=>setInputs({...inputs, username: e.target.value})}/>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-1">ID Usuario</label>
                  <input type="text" value={inputs.persona_id} className="w-full p-3 bg-jw-body rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-jw-blue text-sm" placeholder="000" onChange={(e)=>handleNumericInput(e, 'persona_id', 3)}/>
                </div>
                <div className="flex-[1.5]">
                  <label className="text-[8px] font-black text-gray-400 uppercase ml-1">N° Congregación</label>
                  <input type="text" value={inputs.numero_cong} className="w-full p-3 bg-jw-body rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-jw-blue text-sm" placeholder="0000" onChange={(e)=>handleNumericInput(e, 'numero_cong', 4)}/>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl flex gap-2 border border-blue-100">
                <HelpCircle size={14} className="text-jw-blue shrink-0 mt-0.5" />
                <p className="text-[9px] text-blue-800 leading-tight italic">Consulte al <b>Anciano Coordinador, Secretario o de Servicio</b> si no recuerda sus datos.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase block text-center italic">O ingrese los últimos 8 números del celular</label>
                <input type="text" value={inputs.telefono} className="w-full p-3 bg-jw-body rounded-xl text-center font-bold outline-none focus:ring-2 focus:ring-jw-blue text-sm" placeholder="00000000" onChange={(e)=>handleNumericInput(e, 'telefono', 8)}/>
              </div>

              {errorMsg && <p className="text-[10px] text-red-500 text-center font-bold italic">{errorMsg}</p>}

              <div className="flex flex-col gap-2 pt-1">
                <button onClick={()=>startRecovery(recoveryType)} disabled={!canSendPin || loading} className="w-full bg-jw-blue text-white py-3 rounded-xl font-bold text-[10px] uppercase shadow-md disabled:opacity-20 transition-all italic tracking-widest">Enviar PIN</button>
                <button onClick={resetAll} className="w-full py-2 bg-gray-200 text-jw-navy font-black text-[10px] uppercase tracking-widest border border-gray-300 rounded-lg transition-all italic">Cancelar</button>
              </div>
            </div>
          )}

          {/* 3. VERIFICAR PIN */}
          {step === 'verify_pin' && (
            <div className="text-center space-y-4 animate-in zoom-in">
              <p className="text-xs text-gray-500 italic">PIN enviado al correo:<br/><b>{maskEmail(tempEmail)}</b></p>
              <input maxLength="6" value={inputs.pin} className="w-full text-center text-3xl tracking-[0.4em] font-black p-4 bg-jw-body rounded-2xl border-2 border-jw-blue outline-none text-jw-navy" onChange={(e)=>setInputs({...inputs, pin: e.target.value.replace(/\D/g, "")})}/>
              <button onClick={handleVerifyCode} disabled={loading || inputs.pin.length < 6} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-xs uppercase shadow-lg">Verificar</button>
              <div className="flex justify-between items-center px-1 pt-1">
                  <button onClick={resetAll} className="text-[9px] font-black text-jw-navy uppercase hover:underline">Cancelar</button>
                  <button onClick={()=>startRecovery(recoveryType)} className="text-[9px] font-bold text-jw-blue uppercase flex items-center gap-1 hover:underline"><RefreshCcw size={10}/> Reenviar PIN</button>
              </div>
            </div>
          )}

          {/* 4. NUEVA CLAVE */}
          {step === 'new_pass' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 text-left">
               <div className="flex items-center gap-2 mb-1 text-green-600 font-bold text-[10px] uppercase tracking-widest italic"><CheckCircle2 size={14}/> Identidad Verificada</div>
               <h3 className="text-xs font-bold text-jw-navy text-center uppercase italic border-b border-gray-100 pb-2">Nueva Seguridad</h3>
               
               <div className="relative">
                 <input type={showPass ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 transition-all text-sm text-center italic ${hasMin && hasUpper && (hasNumber || hasSymbol) ? 'border-green-500 bg-green-50 text-green-700' : 'border-transparent'}`} placeholder="Clave Nueva" onChange={(e)=>setInputs({...inputs, password: e.target.value})}/>
                 <button onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>

               <div className="relative">
                 <input type={showConfirm ? "text" : "password"} className={`w-full p-4 bg-jw-body rounded-2xl outline-none border-2 transition-all text-sm text-center italic ${passwordsMatch ? 'border-green-500 bg-green-50 text-green-700' : 'border-transparent'}`} placeholder="Confirmar Clave" onChange={(e)=>setInputs({...inputs, confirmPass: e.target.value})}/>
                 <button onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-4 top-4 text-gray-400">{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
               </div>
               
               <div className="text-[9px] space-y-1 bg-jw-body p-3 rounded-xl italic">
                  <p className={hasMin ? "text-green-600 font-bold" : "text-gray-400"}>• Mínimo 8 caracteres {hasMin && <CheckCircle2 size={10} className="inline ml-1"/>}</p>
                  <p className={hasUpper ? "text-green-600 font-bold" : "text-gray-400"}>• Una Mayúscula {hasUpper && <CheckCircle2 size={10} className="inline ml-1"/>}</p>
                  <p className={(hasNumber && hasSymbol) ? "text-green-600 font-bold" : "text-gray-400"}>• Número y Símbolo {(hasNumber && hasSymbol) && <CheckCircle2 size={10} className="inline ml-1"/>}</p>
               </div>

               <button onClick={handleFinalReset} disabled={!canSavePassword || loading} className="w-full bg-jw-navy text-white py-4 rounded-2xl font-bold text-xs uppercase disabled:opacity-20 shadow-lg italic transition-all">Guardar e Ingresar</button>
               <button onClick={resetAll} className="w-full py-2 bg-gray-200 text-jw-navy font-black text-[10px] uppercase tracking-widest border border-gray-300 rounded-lg italic transition-all">Cancelar</button>
            </div>
          )}

          {/* 5. ÉXITO (Redirección 4 seg) */}
          {step === 'success' && <SuccessView onFinish={resetAll} action={recoveryType} />}
        </div>
      </div>
    </div>
  );
}

function SuccessView({ onFinish, action }) {
    const [count, setCount] = useState(4);
    useEffect(() => {
        const timer = setInterval(() => setCount(prev => prev - 1), 1000);
        const redirect = setTimeout(onFinish, 4000);
        return () => { clearInterval(timer); clearTimeout(redirect); };
    }, [onFinish]);

    return (
        <div className="text-center space-y-4 animate-in fade-in py-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center shadow-inner"><CheckCircle2 size={32}/></div>
            <h3 className="text-jw-navy font-bold italic uppercase tracking-tighter">¡Operación Exitosa!</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed italic text-center">
              {action === 'user' ? 'Su nombre de usuario ha sido enviado al correo.' : 'Su contraseña ha sido actualizada satisfactoriamente.'}
              <br/><br/>Regresando al inicio en {count}...
            </p>
        </div>
    );
}

export default LoginPage;