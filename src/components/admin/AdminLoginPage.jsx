import React, { useState, useEffect } from 'react';
import './AdminLoginPage.css';

export const AdminLoginPage = ({ onLoginSuccess, onReturnToStore }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [lockedCountdown, setLockedCountdown] = useState(null);
  const [remainingAttempts, setRemainingAttempts] = useState(null);

  // Manejar cuenta regresiva en caso de bloqueo 429
  useEffect(() => {
    if (!lockedCountdown || lockedCountdown <= 0) return;
    const timer = setInterval(() => {
      setLockedCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMessage(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedCountdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || lockedCountdown) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Envía y recibe Cookies HttpOnly
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await res.json();

      if (res.status === 429) {
        // Bloqueo por fuerza bruta
        const seconds = data.remainingSeconds || 900;
        setLockedCountdown(seconds);
        setErrorMessage(data.message || 'Demasiados intentos fallidos. Acceso bloqueado temporalmente.');
        return;
      }

      if (res.ok && data.success) {
        setPassword('');
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        setErrorMessage(data.message || 'Credenciales de acceso incorrectas.');
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch (err) {
      setErrorMessage('Error de conexión con el servidor de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-wrapper">
        
        {/* ENCABEZADO DE MARCA */}
        <div className="admin-login-brand">
          <span className="brand-pill">URBAN STYLE BACKOFFICE</span>
          <h1 className="brand-title">Acceso Administrativo</h1>
          <p className="brand-subtitle">
            Portal exclusivo para gestión de pedidos, trazabilidad y logística.
          </p>
        </div>

        {/* TARJETA DE FORMULARIO */}
        <div className="admin-login-box">
          <div className="login-security-notice">
            <span className="shield-icon">🛡️</span>
            <div>
              <strong>Conexión Cifrada y Segura</strong>
              <p>Sesión gestionada mediante tokens criptográficos y cookies HttpOnly.</p>
            </div>
          </div>

          {/* ALERTA DE ERROR O BLOQUEO */}
          {errorMessage && (
            <div className={`login-alert ${lockedCountdown ? 'alert-danger' : 'alert-warning'}`} role="alert">
              <span className="alert-icon">{lockedCountdown ? '⏳' : '⚠️'}</span>
              <div className="alert-content">
                <strong>{lockedCountdown ? 'Acceso Bloqueado Temporalmente' : 'Error de Autenticación'}</strong>
                <p>{errorMessage}</p>
                {lockedCountdown && (
                  <p className="countdown-text">
                    Podrás reintentar en: <strong>{formatCountdown(lockedCountdown)}</strong>
                  </p>
                )}
                {!lockedCountdown && remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts < 5 && (
                  <p className="attempts-text">
                    Intentos restantes antes de bloqueo temporal: <strong>{remainingAttempts}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form" noValidate>
            
            {/* CAMPO USUARIO */}
            <div className="form-group">
              <label htmlFor="admin-username" className="form-label">
                Usuario Administrador
              </label>
              <div className="input-group">
                <span className="input-prefix">@</span>
                <input
                  id="admin-username"
                  type="text"
                  className="form-control"
                  placeholder="Ej: admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={isLoading || !!lockedCountdown}
                  required
                />
              </div>
            </div>

            {/* CAMPO CONTRASEÑA */}
            <div className="form-group">
              <div className="label-with-action">
                <label htmlFor="admin-password" className="form-label">
                  Contraseña
                </label>
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="input-group">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading || !!lockedCountdown}
                  required
                />
              </div>
            </div>

            {/* BOTÓN DE ENVÍO */}
            <button
              type="submit"
              className="btn-admin-submit"
              disabled={isLoading || !!lockedCountdown || !username.trim() || !password}
            >
              {isLoading ? (
                <span className="loading-spinner">Validando credenciales...</span>
              ) : lockedCountdown ? (
                `Bloqueado (${formatCountdown(lockedCountdown)})`
              ) : (
                'Iniciar Sesión Segura →'
              )}
            </button>
          </form>

          {/* PIE DE PÁGINA DEL LOGIN */}
          <div className="admin-login-footer">
            <button
              type="button"
              className="btn-return-store"
              onClick={onReturnToStore}
            >
              ← Volver a la tienda URBAN STYLE
            </button>
          </div>
        </div>

        {/* NOTA DE AUDITORÍA */}
        <p className="admin-audit-note">
          Todas las solicitudes e intentos de acceso son monitoreados y registrados en la base de datos para auditoría de seguridad.
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
