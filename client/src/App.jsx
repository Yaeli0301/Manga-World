import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/layout/AppLayout";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MangaDetails from "./pages/MangaDetails";
import Reader from "./pages/Reader";
import TranslatorPanel from "./pages/TranslatorPanel";
import AdminPanel from "./pages/AdminPanel";

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const pathWithQuery = `${location.pathname}${location.search}`;
    const next =
      pathWithQuery && pathWithQuery !== "/login" && pathWithQuery !== "/register"
        ? `?next=${encodeURIComponent(pathWithQuery)}`
        : "";
    return <Navigate to={`/login${next}`} replace />;
  }
  if (role && !user.roles?.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function I18nSync() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (user?.language) i18n.changeLanguage(user.language);
  }, [user?.language, i18n]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nSync />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/read/:chapterId" element={<Reader />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/search" element={<Search />} />
            <Route
              path="/favorites"
              element={
                <Guard>
                  <Favorites />
                </Guard>
              }
            />
            <Route
              path="/profile"
              element={
                <Guard>
                  <Profile />
                </Guard>
              }
            />
            <Route path="/manga/:id" element={<MangaDetails />} />
            <Route
              path="/translator"
              element={
                <Guard role="translator">
                  <TranslatorPanel />
                </Guard>
              }
            />
            <Route
              path="/admin"
              element={
                <Guard role="admin">
                  <AdminPanel />
                </Guard>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
