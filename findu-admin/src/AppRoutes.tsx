import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import DashboardView from './components/DashboardView';
import ObjectsView from './components/ObjectsView';
import AplicacionLayout from './components/AplicacionLayout';
import type { Administrador, SesionAdministrativa } from './types/api';
import {
  cerrarSesion,
  guardarSesion,
  restaurarSesion,
} from './services/authService';
import { configurarManejador401 } from './services/api';

export type AdminData = Administrador;

const RutaLegacyNoEncontrada: React.FC = () => (
  <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <section className="text-center">
      <p className="text-5xl font-bold text-gray-800">404</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">Ruta no encontrada</h1>
      <p className="mt-2 text-gray-600">La ruta solicitada ya no está disponible.</p>
    </section>
  </main>
);

const AppRoutes: React.FC = () => {
  // Inicialización perezosa validada estrictamente contra reloj actual
  const [sesion, setSesion] = useState<SesionAdministrativa | null>(() => {
    return restaurarSesion(Date.now());
  });

  // Configurar manejador global para 401 (despacha limpieza y regreso a login)
  useEffect(() => {
    configurarManejador401(() => {
      cerrarSesion();
      setSesion(null);
    });

    return () => {
      configurarManejador401(null);
    };
  }, []);

  const handleLogin = (datos: SesionAdministrativa) => {
    guardarSesion(datos);
    setSesion(datos);
  };

  const handleLogout = () => {
    cerrarSesion();
    setSesion(null);
  };

  // Perfil compatible con componentes que aún esperan campos inglés/español
  const adminParaVistas: AdminData | null = useMemo(() => {
    if (!sesion) return null;
    return sesion.administrador;
  }, [sesion]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admins/*" element={<RutaLegacyNoEncontrada />} />
        <Route path="/reports/*" element={<RutaLegacyNoEncontrada />} />
        <Route path="/delivered/*" element={<RutaLegacyNoEncontrada />} />
        {/* LOGIN */}
        <Route
          path="/login"
          element={
            !sesion ? (
              <Login onLogin={handleLogin} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* RUTAS PROTEGIDAS POR SESION VALIDA */}
        <Route
          path="/"
          element={
            sesion && adminParaVistas ? (
              <AplicacionLayout admin={adminParaVistas} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="reportes" element={<ObjectsView />} />
          {/* La ruta cliente histórica se conserva como redirección interna no HTTP. */}
          <Route path="objects" element={<Navigate to="/reportes" replace />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* CUALQUIER OTRA RUTA */}
        <Route
          path="*"
          element={<Navigate to={sesion ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
