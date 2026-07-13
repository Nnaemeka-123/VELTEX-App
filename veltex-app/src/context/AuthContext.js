import React, { createContext, useContext, useEffect, useState } from "react";
import { api, saveToken, clearToken, getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      // We don't have a /me endpoint yet in the backend — for now, presence
      // of a token means "logged in" and screens refetch what they need.
      setUser(token ? { hasToken: true } : null);
      setLoading(false);
    })();
  }, []);

  async function signup(username, email, password) {
    const { data } = await api.post("/auth/signup", { username, email, password });
    await saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    await saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
