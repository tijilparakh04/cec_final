import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import CountriesPage from './pages/CountriesPage.jsx';
import CountryEditPage from './pages/CountryEditPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import AdminShell from './components/AdminShell.jsx';
import { useAdminAuth } from './state/adminAuth.js';



function RequireAuth({ children }) {
  const { token, loading } = useAdminAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding: 20, color: 'var(--tx2)' }}>Loading…</div>;
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const { init } = useAdminAuth();

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route path="" element={<Navigate to="/countries" replace />} />
        <Route path="countries" element={<CountriesPage />} />
        <Route path="countries/:iso3/edit" element={<CountryEditPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />


      </Route>
    </Routes>
  );
}


