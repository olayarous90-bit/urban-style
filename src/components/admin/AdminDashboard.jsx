import React, { useState, useEffect } from 'react';
import { CloseIcon } from '../common/icons';
import { Button } from '../common/Button';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminProductsSection } from './AdminProductsSection';
import './AdminDashboard.css';

export const AdminDashboard = ({ isOpen, onClose }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Datos del Dashboard
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'shipments', 'emails', 'diagnostic'
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [configStatus, setConfigStatus] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Verificar sesión administrativa activa al abrir el panel
  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
    }
  }, [isOpen]);

  const checkAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const res = await fetch('/api/admin/me', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setAdminUser(data.user);
        } else {
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !selectedOrder) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, selectedOrder]);

  // Cargar datos administrativos si hay sesión activa
  useEffect(() => {
    if (isOpen && adminUser) {
      loadDashboardData();
    }
  }, [isOpen, adminUser, activeTab, statusFilter]);

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      const fetchOpts = { credentials: 'include' };

      // 1. Estadísticas
      const statsRes = await fetch('/api/admin/stats', fetchOpts);
      if (statsRes.status === 401) {
        handleLogout();
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // 2. Pedidos
      if (activeTab === 'orders') {
        const ordersRes = await fetch(`/api/admin/orders?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`, fetchOpts);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        }
      }

      // 3. Despachos y Guías
      if (activeTab === 'shipments') {
        const shipRes = await fetch('/api/admin/shipments', fetchOpts);
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          setShipments(shipData.shipments || []);
        }
      }

      // 4. Registros de Correo
      if (activeTab === 'emails') {
        const emailRes = await fetch('/api/admin/emails', fetchOpts);
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          setEmailLogs(emailData.logs || []);
        }
      }

      // 5. Diagnóstico de Configuración
      if (activeTab === 'diagnostic') {
        const diagRes = await fetch('/api/admin/config-status', fetchOpts);
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          setConfigStatus(diagData.services);
        }
      }
    } catch (err) {
      console.warn('Error cargando datos del panel admin:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch {
      // Continuar con limpieza local
    }
    setAdminUser(null);
    setStats(null);
    setSelectedOrder(null);
    if (onClose) {
      onClose();
    }
  };

  // Cambio de estado de un pedido
  const handleUpdateStatus = async (orderNumber, newStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          newStatus,
          comment: `Estado modificado a ${newStatus} desde el panel de control.`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback(`Estado del pedido #${orderNumber} actualizado a ${newStatus}.`);
        loadDashboardData();
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(data.message || 'Error actualizando estado.');
      }
    } catch (err) {
      alert('Error de red al actualizar estado.');
    }
  };

  // Reintento de envío de correo
  const handleResendEmail = async (orderNumber) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/resend-email`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback(`Correo reenviado para el pedido #${orderNumber}.`);
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(data.message || 'Error reenviando correo.');
      }
    } catch (err) {
      alert('Error de red al reenviar correo.');
    }
  };

  // Ver detalle de una orden
  const handleViewOrderDetail = async (orderNumber) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
      }
    } catch (err) {
      console.warn('Error obteniendo detalle de orden:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <div className="admin-container">
        
        {/* CABECERA DEL PANEL */}
        <div className="admin-header">
          <div className="admin-brand-box">
            <span className="admin-badge">URBAN STYLE BACKOFFICE</span>
            <h2 className="admin-title" id="admin-title">
              Panel Administrativo de Control y Envíos
            </h2>
          </div>

          <div className="admin-header-actions">
            {adminUser && (
              <button type="button" className="admin-logout-btn" onClick={handleLogout}>
                Cerrar Sesión ({adminUser.username})
              </button>
            )}
            <button type="button" className="admin-close-btn" onClick={onClose} aria-label="Cerrar panel">
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        {/* FEEDBACK DE ACCIÓN */}
        {actionFeedback && (
          <div className="admin-feedback-toast" role="status">
            <span>✓ {actionFeedback}</span>
          </div>
        )}

        {/* VERIFICANDO SESIÓN */}
        {isCheckingAuth ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#a0a0a0' }}>
            <p>Verificando credenciales de sesión...</p>
          </div>
        ) : !adminUser ? (
          /* PANTALLA DE INICIO DE SESIÓN INTEGRADA */
          <AdminLoginPage
            onLoginSuccess={(user) => {
              setAdminUser(user);
              loadDashboardData();
            }}
            onReturnToStore={onClose}
          />
        ) : (
          /* 2. DASHBOARD ADMINISTRATIVO COMPLETO */
          <div className="admin-content-layout">
            
            {/* TARJETAS DE MÉTRICAS */}
            {stats && (
              <div className="admin-metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Ventas Totales</span>
                  <strong className="metric-value">{stats.formattedRevenue}</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Total Pedidos</span>
                  <strong className="metric-value">{stats.totalOrders}</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-label">En Preparación</span>
                  <strong className="metric-value text-accent">{stats.pendingOrders}</strong>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Despachados</span>
                  <strong className="metric-value text-green">{stats.shippedOrders}</strong>
                </div>
              </div>
            )}

            {/* PESTAÑAS DE NAVEGACIÓN */}
            <div className="admin-nav-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => { setActiveTab('orders'); setSelectedOrder(null); }}
              >
                📦 Pedidos ({stats?.totalOrders || orders.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                onClick={() => { setActiveTab('products'); setSelectedOrder(null); }}
              >
                🏷️ Productos
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'shipments' ? 'active' : ''}`}
                onClick={() => { setActiveTab('shipments'); setSelectedOrder(null); }}
              >
                🚚 Guías y Envíos Mi Paquete
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'emails' ? 'active' : ''}`}
                onClick={() => { setActiveTab('emails'); setSelectedOrder(null); }}
              >
                ✉️ Registro de Correos
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'diagnostic' ? 'active' : ''}`}
                onClick={() => { setActiveTab('diagnostic'); setSelectedOrder(null); }}
              >
                ⚙️ Diagnóstico del Sistema
              </button>
            </div>

            {/* PESTAÑA: GESTIÓN DE PRODUCTOS */}
            {activeTab === 'products' && (
              <div className="tab-pane">
                <AdminProductsSection
                  onNotification={(msg) => {
                    setActionFeedback(msg);
                    setTimeout(() => setActionFeedback(null), 4000);
                  }}
                />
              </div>
            )}

            {/* PESTAÑA 1: PEDIDOS */}
            {activeTab === 'orders' && (
              <div className="tab-pane">
                <div className="filters-bar">
                  <div className="filter-group">
                    <label htmlFor="status-filter">Filtrar Estado:</label>
                    <select
                      id="status-filter"
                      className="filter-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">Todos los Estados</option>
                      <option value="PROCESSING">En Proceso / Contraentrega</option>
                      <option value="PENDING_PAYMENT">Pendiente de Pago</option>
                      <option value="PAYMENT_CONFIRMED">Pago Confirmado</option>
                      <option value="SHIPPED">Despachado</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                  </div>

                  <div className="filter-group">
                    <input
                      type="search"
                      className="filter-search"
                      placeholder="Buscar por orden, cliente, guía..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadDashboardData()}
                    />
                    <button type="button" className="btn-search" onClick={loadDashboardData}>
                      Filtrar
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="admin-table admin-orders-table">
                    <thead>
                      <tr>
                        <th>N° Orden</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Destino</th>
                        <th>Total</th>
                        <th>Método</th>
                        <th>Guía Mi Paquete</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center py-4 text-muted">
                            No se encontraron pedidos con el criterio seleccionado.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => (
                          <tr key={order.order_number}>
                            <td>
                              <strong className="order-number-link" onClick={() => handleViewOrderDetail(order.order_number)}>
                                #{order.order_number}
                              </strong>
                            </td>
                            <td>{new Date(order.created_at).toLocaleDateString('es-CO')}</td>
                            <td>
                              <div><strong>{order.customer_name} {order.customer_surname}</strong></div>
                              <div className="text-muted text-xs">{order.customer_email}</div>
                            </td>
                            <td>{order.delivery_city} ({order.delivery_department})</td>
                            <td><strong>${order.total.toLocaleString('es-CO')} COP</strong></td>
                            <td>
                              <span className={`badge-payment ${order.payment_method === 'COD' ? 'cod' : 'prepaid'}`}>
                                {order.payment_method === 'COD' ? 'Contraentrega' : 'Anticipado'}
                              </span>
                            </td>
                            <td>
                              {order.guide_number ? (
                                <a
                                  href={`/api/shipping/guide/${order.guide_number}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="guide-link"
                                >
                                  {order.carrier_name}: {order.guide_number} 📄
                                </a>
                              ) : (
                                <span className="text-muted">Pendiente</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-pill status-${order.status.toLowerCase()}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  type="button"
                                  className="action-link"
                                  onClick={() => handleViewOrderDetail(order.order_number)}
                                  title="Ver trazabilidad completa"
                                >
                                  👁️ Detalle
                                </button>
                                {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
                                  <button
                                    type="button"
                                    className="action-btn-status ship"
                                    onClick={() => handleUpdateStatus(order.order_number, 'SHIPPED')}
                                    title="Marcar como Despachado"
                                  >
                                    🚚 Despachar
                                  </button>
                                )}
                                {order.status === 'PENDING_PAYMENT' && (
                                  <button
                                    type="button"
                                    className="action-btn-status confirm"
                                    onClick={() => handleUpdateStatus(order.order_number, 'PAYMENT_CONFIRMED')}
                                    title="Confirmar Pago"
                                  >
                                    💰 Confirmar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="action-btn-status email"
                                  onClick={() => handleResendEmail(order.order_number)}
                                  title="Reenviar correo con guía"
                                >
                                  ✉️ Reenviar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PESTAÑA 2: GUÍAS Y ENVÍOS MI PAQUETE */}
            {activeTab === 'shipments' && (
              <div className="tab-pane">
                <div className="table-responsive">
                  <table className="admin-table admin-shipments-table">
                    <thead>
                      <tr>
                        <th>N° Guía</th>
                        <th>Transportadora</th>
                        <th>N° Orden</th>
                        <th>Destinatario</th>
                        <th>Ciudad / DANE</th>
                        <th>Flete</th>
                        <th>Estado de Tracking</th>
                        <th>Acción Guía</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.map((s) => (
                        <tr key={s.guide_number}>
                          <td><strong className="guide-number-val">{s.guide_number}</strong></td>
                          <td><span className="carrier-badge">{s.carrier_name}</span></td>
                          <td>#{s.order_number}</td>
                          <td>{s.customer_name} ({s.customer_email})</td>
                          <td>{s.delivery_city} ({s.destiny_dane_code})</td>
                          <td>${s.shipping_cost.toLocaleString('es-CO')} COP</td>
                          <td>
                            <span className="tracking-status-text">
                              🟢 {s.tracking_status}
                            </span>
                          </td>
                          <td>
                            <a
                              href={`/api/shipping/guide/${s.guide_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-table-action download"
                            >
                              📄 Descargar PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PESTAÑA 3: REGISTROS DE CORREO */}
            {activeTab === 'emails' && (
              <div className="tab-pane">
                <div className="table-responsive">
                  <table className="admin-table admin-emails-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>N° Orden</th>
                        <th>Destinatario</th>
                        <th>Asunto</th>
                        <th>Estado</th>
                        <th>Fecha y Hora</th>
                        <th>Detalle / Archivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-4 text-muted">
                            No hay registros de correo aún.
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{log.id}</td>
                            <td>#{log.order_number}</td>
                            <td><strong>{log.recipient_email}</strong></td>
                            <td>{log.subject}</td>
                            <td>
                              <span className={`email-status-pill status-${log.status.toLowerCase()}`}>
                                {log.status}
                              </span>
                            </td>
                            <td>{new Date(log.sent_at).toLocaleString('es-CO')}</td>
                            <td>
                              <a
                                href={`/api/orders/${log.order_number}/email-preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-table-action preview"
                              >
                                🔍 Ver Correo
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PESTAÑA 4: DIAGNÓSTICO DEL SISTEMA */}
            {activeTab === 'diagnostic' && configStatus && (
              <div className="tab-pane diagnostic-pane">
                <div className="diagnostic-card">
                  <h4 className="diag-title">1. Integración Logística Mi Paquete v2</h4>
                  <div className="diag-details">
                    <p><strong>Proveedor:</strong> {configStatus.mipaquete.provider}</p>
                    <p><strong>Endpoint Base:</strong> <code>{configStatus.mipaquete.baseUrl}</code></p>
                    <p>
                      <strong>API Key Configurada:</strong>{' '}
                      {configStatus.mipaquete.apiKeyConfigured ? (
                        <span className="badge-ok">Configurada en .env</span>
                      ) : (
                        <span className="badge-pending">Pendiente en .env (MIPAQUETE_APIKEY)</span>
                      )}
                    </p>
                    <p><strong>Origen de Despachos:</strong> {configStatus.mipaquete.originCity} (DANE {configStatus.mipaquete.originDaneCode})</p>
                    <p className="diag-note">
                      * El sistema incluye cotizador inteligente con transportadoras nacionales (Coordinadora, Servientrega, TCC, Envía) y generador de guías estándar.
                    </p>
                  </div>
                </div>

                <div className="diagnostic-card">
                  <h4 className="diag-title">2. Servicio de Notificaciones por Correo</h4>
                  <div className="diag-details">
                    <p><strong>Proveedor:</strong> {configStatus.mailer.provider}</p>
                    <p><strong>Remitente Oficial:</strong> {configStatus.mailer.fromAddress}</p>
                    <p>
                      <strong>Servidor SMTP:</strong>{' '}
                      {configStatus.mailer.smtpHostConfigured ? (
                        <span className="badge-ok">Configurado en .env</span>
                      ) : (
                        <span className="badge-pending">Modo Local Activo (SMTP_HOST pendiente en .env)</span>
                      )}
                    </p>
                    <p><strong>Respaldo en Disco:</strong> Todos los correos se renderizan con la guía adjunta y se respaldan en <code>server/logs/emails/</code>.</p>
                  </div>
                </div>

                <div className="diagnostic-card">
                  <h4 className="diag-title">3. Base de Datos Transaccional</h4>
                  <div className="diag-details">
                    <p><strong>Motor:</strong> SQLite3 con WAL activado (ACID transactions)</p>
                    <p><strong>Archivo:</strong> <code>{configStatus.database.file}</code></p>
                    <p><strong>Estado:</strong> <span className="badge-ok">Operacional</span></p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL DETALLE DE ORDEN CON TRAZABILIDAD */}
        {selectedOrder && (
          <div className="order-detail-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="order-detail-card" onClick={(e) => e.stopPropagation()}>
              <div className="order-detail-header">
                <div>
                  <span className="detail-tag">Trazabilidad de Pedido</span>
                  <h3 className="detail-title">Orden #{selectedOrder.order.order_number}</h3>
                </div>
                <button type="button" className="btn-close-detail" onClick={() => setSelectedOrder(null)}>
                  ✕
                </button>
              </div>

              <div className="order-detail-body">
                <div className="detail-section">
                  <h4 className="detail-sec-title">Cliente y Entrega</h4>
                  <p><strong>Nombre:</strong> {selectedOrder.order.customer_name} {selectedOrder.order.customer_surname}</p>
                  <p><strong>Cédula/NIT:</strong> {selectedOrder.order.customer_doc}</p>
                  <p><strong>Email:</strong> {selectedOrder.order.customer_email}</p>
                  <p><strong>Teléfono:</strong> {selectedOrder.order.customer_phone}</p>
                  <p><strong>Dirección:</strong> {selectedOrder.order.delivery_address} {selectedOrder.order.delivery_neighborhood ? `(${selectedOrder.order.delivery_neighborhood})` : ''}</p>
                  <p><strong>Ciudad / Depto:</strong> {selectedOrder.order.delivery_city}, {selectedOrder.order.delivery_department} (DANE {selectedOrder.order.delivery_dane_code})</p>
                  {selectedOrder.order.delivery_notes && (
                    <p><strong>Notas de Entrega:</strong> {selectedOrder.order.delivery_notes}</p>
                  )}
                </div>

                <div className="detail-section">
                  <h4 className="detail-sec-title">Despacho Mi Paquete</h4>
                  <p><strong>Transportadora:</strong> {selectedOrder.shipment?.carrier_name}</p>
                  <p><strong>Número de Guía:</strong> <code>{selectedOrder.shipment?.guide_number}</code></p>
                  <p><strong>Estado:</strong> {selectedOrder.shipment?.tracking_status}</p>
                  <a
                    href={`/api/shipping/guide/${selectedOrder.shipment?.guide_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '0.5rem' }}
                  >
                    Ver / Imprimir Guía Oficial
                  </a>
                </div>

                <div className="detail-section">
                  <h4 className="detail-sec-title">Prendas Compradas</h4>
                  <ul>
                    {selectedOrder.items?.map((item) => (
                      <li key={item.id}>
                        {item.quantity}x {item.product_name} (Talla: {item.size}) — ${item.subtotal.toLocaleString('es-CO')} COP
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: '0.5rem' }}><strong>Total:</strong> ${selectedOrder.order.total.toLocaleString('es-CO')} COP</p>
                </div>

                <div className="detail-section">
                  <h4 className="detail-sec-title">Historial de Estados</h4>
                  <div className="history-timeline">
                    {selectedOrder.history?.map((h) => (
                      <div key={h.id} className="timeline-item">
                        <span className="timeline-time">{new Date(h.created_at).toLocaleString('es-CO')}</span>
                        <strong className="timeline-status">{h.new_status}</strong>
                        <p className="timeline-comment">{h.comment} (por {h.changed_by})</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
