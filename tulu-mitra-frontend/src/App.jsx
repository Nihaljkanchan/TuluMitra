import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { ToastProvider } from "./components/Toast";
import Home from "./pages/Home";
import Dictionary from "./pages/Dictionary";
import Translate from "./pages/Translate";
import Learn from "./pages/Learn";
import About from "./pages/About";
import Admin from "./pages/Admin";
import NameDialog from "./components/NameDialog";
import useProfile from "./hooks/useProfile";
import useAuth from "./hooks/useAuth";
import Login from "./pages/Login";
import { authApi } from "./services/api";
import { getAuth, setAuth } from "./services/auth";
import { startSync } from "./services/sync";

function ScrollReset() {
  const { pathname } = useLocation();
  // Braces matter: newer Chrome returns a value from scrollTo, and an effect
  // must return nothing (or a clean-up function) or React crashes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const profile = useProfile();
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    const open = () => setEditingName(true);
    window.addEventListener("tulumitra:edit-name", open);
    return () => window.removeEventListener("tulumitra:edit-name", open);
  }, []);

  const auth = useAuth();
  const signedIn = auth?.mode === "google";

  // Signed in: check the session is still valid, refresh the account
  // details, and keep saving changes to the account.
  useEffect(() => {
    if (!signedIn) return undefined;
    authApi
      .me()
      .then(({ user }) => {
        const a = getAuth();
        if (a?.mode === "google") setAuth({ ...a, user });
      })
      .catch((err) => {
        if (err?.status === 401) setAuth(null); // expired: back to the login page
      });
    return startSync();
  }, [signedIn]);

  // The login page comes first, until the person signs in or continues as a guest.
  if (location.pathname === "/login")
    return (
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
  if (!auth) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // First visit: ask the name (Google accounts already have one).
  const askName = (!profile.asked && !signedIn) || editingName;

  return (
    <ToastProvider>
      <div className="app">
        <Navbar />
        <ScrollReset />
        <main key={location.pathname} className="main">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/translate" element={<Translate />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/about" element={<About />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        {!isHome && <Footer />}
        {askName && <NameDialog initial={profile.name} onClose={() => setEditingName(false)} />}
      </div>
    </ToastProvider>
  );
}
