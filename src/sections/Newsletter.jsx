import React, { useState } from 'react';
import { Button } from '../components/common/Button';
import { MailIcon, CheckCircleIcon, AlertCircleIcon } from '../components/common/icons';
import './Newsletter.css';

/**
 * Sección Formulario de Novedades (Newsletter) de URBAN STYLE
 * Título: "EL ESTILO EMPIEZA AQUÍ"
 * Texto: "Descubre novedades, colecciones y promociones directamente en tu correo."
 * Botón: "QUIERO RECIBIR NOVEDADES"
 * Modo demostrativo: Valida el correo y confirma visualmente sin almacenar datos reales.
 */
export const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Validación básica del formato de correo electrónico
  const validateEmail = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Por favor, ingresa tu dirección de correo electrónico.';
    }
    // Regex estándar para comprobación básica de email (RFC 5322 simplificado)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return 'Por favor, ingresa un correo electrónico válido (ejemplo: usuario@dominio.com).';
    }
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateEmail(email);

    if (error) {
      setErrorMessage(error);
      return;
    }

    // Validación exitosa en modo demostración (sin backend de correo activo)
    setErrorMessage('');
    setSubmittedEmail(email.trim());
    setIsSubmitted(true);
    setEmail('');
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmittedEmail('');
    setErrorMessage('');
  };

  return (
    <section
      id="novedades"
      className="newsletter-section"
      aria-labelledby="newsletter-title"
    >
      <div className="container">
        <div className="newsletter-card reveal-on-scroll">
          <div className="newsletter-content">
            {/* Tag oficial */}
            <div className="newsletter-badge">
              <span className="newsletter-badge-dot" aria-hidden="true" />
              <span className="newsletter-badge-text">COMUNIDAD URBAN STYLE</span>
            </div>

            {/* Título Oficial */}
            <h2 id="newsletter-title" className="newsletter-title">
              EL ESTILO EMPIEZA AQUÍ
            </h2>

            {/* Texto Oficial */}
            <p className="newsletter-description">
              Descubre novedades, colecciones y promociones directamente en tu correo.
            </p>

            {/* FORMULARIO O CONFIRMACIÓN */}
            {!isSubmitted ? (
              <form
                className="newsletter-form"
                onSubmit={handleSubmit}
                noValidate
                aria-label="Suscripción a novedades de URBAN STYLE"
              >
                <div className="newsletter-input-group">
                  {/* Etiqueta accesible */}
                  <label htmlFor="newsletter-email" className="sr-only">
                    Correo electrónico para recibir novedades
                  </label>

                  <div className="newsletter-input-wrapper">
                    <span className="newsletter-input-icon" aria-hidden="true">
                      <MailIcon size={20} />
                    </span>
                    <input
                      id="newsletter-email"
                      name="email"
                      type="email"
                      className={`newsletter-input ${errorMessage ? 'has-error' : ''}`}
                      placeholder="Ingresa tu correo electrónico..."
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      aria-invalid={errorMessage ? 'true' : 'false'}
                      aria-describedby={errorMessage ? 'newsletter-error-msg' : 'newsletter-demo-note'}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="newsletter-btn"
                  >
                    QUIERO RECIBIR NOVEDADES
                  </Button>
                </div>

                {/* Mensaje de error accesible */}
                {errorMessage && (
                  <div
                    id="newsletter-error-msg"
                    className="newsletter-error"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircleIcon size={16} className="error-icon" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Aviso transparente de prototipo */}
                <p id="newsletter-demo-note" className="newsletter-demo-notice">
                  * Formulario en modo demostración. No registra suscripciones reales ni almacena datos personales.
                </p>
              </form>
            ) : (
              /* CONFIRMACIÓN VISUAL DEMOSTRATIVA */
              <div
                className="newsletter-confirmation-box"
                role="status"
                aria-live="polite"
              >
                <div className="confirmation-header">
                  <div className="confirmation-icon-circle">
                    <CheckCircleIcon size={28} className="confirmation-icon" />
                  </div>
                  <div>
                    <h3 className="confirmation-title">
                      ¡Formato de Correo Validado con Éxito!
                    </h3>
                    <span className="confirmation-email-tag">
                      {submittedEmail}
                    </span>
                  </div>
                </div>

                <p className="confirmation-explanation">
                  <strong>Aviso demostrativo:</strong> La validación visual del formulario
                  funcionó correctamente. Dado que aún no existe un servicio de correo ni base
                  de datos conectada, este prototipo <strong>no registra suscripciones reales</strong> ni
                  almacena tu información.
                </p>

                <div className="confirmation-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="confirmation-btn-reset"
                  >
                    Probar con otro correo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
