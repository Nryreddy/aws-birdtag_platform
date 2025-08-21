import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [jwtToken, setJwtToken] = useState(() => localStorage.getItem("jwtToken"));

  // Derive user info from the token if needed (optional)
  // For example, if your token is a JWT, you can decode it to get user info.
  // Otherwise, just store user info separately or fetch from API.

  // Add isAuthenticated flag:
  const isAuthenticated = Boolean(jwtToken);

  useEffect(() => {
    if (jwtToken) {
      localStorage.setItem("jwtToken", jwtToken);
    } else {
      localStorage.removeItem("jwtToken");
    }
  }, [jwtToken]);

  const login = (token) => {
    setJwtToken(token);
  };

  const logout = () => {
    setJwtToken(null);
    localStorage.removeItem("jwtToken");
  };

  return (
    <AuthContext.Provider value={{ jwtToken, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
