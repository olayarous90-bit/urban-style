import React, { useState, useEffect } from 'react';
import './AdminAssistantSection.css';

const ACCENT_COLORS = [
  { name: 'Naranja Oficial', hex: '#FF5A1F' },
  { name: 'Blanco Puro', hex: '#FFFFFF' },
  { name: 'Verde Neón', hex: '#10B981' },
  { name: 'Azul Eléctrico', hex: '#3B82F6' },
  { name: 'Púrpura Street', hex: '#8B5CF6' }
];

export function AdminAssistantSection() {
  const [formData, setFormData] = useState({
    enabled: true,
    botName: 'Asistente URBAN STYLE',
    welcomeMessage: '¡Hola! 👋 Bienvenido a URBAN STYLE. Estoy aquí para ayudarte a encontrar lo que buscas. ¿Qué te gustaría descubrir hoy?',
    accentColor: '#FF5A1F',
    enableVisualCards: true,
    enableBestsellers: true,
    enableBudgetRecommendations: true,
    enableWhatsappHandoff: true,
    whatsappHandoffMessage: '¡Hola! Estuve conversando con el asistente virtual de URBAN STYLE y me gustaría recibir asesoría humana con mi compra.'
  });

  const [stats, setStats] = useState({
    totalConversations: 0,
    totalToday: 0,
    topIntents: [],
    recentLogs: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Cargar configuración y estadísticas
  const fetchAssistantData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/assistant', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.settings) setFormData(json.data.settings);
          if (json.data.stats) setStats(json.data.stats);
        }
      }
    } catch (err) {
      console.error('[AdminAssistantSection] Error cargando datos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistantData();
  }, []);

  // Guardar configuración
  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({ type: 'success', message: '¡Configuración del Asistente Virtual guardada exitosamente en Neon PostgreSQL!' });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        throw new Error(data.message || 'Error al guardar');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error de conexión al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
        Cargando configuración del Asistente Virtual...
      </div>
    );
  }

  return (
    <div className="admin-assistant-section">
      {/* 1. ENCABEZADO DE SECCIÓN */}
      <div className="assistant-admin-header">
        <div className="assistant-admin-header-left">
          <div className="assistant-admin-badge-icon">🤖</div>
          <div>
            <h2 className="assistant-admin-title">Asistente Virtual de Compras</h2>
            <p className="assistant-admin-desc">
              Vendedor con inteligencia artificial conectado en tiempo real al catálogo y stock de Neon PostgreSQL.
            </p>
          </div>
        </div>

        {/* INTERRUPTOR GENERAL */}
        <div className="assistant-switch-row" style={{ minWidth: '200px' }}>
          <div className="assistant-switch-info">
            <span className="assistant-switch-title">Estado del Robot</span>
            <span className="assistant-switch-desc">{formData.enabled ? 'Activo en la tienda' : 'Desactivado'}</span>
          </div>
          <label className="assistant-toggle-label">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
            <span className="assistant-toggle-slider" />
          </label>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: '600',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: feedback.type === 'success' ? '#34D399' : '#F87171'
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* 2. TARJETAS DE MÉTRICAS */}
      <div className="assistant-stats-grid">
        <div className="assistant-stat-card">
          <div className="assistant-stat-icon-wrap">💬</div>
          <div className="assistant-stat-info">
            <span className="assistant-stat-label">Consultas Totales</span>
            <span className="assistant-stat-value">{stats.totalConversations}</span>
          </div>
        </div>

        <div className="assistant-stat-card">
          <div className="assistant-stat-icon-wrap">⚡</div>
          <div className="assistant-stat-info">
            <span className="assistant-stat-label">Consultas Hoy</span>
            <span className="assistant-stat-value">{stats.totalToday}</span>
          </div>
        </div>

        <div className="assistant-stat-card">
          <div className="assistant-stat-icon-wrap">🎯</div>
          <div className="assistant-stat-info">
            <span className="assistant-stat-label">Modo Operativo</span>
            <span className="assistant-stat-value" style={{ fontSize: '1rem', color: '#10B981' }}>
              Catálogo & Neon Live
            </span>
          </div>
        </div>
      </div>

      {/* 3. FORMULARIOS DE CONFIGURACIÓN */}
      <div className="assistant-settings-grid">
        {/* COLUMNA 1: MENSAJES Y APARIENCIA */}
        <div className="assistant-card">
          <h3 className="assistant-card-title">
            <span>✨</span> Mensajes y Personalización
          </h3>

          <div className="assistant-form-group">
            <label className="assistant-form-label">
              <span>Mensaje de Bienvenida Automático</span>
            </label>
            <p className="assistant-form-hint">
              Mensaje que leerán los visitantes inmediatamente al pulsar la figura del robot.
            </p>
            <textarea
              className="assistant-textarea"
              rows={3}
              value={formData.welcomeMessage}
              onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
            />
          </div>

          <div className="assistant-form-group">
            <label className="assistant-form-label">
              <span>Color de Acento del Robot</span>
            </label>
            <p className="assistant-form-hint">
              Color de los bordes iluminados, antenas y detalles visuales del robot flotante.
            </p>
            <div className="color-picker-row">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`color-swatch-btn ${formData.accentColor === c.hex ? 'is-selected' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setFormData({ ...formData, accentColor: c.hex })}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="assistant-form-group">
            <label className="assistant-form-label">
              <span>Mensaje al Derivar a WhatsApp</span>
            </label>
            <p className="assistant-form-hint">
              Texto predeterminado para iniciar conversación cuando el usuario solicita asesor humano.
            </p>
            <input
              type="text"
              className="assistant-input"
              value={formData.whatsappHandoffMessage}
              onChange={(e) => setFormData({ ...formData, whatsappHandoffMessage: e.target.value })}
            />
          </div>
        </div>

        {/* COLUMNA 2: REGLAS DE RECOMENDACIÓN INTELIGENTE */}
        <div className="assistant-card">
          <h3 className="assistant-card-title">
            <span>⚙️</span> Capacidades del Asistente
          </h3>

          <div className="assistant-switch-row">
            <div className="assistant-switch-info">
              <span className="assistant-switch-title">Tarjetas Visuales de Producto</span>
              <span className="assistant-switch-desc">Muestra foto, tallas, precio real y botón de compra en el chat</span>
            </div>
            <label className="assistant-toggle-label">
              <input
                type="checkbox"
                checked={formData.enableVisualCards}
                onChange={(e) => setFormData({ ...formData, enableVisualCards: e.target.checked })}
              />
              <span className="assistant-toggle-slider" />
            </label>
          </div>

          <div className="assistant-switch-row">
            <div className="assistant-switch-info">
              <span className="assistant-switch-title">Consulta de Más Vendidos</span>
              <span className="assistant-switch-desc">Calcula tendencias en tiempo real desde pedidos de Neon</span>
            </div>
            <label className="assistant-toggle-label">
              <input
                type="checkbox"
                checked={formData.enableBestsellers}
                onChange={(e) => setFormData({ ...formData, enableBestsellers: e.target.checked })}
              />
              <span className="assistant-toggle-slider" />
            </label>
          </div>

          <div className="assistant-switch-row">
            <div className="assistant-switch-info">
              <span className="assistant-switch-title">Recomendaciones por Presupuesto</span>
              <span className="assistant-switch-desc">Filtra prendas según montos exactos consultados</span>
            </div>
            <label className="assistant-toggle-label">
              <input
                type="checkbox"
                checked={formData.enableBudgetRecommendations}
                onChange={(e) => setFormData({ ...formData, enableBudgetRecommendations: e.target.checked })}
              />
              <span className="assistant-toggle-slider" />
            </label>
          </div>

          <div className="assistant-switch-row">
            <div className="assistant-switch-info">
              <span className="assistant-switch-title">Botón de Escalamiento a WhatsApp</span>
              <span className="assistant-switch-desc">Permite contactar a un asesor humano directamente</span>
            </div>
            <label className="assistant-toggle-label">
              <input
                type="checkbox"
                checked={formData.enableWhatsappHandoff}
                onChange={(e) => setFormData({ ...formData, enableWhatsappHandoff: e.target.checked })}
              />
              <span className="assistant-toggle-slider" />
            </label>
          </div>

          {/* TEMAS MÁS FRECUENTES */}
          <div className="assistant-form-group" style={{ marginTop: '10px' }}>
            <label className="assistant-form-label">
              <span>Temas Más Consultados por Clientes</span>
            </label>
            <div className="assistant-topics-list">
              {stats.topIntents && stats.topIntents.length > 0 ? (
                stats.topIntents.map((item, idx) => (
                  <div key={idx} className="assistant-topic-item">
                    <span className="assistant-topic-name">{item.intent}</span>
                    <span className="assistant-topic-count">{item.count} consultas</span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#6B7280', fontSize: '0.8rem', padding: '6px' }}>
                  Aún no hay suficientes registros de consulta.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTÓN DE GUARDADO */}
      <div className="assistant-admin-actions">
        <button
          type="button"
          className="assistant-save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando cambios...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}

export default AdminAssistantSection;
