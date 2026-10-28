import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { SesionAdministrativa } from '../types/api';
import { login } from '../services/authService';
import { ErrorApi } from '../services/api';

interface LoginProps {
  onLogin: (sesion: SesionAdministrativa) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const correoLimpio = correo.trim();
    if (!correoLimpio || !contrasena) {
      setError('Correo y contraseña son requeridos');
      return;
    }

    setCargando(true);

    try {
      const sesion = await login({
        correo: correoLimpio,
        contrasena,
      });

      onLogin(sesion);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.esNoAutenticado) {
          setError('Credenciales administrativas inválidas');
        } else if (err.esPeticionInvalida) {
          setError(err.message || 'Correo y contraseña son requeridos');
        } else {
          setError(err.message || 'Error al comunicarse con el servidor');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-12 selection:bg-[#fb8500]/30 selection:text-white overflow-hidden">
      {/* Luces y texturas ambientales de fondo */}
      <div className="absolute top-1/4 -left-36 w-96 h-96 bg-[#fb8500]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-36 w-96 h-96 bg-[#f95738]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Contenedor principal con efecto glassmorphism oscuro y borde sutil */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/60 p-7 sm:p-9">
          {/* Cabecera institucional de marca */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#fb8500] to-[#f95738] p-0.5 shadow-lg shadow-[#fb8500]/25 flex items-center justify-center mb-4 transition-transform hover:scale-105">
              <div className="w-full h-full rounded-[14px] bg-slate-950/20 backdrop-blur-sm flex items-center justify-center text-white">
                <ShieldCheck size={28} className="drop-shadow-sm" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/70 border border-slate-700/60 text-xs font-medium text-slate-300 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#fb8500] animate-pulse" />
              Find-U · Seguridad Universitaria
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Panel Administrativo
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Custodia, seguimiento y verificación de objetos perdidos en el campus
            </p>
          </div>

          {/* Mensaje de error accesible */}
          {error && (
            <div
              role="alert"
              data-testid="error-msg"
              className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-start gap-3 animate-in fade-in duration-200"
            >
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="correo"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Correo institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  id="correo"
                  name="correo"
                  type="email"
                  autoComplete="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  disabled={cargando}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-[#fb8500] focus:ring-2 focus:ring-[#fb8500]/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="admin@ejemplo.edu"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="contrasena"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Contraseña
                </label>
                <span className="text-[11px] text-slate-400">Credencial cifrada</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  id="contrasena"
                  name="contrasena"
                  type={mostrarContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  disabled={cargando}
                  required
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-[#fb8500] focus:ring-2 focus:ring-[#fb8500]/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasena(!mostrarContrasena)}
                  disabled={cargando}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none disabled:opacity-50"
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarContrasena ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#fb8500] to-[#f95738] hover:from-[#e07500] hover:to-[#e04828] active:scale-[0.99] shadow-lg shadow-[#fb8500]/20 hover:shadow-[#fb8500]/30 transition-all focus:outline-none focus:ring-2 focus:ring-[#fb8500] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group cursor-pointer"
            >
              {cargando ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Entrar al Panel</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pie de página institucional */}
        <div className="mt-8 text-center text-xs text-slate-400 space-y-1">
          <p className="flex items-center justify-center gap-1.5 font-medium">
            <Lock size={12} className="text-[#fb8500]" />
            Acceso restringido a personal de servicios y administradores
          </p>
          <p className="text-slate-400">
            Find-U · Plataforma Universitaria de Objetos Perdidos
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
