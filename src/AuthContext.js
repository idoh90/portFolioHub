import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

const ALLOWED = {
  'yanai': 'Yanai',
  'ido': 'Ido',
  'ofek': 'Ofek',
  'megi': 'Megi',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(storedUser);
  }, []);

  const login = (pw) => {
    const name = ALLOWED[pw];
    if (name) {
      setUser(name);
      localStorage.setItem('user', name);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
} 