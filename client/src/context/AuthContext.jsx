import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken, getToken } from "../services/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/api/auth/me");
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(payload) {
        const { data } = await api.post("/api/auth/login", payload);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        const { data } = await api.post("/api/auth/register", payload);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        setToken(null);
        setUser(null);
      },
      async patchProfile(body) {
        const { data } = await api.patch("/api/auth/me", body);
        setUser(data.user);
        return data.user;
      },
      refresh,
      hasRole: (r) => Boolean(user?.roles?.includes(r)),
    }),
    [user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
