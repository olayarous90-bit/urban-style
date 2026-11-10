import React, { useState, useEffect } from 'react';
import './AdminSiteSettingsSection.css';

const DEFAULT_FORM = {
  storeName: 'URBAN STYLE',
  tagline: 'TU ESTILO. TUS REGLAS.',
  description: 'Tienda de moda urbana contemporánea para hombres y mujeres. Diseños que combinan comodidad, actitud y autenticidad sin límites.',
  contactEmail: 'contacto@urbanstyle.com.co',
  contactPhone: '',
  contactWhatsapp: '',
  whatsappMessage: '¡Hola URBAN STYLE! Me gustaría recibir información sobre sus prendas y colecciones.',
  contactHours: 'Lunes a Sábado: 9:00 AM – 7:00 PM (Hora Colombia)',
  city: 'Bogotá D.C., Colombia',
  address: '',
  businessName: '',
  nit: '',
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: ''
  }
};

export const AdminSiteSettingsSection = ({ onToast }) => {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'contact', 'social', 'legal'

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/site-settings', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setFormData((prev) => ({
            ...prev,
            ...json.data,
            social: {
              ...prev.social,
              ...(json.data.social || {})
            }
          }));
        }
      }
    } catch {
      showToast('Error cargando configuración del sitio', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    if (onToast) onToast(msg, type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        showToast('Configuración del sitio guardada exitosamente en Neon PostgreSQL');
      } else {
        const err = await res.json();
        alert(err.message || 'Error al guardar configuración');
      }
    } catch {
      alert('Error de conexión al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-site-settings-module">
      {/* CABECERA */}
      <div className="site-settings-header">
        <div>
          <div className="settings-badge-row">
            <span className="settings-pill-tag">GESTIÓN DEL SITIO & FOOTER</span>
            <span className="settings-sync-tag">● Sincronizado en Neon PostgreSQL</span>
          </div>
          <h2 className="site-settings-title">Configuración del Sitio</h2>
          <p className="site-settings-desc">
            Administra la identidad de la tienda, eslogan, textos del pie de página, datos de contacto oficiales, canales de WhatsApp, perfiles de redes sociales y datos fiscales para políticas legales.
          </p>
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-visit-store"
          title="Ver cómo se refleja en la tienda pública"
        >
          🏪 Ver en la Tienda ↗
        </a>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="settings-nav-tabs">
        <button
          type="button"
          className={`settings-nav-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          🏪 Identidad & Footer
        </button>
        <button
          type="button"
          className={`settings-nav-tab ${activeTab === 'contact' ? 'active' : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          💬 Contacto & WhatsApp
        </button>
        <button
          type="button"
          className={`settings-nav-tab ${activeTab === 'social' ? 'active' : ''}`}
          onClick={() => setActiveTab('social')}
        >
          📱 Redes Sociales
        </button>
        <button
          type="button"
          className={`settings-nav-tab ${activeTab === 'legal' ? 'active' : ''}`}
          onClick={() => setActiveTab('legal')}
        >
          ⚖️ Datos Legales & NIT
        </button>
      </div>

      {loading ? (
        <div className="settings-loading-pane">
          <span className="loading-spinner"></span>
          <span>Cargando configuración desde Neon...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="site-settings-form">
          {/* ============================================================
             SECCIÓN 1: IDENTIDAD Y FOOTER
             ============================================================ */}
          {activeTab === 'general' && (
            <div className="settings-card-section">
              <h3 className="section-title">Información de la Tienda y Pie de Página</h3>
              <p className="section-subtitle">
                Estos textos se muestran en la Columna A del pie de página y en las cabeceras de la tienda pública.
              </p>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-store-name">
                    Nombre Oficial de la Tienda
                  </label>
                  <input
                    id="set-store-name"
                    type="text"
                    className="field-input"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    required
                  />
                  <span className="field-hint">Aparece en el logo y los derechos reservados.</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-tagline">
                    Eslogan de Marca
                  </label>
                  <input
                    id="set-tagline"
                    type="text"
                    className="field-input"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    required
                  />
                  <span className="field-hint">Eslogan oficial: "TU ESTILO. TUS REGLAS."</span>
                </div>
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="set-description">
                  Descripción de la Tienda (Footer)
                </label>
                <textarea
                  id="set-description"
                  className="field-textarea"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
                <span className="field-hint">
                  Breve resumen de la propuesta de valor y catálogo de moda urbana para hombres y mujeres.
                </span>
              </div>
            </div>
          )}

          {/* ============================================================
             SECCIÓN 2: CONTACTO Y WHATSAPP
             ============================================================ */}
          {activeTab === 'contact' && (
            <div className="settings-card-section">
              <h3 className="section-title">Canales de Atención al Cliente</h3>
              <p className="section-subtitle">
                Configura los canales oficiales de soporte que se muestran en el pie de página y en el modal de atención al cliente.
              </p>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-email">
                    Correo Electrónico de Soporte
                  </label>
                  <input
                    id="set-email"
                    type="email"
                    className="field-input"
                    placeholder="contacto@urbanstyle.com.co"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    required
                  />
                  <span className="field-hint">Recibirá las dudas y solicitudes de clientes.</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-phone">
                    Teléfono / Celular de Contacto (Opcional)
                  </label>
                  <input
                    id="set-phone"
                    type="text"
                    className="field-input font-numeric"
                    placeholder="Ej: +57 300 123 4567"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                  <span className="field-hint">Línea fija o celular de atención telefónica.</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-whatsapp">
                    Número de WhatsApp para Clientes
                  </label>
                  <input
                    id="set-whatsapp"
                    type="text"
                    className="field-input font-numeric"
                    placeholder="Ej: +57 300 123 4567 (o en blanco si no está listo)"
                    value={formData.contactWhatsapp}
                    onChange={(e) => setFormData({ ...formData, contactWhatsapp: e.target.value })}
                  />
                  <span className="field-hint">
                    Si ingresas un número, se activará automáticamente el botón y enlace de WhatsApp en el footer.
                  </span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-hours">
                    Horarios de Atención
                  </label>
                  <input
                    id="set-hours"
                    type="text"
                    className="field-input"
                    value={formData.contactHours}
                    onChange={(e) => setFormData({ ...formData, contactHours: e.target.value })}
                  />
                  <span className="field-hint">Ej: Lunes a Sábado: 9:00 AM – 7:00 PM</span>
                </div>
              </div>

              <div className="form-field">
                <label className="field-label" htmlFor="set-wa-msg">
                  Mensaje Predeterminado de WhatsApp
                </label>
                <input
                  id="set-wa-msg"
                  type="text"
                  className="field-input"
                  value={formData.whatsappMessage}
                  onChange={(e) => setFormData({ ...formData, whatsappMessage: e.target.value })}
                />
                <span className="field-hint">
                  Texto que aparecerá escrito al cliente al abrir el chat de WhatsApp.
                </span>
              </div>
            </div>
          )}

          {/* ============================================================
             SECCIÓN 3: REDES SOCIALES
             ============================================================ */}
          {activeTab === 'social' && (
            <div className="settings-card-section">
              <h3 className="section-title">Perfiles de Redes Sociales</h3>
              <p className="section-subtitle">
                Pega la URL completa de tus perfiles. <strong>Importante:</strong> Si dejas una red social vacía, no se mostrará ningún icono ni enlace roto en el pie de página.
              </p>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-soc-ig">
                    Instagram (URL)
                  </label>
                  <input
                    id="set-soc-ig"
                    type="url"
                    className="field-input"
                    placeholder="https://instagram.com/tu_cuenta"
                    value={formData.social.instagram || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        social: { ...formData.social, instagram: e.target.value }
                      })
                    }
                  />
                  <span className="field-hint">Ej: https://instagram.com/urbanstyle.col</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-soc-tk">
                    TikTok (URL)
                  </label>
                  <input
                    id="set-soc-tk"
                    type="url"
                    className="field-input"
                    placeholder="https://tiktok.com/@tu_cuenta"
                    value={formData.social.tiktok || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        social: { ...formData.social, tiktok: e.target.value }
                      })
                    }
                  />
                  <span className="field-hint">Ej: https://tiktok.com/@urbanstyle.col</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-soc-fb">
                    Facebook (URL)
                  </label>
                  <input
                    id="set-soc-fb"
                    type="url"
                    className="field-input"
                    placeholder="https://facebook.com/tu_pagina"
                    value={formData.social.facebook || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        social: { ...formData.social, facebook: e.target.value }
                      })
                    }
                  />
                  <span className="field-hint">O déjalo vacío si no cuentas con página en Facebook.</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-soc-wa-link">
                    Canal o Enlace Directo de WhatsApp
                  </label>
                  <input
                    id="set-soc-wa-link"
                    type="url"
                    className="field-input"
                    placeholder="https://wa.me/573001234567"
                    value={formData.social.whatsapp || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        social: { ...formData.social, whatsapp: e.target.value }
                      })
                    }
                  />
                  <span className="field-hint">Enlace de comunidad o canal de difusión.</span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
             SECCIÓN 4: DATOS LEGALES Y FISCALES
             ============================================================ */}
          {activeTab === 'legal' && (
            <div className="settings-card-section">
              <h3 className="section-title">Datos Empresariales y Personería Jurídica</h3>
              <p className="section-subtitle">
                Estos datos se incorporan automáticamente en la <strong>Política de Privacidad (Habeas Data Ley 1581)</strong> y los <strong>Términos y Condiciones</strong>.
              </p>

              <div className="settings-legal-alert">
                <span>
                  🛡️ <strong>Aviso legal importante:</strong> No se han inventado datos empresariales ficticios. Para formalizar tu tienda ante la DIAN y la Superintendencia de Industria y Comercio (SIC), completa tu Razón Social o nombre comercial registrado y tu NIT correspondiente.
                </span>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-legal-name">
                    Razón Social / Titular Legal
                  </label>
                  <input
                    id="set-legal-name"
                    type="text"
                    className="field-input"
                    placeholder="Ej: URBAN STYLE S.A.S. o Nombre del Propietario"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  />
                  <span className="field-hint">Persona jurídica o natural titular del negocio.</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-nit">
                    NIT / Cédula de Ciudadanía
                  </label>
                  <input
                    id="set-nit"
                    type="text"
                    className="field-input font-numeric"
                    placeholder="Ej: 901.XXX.XXX-X"
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  />
                  <span className="field-hint">Número de identificación tributaria.</span>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label className="field-label" htmlFor="set-city">
                    Ciudad y País de Domicilio
                  </label>
                  <input
                    id="set-city"
                    type="text"
                    className="field-input"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                  <span className="field-hint">Sede principal de despachos y operaciones.</span>
                </div>

                <div className="form-field">
                  <label className="field-label" htmlFor="set-address">
                    Dirección de Notificaciones Físicas
                  </label>
                  <input
                    id="set-address"
                    type="text"
                    className="field-input"
                    placeholder="Ej: Cra 15 # 85-30, Bogotá D.C."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                  <span className="field-hint">Dirección para requerimientos formales y correspondencia.</span>
                </div>
              </div>
            </div>
          )}

          {/* BOTÓN DE GUARDADO */}
          <div className="settings-form-footer">
            <span className="footer-status-text">
              Los cambios se guardan de inmediato en la base de datos y se reflejan en la tienda pública sin modificar código.
            </span>
            <button
              type="submit"
              className="btn-save-settings"
              disabled={saving}
            >
              {saving ? 'Guardando en Neon...' : '💾 Guardar Configuración del Sitio'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
