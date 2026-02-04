import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user_session');
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!user) return;
    let timer = setTimeout(logout, 10 * 60 * 1000); // 10 min
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, 10 * 60 * 1000); };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keypress', reset);
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keypress', reset);
      clearTimeout(timer);
    };
  }, [user, logout]);

  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem('user_session', JSON.stringify(userData));
  };

  return (
    <AppContext.Provider value={{ user, login, logout }}>
      {children}
    </AppContext.Provider>
  );
}