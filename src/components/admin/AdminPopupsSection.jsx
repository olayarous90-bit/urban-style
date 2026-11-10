import React, { useState, useEffect, useRef } from 'react';
import { AnnouncementPopup } from '../popup/AnnouncementPopup';
import './AdminPopupsSection.css';

const POPUP_TYPES = [
  {
    id: 'discount',
    label: 'Descuentos',
    desc: 'Promociones, porcentajes de descuento y ofertas especiales',
    icon: '🏷️',
    defaultBadge: 'DESCUENTO ESPECIAL'
  },
  {
    id: 'news',
    label: 'Novedades',
    desc: 'Nuevos productos y colecciones recién llegadas a la tienda',
    icon: '✦',
    defaultBadge: 'NUEVA COLECCIÓN'
  },
  {
    id: 'promotion',
    label: 'Promociones',
    desc: 'Ofertas por tiempo limitado, combos y campañas flash',
    icon: '🔥',
    defaultBadge: 'TIEMPO LIMITADO'
  },
  {
    id: 'launch',
    label: 'Lanzamientos',
    desc: 'Presentación exclusiva de nuevos lanzamientos y sneakers',
    icon: '⚡',
    defaultBadge: 'LANZAMIENTO EXCLUSIVO'
  },
  {
    id: 'custom',
    label: 'Personalizado',
    desc: 'Contenido libre con mensaje, enlaces e imagen a tu medida',
    icon: '★',
    defaultBadge: 'DESTACADO'
  }
];

const PRESET_IMAGES = [
  { label: 'Campaña Urbana (Hero)', url: '/images/hero-campaign.jpg' },
  { label: 'Colección Streetwear', url: '/images/collection-streetwear.jpg' },
  { label: 'Sneakers Exclusivos', url: '/images/cat-sneakers.jpg' },
  { label: 'Moda Urbana Hombre', url: '/images/cat-men.jpg' },
  { label: 'Moda Urbana Mujer', url: '/images/cat-women.jpg' }
];

const DESTINATION_PRESETS = [
  { label: 'Sección de Ofertas (#ofertas)', value: '#ofertas' },
  { label: 'Productos Destacados (#productos)', value: '#productos' },
  { label: 'Colección Streetwear (#coleccion)', value: '#coleccion' },
  { label: 'Beneficios y Envíos (#beneficios)', value: '#beneficios' },
  { label: 'Inicio de la Tienda (#inicio)', value: '#inicio' }
];

const INITIAL_FORM = {
  title: '',
  description: '',
  type: 'discount',
  badge_text: '',
  image_url: '/images/hero-campaign.jpg',
  image_storage_key: null,
  button_text: 'Ver Ofertas Ahora',
  button_link: '#ofertas',
  secondary_button_text: 'Continuar a la tienda',
  is_active: true,
  priority: 10,
  frequency: 'always',
  start_date: '',
  end_date: '',
  status: 'active'
};

