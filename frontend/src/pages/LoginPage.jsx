function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
        <h2 className="text-3xl font-black text-center text-gray-800 mb-8 tracking-tight">Iniciar Sesión</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 text-center">Usuario / Email</label>
            <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 text-center">Contraseña</label>
            <input type="password" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-95">
            ENTRAR AL PANEL
          </button>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;