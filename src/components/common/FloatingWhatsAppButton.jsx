import React, { useState, useEffect } from 'react';
import './FloatingWhatsAppButton.css';

export function FloatingWhatsAppButton() {
  const [siteSettings, setSiteSettings] = useState({
    contactWhatsapp: '',
    whatsappMessage: '¡Hola URBAN STYLE! Me gustaría recibir información sobre sus prendas y colecciones.'
  });

  useEffect(() => {
    let isMounted = true;
    fetch('/api/site-settings')
      .then((res) => (res.ok ? res.json() : Promise.reject('No site-settings')))
      .then((data) => {
        if (isMounted && data?.success && data?.data) {
          setSiteSettings(data.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const whatsappCleanNumber = (siteSettings.contactWhatsapp || '3001234567').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappCleanNumber}?text=${encodeURIComponent(
    siteSettings.whatsappMessage || '¡Hola URBAN STYLE! Me gustaría recibir información sobre sus prendas.'
  )}`;

  return (
    <div className="floating-whatsapp-container" aria-label="Contacto por WhatsApp">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-whatsapp-btn"
        aria-label="Abrir chat de WhatsApp con URBAN STYLE"
      >
        <span className="floating-whatsapp-tooltip">Chatea con nosotros</span>
        <svg
          viewBox="0 0 24 24"
          className="floating-whatsapp-icon"
          aria-hidden="true"
        >
          <path d="M12.031 2C6.505 2 2.016 6.489 2.016 12.016c0 1.95.556 3.774 1.517 5.322L2 22.031l4.832-1.503a10.02 10.02 0 0 0 5.199 1.503c5.526 0 10.016-4.489 10.016-10.015C22.047 6.489 17.557 2 12.031 2zm0 18.271a8.23 8.23 0 0 1-4.225-1.157l-.303-.18-2.866.892.909-2.793-.197-.314a8.243 8.243 0 0 1-1.266-4.703c0-4.557 3.708-8.265 8.266-8.265 4.558 0 8.266 3.708 8.266 8.265 0 4.558-3.708 8.256-8.266 8.256zm4.536-6.19c-.248-.124-1.468-.724-1.696-.807-.227-.083-.393-.124-.559.124-.165.248-.641.807-.786.973-.145.165-.29.186-.538.062-.248-.124-1.047-.386-1.995-1.231-.738-.658-1.236-1.471-1.381-1.719-.145-.248-.016-.382.108-.506.112-.112.248-.29.373-.435.124-.145.165-.248.248-.414.083-.166.041-.311-.021-.435-.062-.124-.559-1.347-.766-1.844-.201-.484-.405-.418-.559-.426l-.476-.008c-.166 0-.435.062-.662.311-.228.248-.87 0.85-.87 2.073 0 1.223.891 2.404 1.015 2.57.124.166 1.752 2.675 4.244 3.751.593.256 1.056.409 1.417.524.595.189 1.137.162 1.565.098.477-.071 1.468-.6 1.675-1.18.207-.58.207-1.077.145-1.18-.062-.103-.228-.165-.476-.289z" />
        </svg>
      </a>
    </div>
  );
}

export default FloatingWhatsAppButton;