export const AdminPopupsSection = ({ onToast }) => {
  const [popups, setPopups] = useState([]);
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewPopup, setPreviewPopup] = useState(null);
  const fileInputRef = useRef(null);

  // Cargar anuncios emergentes
  useEffect(() => {
    fetchPopups();
  }, []);

  const fetchPopups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/popups', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPopups(json.data.popups || []);
          setSystemEnabled(json.data.systemEnabled !== false);
        }
      }
    } catch (err) {
      console.error('[AdminPopupsSection Error]:', err);
      showToast('Error cargando anuncios emergentes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    if (onToast) onToast(msg, type);
  };

  // Conmutador maestro del sistema
  const handleToggleSystem = async () => {
    const nextState = !systemEnabled;
    try {
      const res = await fetch('/api/admin/popups/toggle-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: nextState })
      });
      if (res.ok) {
        setSystemEnabled(nextState);
        showToast(nextState ? 'Ventanas emergentes activadas en la tienda' : 'Ventanas emergentes desactivadas en la tienda');
      }
    } catch (err) {
      showToast('Error al cambiar estado general', 'error');
    }
  };

  // Alternar estado individual de un anuncio
  const handleToggleActive = async (popup) => {
    const nextActive = !popup.is_active;
    try {
      const res = await fetch(`/api/admin/popups/${popup.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: nextActive })
      });
      if (res.ok) {
        setPopups((prev) =>
          prev.map((p) => (p.id === popup.id ? { ...p, is_active: nextActive, computed_status: nextActive ? 'active' : 'draft' } : p))
        );
        showToast(nextActive ? `"${popup.title}" activado` : `"${popup.title}" desactivado`);
      }
    } catch {
      showToast('Error al actualizar estado del anuncio', 'error');
    }
  };

  // Abrir modal de creación
  const handleOpenCreate = () => {
    setEditingPopup(null);
    setFormData({
      ...INITIAL_FORM,
      priority: popups.length > 0 ? Math.max(...popups.map((p) => p.priority || 1)) + 1 : 10
    });
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEdit = (popup) => {
    setEditingPopup(popup);
    setFormData({
      title: popup.title || '',
      description: popup.description || '',
      type: popup.type || 'discount',
      badge_text: popup.badge_text || '',
      image_url: popup.image_url || '/images/hero-campaign.jpg',
      image_storage_key: popup.image_storage_key || null,
      button_text: popup.button_text || 'Ver Ofertas Ahora',
      button_link: popup.button_link || '#ofertas',
      secondary_button_text: popup.secondary_button_text || 'Continuar a la tienda',
      is_active: Boolean(popup.is_active),
      priority: popup.priority || 10,
      frequency: popup.frequency || 'always',
      start_date: popup.start_date ? popup.start_date.slice(0, 16) : '',
      end_date: popup.end_date ? popup.end_date.slice(0, 16) : '',
      status: popup.status || 'active'
    });
    setIsModalOpen(true);
  };

  // Eliminar anuncio
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/popups/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setPopups((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        showToast('Anuncio emergente eliminado correctamente');
      }
    } catch {
      showToast('Error eliminando anuncio', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Cargar imagen desde el computador
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de tipo y peso
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Formato de imagen no permitido. Usa JPG, PNG, WebP o AVIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen excede el límite máximo de 5 MB.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result;
      try {
        const res = await fetch('/api/admin/popups/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            image: base64Data,
            mimeType: file.type,
            originalName: file.name
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.url) {
            setFormData((prev) => ({
              ...prev,
              image_url: json.data.url,
              image_storage_key: json.data.storageKey || null
            }));
            showToast('Imagen cargada y optimizada en almacenamiento persistente');
          }
        } else {
          const err = await res.json();
          alert(err.message || 'Error al subir la imagen');
        }
      } catch (err) {
        alert('Error de conexión al subir la imagen');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Guardar cambios (Crear o Editar)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('El título del anuncio es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingPopup ? `/api/admin/popups/${editingPopup.id}` : '/api/admin/popups';
      const method = editingPopup ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        showToast(editingPopup ? 'Anuncio emergente actualizado' : 'Anuncio emergente creado exitosamente');
        setIsModalOpen(false);
        fetchPopups();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al guardar el anuncio');
      }
    } catch {
      alert('Error de red al guardar el anuncio');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir vista previa
  const handleOpenPreview = (popupData) => {
    setPreviewPopup(popupData);
  };

  const activePopupsList = popups.filter((p) => p.computed_status === 'active');
  const livePopup = activePopupsList[0];

  return (
    <div className="admin-popups-module">
      {/* 1. CABECERA Y PANEL DE CONTROL MAESTRO */}
      <div className="popups-module-header">
        <div className="popups-header-info">
          <div className="popups-header-badge-row">
            <span className="popups-pill-tag">MARKETING & CONVERSIÓN</span>
            <span className={`popups-status-indicator ${systemEnabled ? 'indicator-online' : 'indicator-offline'}`}>
              {systemEnabled ? '● Sistema Activo' : '○ Sistema Desactivado'}
            </span>
          </div>
          <h2 className="popups-module-title">Anuncios Emergentes (Popups)</h2>
          <p className="popups-module-desc">
            Gestiona las ventanas emergentes que aparecen automáticamente a los visitantes cuando entran al enlace público de URBAN STYLE. Promociona descuentos, novedades, ofertas flash y lanzamientos.
          </p>
        </div>

        <div className="popups-header-actions">
          {/* INTERRUPTOR GENERAL */}
          <div className="popups-master-toggle-card">
            <div className="master-toggle-labels">
              <span className="master-toggle-title">Mostrar popups en la tienda</span>
              <span className="master-toggle-hint">
                {systemEnabled ? 'Los visitantes verán el anuncio activo' : 'Ningún popup se mostrará en la tienda'}
              </span>
            </div>
            <button
              type="button"
              className={`popups-switch-btn ${systemEnabled ? 'switch-active' : ''}`}
              onClick={handleToggleSystem}
              role="switch"
              aria-checked={systemEnabled}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          <button
            type="button"
            className="popups-create-btn"
            onClick={handleOpenCreate}
          >
            <span>+ Crear Nuevo Anuncio</span>
          </button>
        </div>
      </div>

      {/* 2. TARJETAS DE MÉTRICAS */}
      <div className="popups-stats-grid">
        <div className="popup-stat-card">
          <span className="stat-label">Total de Anuncios</span>
          <span className="stat-value font-numeric">{popups.length}</span>
          <span className="stat-sub">Registrados en Neon PostgreSQL</span>
        </div>

        <div className="popup-stat-card">
          <span className="stat-label">Anuncios Activos</span>
          <span className="stat-value font-numeric text-highlight">{activePopupsList.length}</span>
          <span className="stat-sub">Con vigencia actual</span>
        </div>

        <div className="popup-stat-card">
          <span className="stat-label">Anuncio en Vivo Ahora</span>
          <span className="stat-value-text" title={livePopup?.title || 'Ninguno en emisión'}>
            {systemEnabled && livePopup ? livePopup.title : 'Ninguno en emisión'}
          </span>
          <span className="stat-sub">
            {systemEnabled && livePopup ? `Prioridad: ${livePopup.priority} • ${livePopup.type.toUpperCase()}` : 'La tienda abre normalmente sin popups'}
          </span>
        </div>
      </div>

      {/* 3. LISTADO DE ANUNCIOS */}
      <div className="popups-table-card">
        <div className="popups-table-header">
          <h3 className="table-title">Anuncios Registrados</h3>
          <span className="table-subtitle">Ordenados por prioridad de visualización</span>
        </div>

        {loading ? (
          <div className="popups-loading-state">
            <span className="loading-spinner"></span>
            <span>Cargando anuncios emergentes desde Neon...</span>
          </div>
        ) : popups.length === 0 ? (
          <div className="popups-empty-state">
            <span className="empty-icon">📢</span>
            <h4>No tienes anuncios emergentes configurados</h4>
            <p>Crea tu primer anuncio para promocionar ofertas y novedades a tus clientes.</p>
            <button type="button" className="popups-create-btn" onClick={handleOpenCreate}>
              Crear Primer Anuncio
            </button>
          </div>
        ) : (
          <div className="popups-cards-list">
            {popups.map((popup) => {
              const typeMeta = POPUP_TYPES.find((t) => t.id === popup.type) || POPUP_TYPES[0];
              const isLive = systemEnabled && livePopup?.id === popup.id;

              return (
                <div key={popup.id} className={`popup-item-card ${isLive ? 'item-is-live' : ''}`}>
                  {/* MINIATURA DE IMAGEN */}
                  <div className="item-thumbnail-box">
                    <img
                      src={popup.image_url || '/images/hero-campaign.jpg'}
                      alt={popup.title}
                      className="item-thumbnail-img"
                    />
                    {isLive && <span className="item-live-badge">EN VIVO</span>}
                  </div>

                  {/* DATOS PRINCIPALES */}
                  <div className="item-info-col">
                    <div className="item-meta-badges">
                      <span className={`item-type-pill type-${popup.type}`}>
                        {typeMeta.icon} {typeMeta.label}
                      </span>

                      {/* ESTADO CALCULADO */}
                      {popup.computed_status === 'active' && (
                        <span className="item-status-pill status-active">Activo</span>
                      )}
                      {popup.computed_status === 'scheduled' && (
                        <span className="item-status-pill status-scheduled">Programado</span>
                      )}
                      {popup.computed_status === 'expired' && (
                        <span className="item-status-pill status-expired">Vencido</span>
                      )}
                      {popup.computed_status === 'draft' && (
                        <span className="item-status-pill status-draft">Borrador / Pausado</span>
                      )}

                      <span className="item-priority-pill font-numeric">
                        Prioridad {popup.priority}
                      </span>
                    </div>

                    <h4 className="item-title">{popup.title}</h4>
                    {popup.description && <p className="item-desc">{popup.description}</p>}

                    <div className="item-details-row">
                      <span className="detail-item">
                        <strong>Botón:</strong> {popup.button_text} ({popup.button_link})
                      </span>
                      <span className="detail-item">
                        <strong>Frecuencia:</strong>{' '}
                        {popup.frequency === 'always' && 'En cada visita'}
                        {popup.frequency === 'once_per_session' && '1 vez por sesión'}
                        {popup.frequency === 'once_per_day' && '1 vez por día'}
                        {popup.frequency === 'once_ever' && '1 sola vez'}
                      </span>
                      {(popup.start_date || popup.end_date) && (
                        <span className="detail-item font-numeric">
                          <strong>Vigencia:</strong>{' '}
                          {popup.start_date ? new Date(popup.start_date).toLocaleDateString() : 'Inicio inmediato'}{' '}
                          — {popup.end_date ? new Date(popup.end_date).toLocaleDateString() : 'Permanente'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ACCIONES Y SWITCH INDIVIDUAL */}
                  <div className="item-actions-col">
                    <div className="item-toggle-wrapper">
                      <span className="toggle-label">{popup.is_active ? 'Activo' : 'Pausado'}</span>
                      <button
                        type="button"
                        className={`item-toggle-btn ${popup.is_active ? 'active' : ''}`}
                        onClick={() => handleToggleActive(popup)}
                        title={popup.is_active ? 'Desactivar anuncio' : 'Activar anuncio'}
                      >
                        <span className="toggle-thumb" />
                      </button>
                    </div>

                    <div className="item-buttons-group">
                      <button
                        type="button"
                        className="btn-preview-action"
                        onClick={() => handleOpenPreview(popup)}
                        title="Ver cómo se verá en la tienda"
                      >
                        👁️ Vista Previa
                      </button>

                      <button
                        type="button"
                        className="btn-edit-action"
                        onClick={() => handleOpenEdit(popup)}
                        title="Editar anuncio"
                      >
                        ✏️ Editar
                      </button>

                      <button
                        type="button"
                        className="btn-delete-action"
                        onClick={() => setDeleteTarget(popup)}
                        title="Eliminar anuncio"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MODAL DE CREACIÓN / EDICIÓN */}
      {isModalOpen && (
        <div className="popups-form-overlay" role="dialog" aria-modal="true">
          <div className="popups-form-modal">
            <div className="form-modal-header">
              <div>
                <h3 className="modal-title">
                  {editingPopup ? 'Editar Anuncio Emergente' : 'Crear Nuevo Anuncio Emergente'}
                </h3>
                <p className="modal-subtitle">
                  Configura el contenido comercial, el llamado a la acción y el diseño visual.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="popups-form-body">
              {/* TIPO DE ANUNCIO */}
              <div className="form-group-full">
                <label className="form-label">Tipo de Anuncio Comercial</label>
                <div className="popup-types-selector-grid">
                  {POPUP_TYPES.map((t) => {
                    const isSelected = formData.type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`type-select-card ${isSelected ? 'type-selected' : ''}`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            type: t.id,
                            badge_text: prev.badge_text ? prev.badge_text : t.defaultBadge
                          }))
                        }
                      >
                        <span className="type-card-icon">{t.icon}</span>
                        <div className="type-card-text">
                          <span className="type-card-title">{t.label}</span>
                          <span className="type-card-desc">{t.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TÍTULO Y DESCRIPCIÓN */}
              <div className="form-group-full">
                <label className="form-label" htmlFor="popup-input-title">
                  Título del Anuncio *
                </label>
                <input
                  id="popup-input-title"
                  type="text"
                  className="form-input"
                  placeholder="Ej: ¡HASTA 30% OFF EN TODA LA TIENDA!"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group-full">
                <label className="form-label" htmlFor="popup-input-desc">
                  Descripción o Mensaje Promocional
                </label>
                <textarea
                  id="popup-input-desc"
                  className="form-textarea"
                  rows={3}
                  placeholder="Ej: Aprovecha nuestros descuentos especiales en sneakers y hoodies por tiempo limitado. Envíos gratis a todo el país."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* IMAGEN Y CARGA DESDE COMPUTADOR */}
              <div className="form-group-full">
                <label className="form-label">Imagen Destacada del Anuncio</label>
                <div className="image-uploader-container">
                  <div className="image-preview-box">
                    <img
                      src={formData.image_url || '/images/hero-campaign.jpg'}
                      alt="Vista previa de imagen"
                      className="preview-img"
                    />
                    <div className="image-overlay-info">
                      <span className="image-url-label">{formData.image_url}</span>
                    </div>
                  </div>

                  <div className="image-actions-panel">
                    <div className="upload-btn-row">
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        className="btn-upload-file"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <span className="mini-spinner" /> Subiendo a almacenamiento...
                          </>
                        ) : (
                          <>📁 Cargar imagen desde mi computador</>
                        )}
                      </button>
                    </div>

                    <p className="upload-note">
                      Formatos admitidos: JPG, PNG, WebP o AVIF (máx. 5 MB). Se almacena de forma persistente y se optimiza automáticamente.
                    </p>

                    {/* PRESETS DE IMÁGENES DE LA MARCA */}
                    <div className="presets-wrapper">
                      <span className="presets-label">O usa una imagen del catálogo:</span>
                      <div className="presets-chips">
                        {PRESET_IMAGES.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            className={`preset-chip ${formData.image_url === preset.url ? 'preset-active' : ''}`}
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                image_url: preset.url,
                                image_storage_key: null
                              }))
                            }
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTÓN DE ACCIÓN Y DESTINO */}
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="popup-input-btn-text">
                    Texto del Botón
                  </label>
                  <input
                    id="popup-input-btn-text"
                    type="text"
                    className="form-input"
                    placeholder="Ej: Ver Ofertas Ahora"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="popup-input-btn-link">
                    Destino o Enlace del Botón
                  </label>
                  <input
                    id="popup-input-btn-link"
                    type="text"
                    className="form-input"
                    placeholder="Ej: #ofertas, #productos o https://..."
                    value={formData.button_link}
                    onChange={(e) => setFormData({ ...formData, button_link: e.target.value })}
                  />
                  <div className="destinations-quick-picks">
                    {DESTINATION_PRESETS.map((dest) => (
                      <button
                        key={dest.value}
                        type="button"
                        className="quick-pick-btn"
                        onClick={() => setFormData((prev) => ({ ...prev, button_link: dest.value }))}
                      >
                        {dest.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INSIGNIA PERSONALIZADA Y TEXTO SECUNDARIO */}
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="popup-input-badge">
                    Texto de la Insignia (Badge)
                  </label>
                  <input
                    id="popup-input-badge"
                    type="text"
                    className="form-input"
                    placeholder="Ej: 20% OFF — EXCLUSIVO"
                    value={formData.badge_text}
                    onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="popup-input-secondary">
                    Texto de Cierre Secundario
                  </label>
                  <input
                    id="popup-input-secondary"
                    type="text"
                    className="form-input"
                    placeholder="Ej: Continuar a la tienda"
                    value={formData.secondary_button_text}
                    onChange={(e) => setFormData({ ...formData, secondary_button_text: e.target.value })}
                  />
                </div>
              </div>

              {/* FRECUENCIA Y PRIORIDAD */}
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="popup-input-freq">
                    Frecuencia de Aparición al Visitante
                  </label>
                  <select
                    id="popup-input-freq"
                    className="form-select"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  >
                    <option value="always">Mostrar en cada visita a la tienda</option>
                    <option value="once_per_session">Una sola vez por sesión del navegador</option>
                    <option value="once_per_day">Una sola vez por día por visitante</option>
                    <option value="once_ever">Una sola vez en la vida del visitante</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" htmlFor="popup-input-priority">
                    Prioridad (Número mayor = se muestra primero)
                  </label>
                  <input
                    id="popup-input-priority"
                    type="number"
                    min="1"
                    max="100"
                    className="form-input font-numeric"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
              </div>

              {/* FECHAS DE PROGRAMACIÓN */}
              <div className="form-grid-2">
                <div>
                  <label className="form-label" htmlFor="popup-input-start">
                    Fecha y Hora de Inicio (Opcional)
                  </label>
                  <input
                    id="popup-input-start"
                    type="datetime-local"
                    className="form-input font-numeric"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                  <span className="field-hint">En blanco = Activo inmediatamente</span>
                </div>

                <div>
                  <label className="form-label" htmlFor="popup-input-end">
                    Fecha y Hora de Finalización (Opcional)
                  </label>
                  <input
                    id="popup-input-end"
                    type="datetime-local"
                    className="form-input font-numeric"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                  <span className="field-hint">En blanco = Sin fecha de vencimiento</span>
                </div>
              </div>

              {/* ESTADO INICIAL */}
              <div className="form-group-full">
                <label className="form-label">Estado de Publicación</label>
                <div className="status-radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="popup_status"
                      value="active"
                      checked={formData.status === 'active' && formData.is_active}
                      onChange={() => setFormData({ ...formData, status: 'active', is_active: true })}
                    />
                    <span>🚀 Activo (Publicar para los visitantes)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="popup_status"
                      value="draft"
                      checked={formData.status === 'draft' || !formData.is_active}
                      onChange={() => setFormData({ ...formData, status: 'draft', is_active: false })}
                    />
                    <span>📝 Borrador / Pausado (Guardar sin mostrar aún)</span>
                  </label>
                </div>
              </div>

              {/* BOTONES DEL MODAL */}
              <div className="form-modal-footer">
                <button
                  type="button"
                  className="btn-modal-preview"
                  onClick={() => handleOpenPreview({ ...formData, id: 'preview-temp' })}
                >
                  👁️ Probar Vista Previa en Vivo
                </button>

                <div className="footer-right-buttons">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-modal-save"
                    disabled={isSubmitting || isUploading}
                  >
                    {isSubmitting ? 'Guardando en Neon...' : editingPopup ? 'Guardar Cambios' : 'Crear y Publicar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. CONFIRMACIÓN DE ELIMINACIÓN */}
      {deleteTarget && (
        <div className="popups-delete-overlay" role="dialog" aria-modal="true">
          <div className="popups-delete-card">
            <h3>¿Eliminar este anuncio emergente?</h3>
            <p>
              Estás a punto de eliminar <strong>"{deleteTarget.title}"</strong>. Si tiene imágenes en almacenamiento persistente, serán limpiadas.
            </p>
            <div className="delete-actions-row">
              <button
                type="button"
                className="btn-cancel-delete"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={handleDeleteConfirm}
              >
                Sí, Eliminar Anuncio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. VISTA PREVIA EN VIVO */}
      {previewPopup && (
        <AnnouncementPopup
          isPreview={true}
          previewData={previewPopup}
          onClosePreview={() => setPreviewPopup(null)}
        />
      )}
    </div>
  );
};
