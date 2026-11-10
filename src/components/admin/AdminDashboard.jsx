import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CloseIcon } from '../common/icons';
import { Button } from '../common/Button';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminProductsSection } from './AdminProductsSection';
import { AdminPopupsSection } from './AdminPopupsSection';
import { AdminSiteSettingsSection } from './AdminSiteSettingsSection';
import './AdminDashboard.css';

export const AdminDashboard = ({ isOpen, onClose }) => {
  const [adminUser, setAdminUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Navegación principal persistente
  // Secciones soportadas: 'dashboard', 'products', 'categories', 'discounts', 'inventory', 'orders', 'customers', 'shipments', 'announcements', 'emails', 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedDiscountFilter, setSelectedDiscountFilter] = useState('ALL');
  const workspaceRef = useRef(null);

  // Datos del Dashboard
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [configStatus, setConfigStatus] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filtros de Pedidos
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(null);

  // Filtros de Inventario
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');
  const [savingStockId, setSavingStockId] = useState(null);

  // Filtros de Clientes
  const [customerSearch, setCustomerSearch] = useState('');

  // Gestión de Barra de Anuncios
  const [announcements, setAnnouncements] = useState([]);
  const [isBarEnabled, setIsBarEnabled] = useState(true);
  const [rotationSeconds, setRotationSeconds] = useState(4);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    text: '',
    link: '',
    is_active: true,
    sort_order: 1,
    start_date: '',
    end_date: ''
  });
  const [announcementDeleteTarget, setAnnouncementDeleteTarget] = useState(null);
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);

  // Configuración y Pruebas del Servidor SMTP (Correos Transaccionales)
  const [smtpForm, setSmtpForm] = useState({
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: '',
    pass: '',
    mailFrom: '',
    resendKey: ''
  });
  const [hasStoredSmtpPass, setHasStoredSmtpPass] = useState(false);
  const [hasStoredResendKey, setHasStoredResendKey] = useState(false);
  const [smtpSource, setSmtpSource] = useState('NONE');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [smtpFeedback, setSmtpFeedback] = useState(null);
  const [showSmtpHelp, setShowSmtpHelp] = useState(false);

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
      if (e.key === 'Escape' && isOpen && !selectedOrder && !isAnnouncementModalOpen && !announcementDeleteTarget) {
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
  }, [isOpen, onClose, selectedOrder, isAnnouncementModalOpen, announcementDeleteTarget]);

  // Cargar datos administrativos al montar o al cambiar de pestaña
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
      const ordersRes = await fetch(`/api/admin/orders?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`, fetchOpts);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      // 3. Catálogo de productos para inventario, categorías y badges
      try {
        const prodRes = await fetch('/api/admin/products', fetchOpts);
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProductsList(prodData.products || []);
        } else {
          const pubRes = await fetch('/api/products');
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            setProductsList(pubData.data || []);
          }
        }
      } catch {
        // Fallback no crítico
      }

      // 4. Despachos y Guías
      if (activeTab === 'shipments' || activeTab === 'dashboard') {
        const shipRes = await fetch('/api/admin/shipments', fetchOpts);
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          setShipments(shipData.shipments || []);
        }
      }

      // 5. Registros de Correo
      if (activeTab === 'emails') {
        const emailRes = await fetch('/api/admin/emails', fetchOpts);
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          setEmailLogs(emailData.logs || []);
        }
      }

      // 6. Diagnóstico de Configuración
      if (activeTab === 'settings' || activeTab === 'diagnostic' || activeTab === 'dashboard') {
        const diagRes = await fetch('/api/admin/config-status', fetchOpts);
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          setConfigStatus(diagData.services);
        }
        if (activeTab === 'settings') {
          await loadSmtpConfig();
        }
      }

      // 7. Barra de Anuncios
      if (activeTab === 'announcements' || announcements.length === 0) {
        const annRes = await fetch('/api/admin/announcements', fetchOpts);
        if (annRes.ok) {
          const annData = await annRes.json();
          if (annData.success && annData.data) {
            setAnnouncements(annData.data.announcements || []);
            setIsBarEnabled(annData.data.barEnabled !== false);
            setRotationSeconds(annData.data.rotationSeconds || 4);
          }
        }
      }
    } catch (err) {
      console.warn('Error cargando datos del panel admin:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar configuración de servidor SMTP persistida en Neon
  const loadSmtpConfig = async () => {
    try {
      const res = await fetch('/api/admin/smtp-config', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setSmtpForm((prev) => ({
            ...prev,
            provider: data.config.provider || prev.provider,
            host: data.config.host || prev.host,
            port: data.config.port || prev.port,
            secure: data.config.secure !== undefined ? data.config.secure : prev.secure,
            user: data.config.user || prev.user,
            pass: '',
            mailFrom: data.config.mailFrom || prev.mailFrom,
            resendKey: ''
          }));
          setHasStoredSmtpPass(Boolean(data.config.hasPass));
          setHasStoredResendKey(Boolean(data.config.hasResendKey));
          setSmtpSource(data.config.source || 'NONE');
          if (data.config.mailFrom && !testEmailRecipient) {
            setTestEmailRecipient(data.config.mailFrom);
          }
        }
      }
    } catch (err) {
      console.warn('Error cargando configuración SMTP:', err);
    }
  };

  // Selector de plantillas predefinidas (Gmail, Resend, Brevo, Outlook, Personalizado)
  const handleSelectPreset = (presetKey) => {
    if (presetKey === 'gmail') {
      setSmtpForm((prev) => ({
        ...prev,
        provider: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true
      }));
    } else if (presetKey === 'resend') {
      setSmtpForm((prev) => ({
        ...prev,
        provider: 'resend',
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        user: 'resend'
      }));
    } else if (presetKey === 'brevo') {
      setSmtpForm((prev) => ({
        ...prev,
        provider: 'brevo',
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false
      }));
    } else if (presetKey === 'outlook') {
      setSmtpForm((prev) => ({
        ...prev,
        provider: 'outlook',
        host: 'smtp.office365.com',
        port: 587,
        secure: false
      }));
    } else {
      setSmtpForm((prev) => ({
        ...prev,
        provider: 'custom'
      }));
    }
  };

  // Guardar configuración de SMTP en Neon store_settings
  const handleSaveSmtpConfig = async (e) => {
    if (e) e.preventDefault();
    setSavingSmtp(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/admin/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(smtpForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSmtpFeedback({
          type: 'success',
          message: 'Configuración guardada exitosamente en Neon PostgreSQL. Vercel ya puede usar estas credenciales.'
        });
        if (data.config) {
          setHasStoredSmtpPass(Boolean(data.config.hasPass));
          setHasStoredResendKey(Boolean(data.config.hasResendKey));
          setSmtpSource(data.config.source || 'DATABASE');
        }
        // Refrescar diagnóstico de servicios
        const diagRes = await fetch('/api/admin/config-status', { credentials: 'include' });
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          setConfigStatus(diagData.services);
        }
        setTimeout(() => setSmtpFeedback(null), 5000);
      } else {
        setSmtpFeedback({
          type: 'error',
          message: data.message || 'Error guardando configuración SMTP.'
        });
      }
    } catch {
      setSmtpFeedback({
        type: 'error',
        message: 'Error de red al guardar la configuración.'
      });
    } finally {
      setSavingSmtp(false);
    }
  };

  // Probar conexión en vivo y enviar correo de prueba
  const handleTestSmtpConnection = async () => {
    setTestingSmtp(true);
    setSmtpFeedback(null);
    try {
      const res = await fetch('/api/admin/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...smtpForm,
          toEmail: testEmailRecipient.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSmtpFeedback({
          type: 'success',
          message: data.message || 'Conexión SMTP exitosa.'
        });
        await loadSmtpConfig();
      } else {
        setSmtpFeedback({
          type: 'error',
          message: `${data.message || 'Error en la prueba de conexión.'} ${data.tip ? `Sugerencia: ${data.tip}` : ''}`
        });
      }
    } catch {
      setSmtpFeedback({
        type: 'error',
        message: 'Error de red al conectar con el servidor de pruebas.'
      });
    } finally {
      setTestingSmtp(false);
    }
  };

  const loadAnnouncementsData = async () => {
    try {
      const res = await fetch('/api/admin/announcements', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAnnouncements(json.data.announcements || []);
          setIsBarEnabled(json.data.barEnabled !== false);
          setRotationSeconds(json.data.rotationSeconds || 4);
        }
      }
    } catch (err) {
      console.warn('Error refrescando anuncios:', err);
    }
  };

  // Cambio de pestaña suave con scroll al inicio
  const handleTabChange = (tabId, categoryParam = 'ALL', discountParam = 'ALL') => {
    setActiveTab(tabId);
    setSelectedOrder(null);
    if (categoryParam) setSelectedCategoryFilter(categoryParam);
    if (discountParam) setSelectedDiscountFilter(discountParam);
    if (workspaceRef.current) {
      workspaceRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Actualización rápida de stock (Inventario)
  const handleQuickStockUpdate = async (product, newStock) => {
    const validStock = Math.max(0, parseInt(newStock, 10) || 0);
    setSavingStockId(product.id);
    // Actualización optimista local
    setProductsList((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, stock: validStock } : p))
    );

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stock: validStock })
      });
      if (res.ok) {
        setActionFeedback(`Stock de «${product.name}» actualizado a ${validStock} unidades.`);
        setTimeout(() => setActionFeedback(null), 3000);
      } else {
        const errJson = await res.json();
        alert(errJson.message || 'Error actualizando stock.');
        loadDashboardData();
      }
    } catch {
      alert('Error de red al actualizar stock.');
      loadDashboardData();
    } finally {
      setSavingStockId(null);
    }
  };

  // Alternar barra de anuncios
  const handleToggleBarEnabled = async (nextState) => {
    setIsBarEnabled(nextState);
    try {
      const res = await fetch('/api/admin/announcements/toggle-bar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(data.message);
        setTimeout(() => setActionFeedback(null), 3000);
        window.dispatchEvent(new Event('announcements-updated'));
      }
    } catch {
      alert('Error al alternar la visibilidad de la barra de anuncios.');
      loadAnnouncementsData();
    }
  };

  // Cambiar velocidad de rotación
  const handleChangeRotation = async (seconds) => {
    setRotationSeconds(seconds);
    try {
      const res = await fetch('/api/admin/announcements/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seconds })
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(data.message);
        setTimeout(() => setActionFeedback(null), 3000);
        window.dispatchEvent(new Event('announcements-updated'));
      }
    } catch {
      alert('Error al cambiar la velocidad de rotación.');
      loadAnnouncementsData();
    }
  };

  // Abrir modal de creación de anuncio
  const handleOpenCreateAnnouncement = (presetText = '', presetLink = '') => {
    setEditingAnnouncement(null);
    setAnnouncementForm({
      text: presetText,
      link: presetLink,
      is_active: true,
      sort_order: announcements.length + 1,
      start_date: '',
      end_date: ''
    });
    setIsAnnouncementModalOpen(true);
  };

  // Abrir modal de edición de anuncio
  const handleOpenEditAnnouncement = (ann) => {
    setEditingAnnouncement(ann);
    setAnnouncementForm({
      text: ann.text || '',
      link: ann.link || '',
      is_active: Boolean(ann.is_active),
      sort_order: ann.sort_order || 1,
      start_date: ann.start_date ? ann.start_date.split('T')[0] : '',
      end_date: ann.end_date ? ann.end_date.split('T')[0] : ''
    });
    setIsAnnouncementModalOpen(true);
  };

  // Guardar anuncio
  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.text.trim()) {
      alert('El texto del anuncio es obligatorio.');
      return;
    }

    setIsSubmittingAnnouncement(true);
    try {
      const url = editingAnnouncement
        ? `/api/admin/announcements/${editingAnnouncement.id}`
        : '/api/admin/announcements';
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(announcementForm)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback(data.message);
        setIsAnnouncementModalOpen(false);
        loadAnnouncementsData();
        window.dispatchEvent(new Event('announcements-updated'));
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(data.message || 'Error guardando anuncio.');
      }
    } catch {
      alert('Error de red al guardar anuncio.');
    } finally {
      setIsSubmittingAnnouncement(false);
    }
  };

  // Eliminar anuncio
  const handleConfirmDeleteAnnouncement = async () => {
    if (!announcementDeleteTarget) return;

    try {
      const res = await fetch(`/api/admin/announcements/${announcementDeleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback(data.message);
        setAnnouncementDeleteTarget(null);
        loadAnnouncementsData();
        window.dispatchEvent(new Event('announcements-updated'));
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(data.message || 'Error eliminando anuncio.');
      }
    } catch {
      alert('Error de red al eliminar anuncio.');
    }
  };

  // Alternar estado de un anuncio
  const handleToggleAnnouncementStatus = async (ann) => {
    const nextState = !ann.is_active;
    try {
      const res = await fetch(`/api/admin/announcements/${ann.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: nextState })
      });
      if (res.ok) {
        loadAnnouncementsData();
        window.dispatchEvent(new Event('announcements-updated'));
      }
    } catch {
      alert('Error alternando estado del anuncio.');
    }
  };

  // Reordenar anuncio (subir / bajar)
  const handleMoveAnnouncement = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= announcements.length) return;

    const newOrder = [...announcements];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setAnnouncements(newOrder);

    try {
      await fetch('/api/admin/announcements/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderedIds: newOrder.map((a) => a.id) })
      });
      window.dispatchEvent(new Event('announcements-updated'));
    } catch {
      loadAnnouncementsData();
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
    } catch {
      alert('Error de red al actualizar estado.');
    }
  };

  // Reintento de envío de correo (Compra, Guía o Ambos)
  const handleResendEmail = async (orderNumber, emailType = 'ALL') => {
    setResendingEmail(`${orderNumber}-${emailType}`);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/resend-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ emailType })
      });

      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch (jsonErr) {
          console.error('[ResendEmail JSON parse error]', jsonErr);
        }
      } else {
        const rawText = await res.text();
        console.warn('[ResendEmail Non-JSON response]', res.status, rawText.substring(0, 200));
      }

      if (res.ok && data && data.success) {
        const typeLabel = emailType === 'placed'
          ? 'de confirmación de compra'
          : emailType === 'shipping'
          ? 'con la guía de despacho'
          : 'de compra y guía';
        const recipient = data.result?.recipient || 'el cliente';
        setActionFeedback(`✅ Notificación ${typeLabel} enviada a ${recipient} (#${orderNumber}).`);
        setTimeout(() => setActionFeedback(null), 5000);

        // Recargar datos del panel y refrescar modal de trazabilidad si está abierto
        await loadDashboardData();
        if (selectedOrder && selectedOrder.order && selectedOrder.order.order_number === orderNumber) {
          await handleViewOrderDetail(orderNumber);
        }
      } else {
        // Manejar fallas controladas según código HTTP
        let errorDetail = data?.message;
        if (res.status === 401) {
          errorDetail = 'Tu sesión administrativa ha expirado. Por favor recarga la página o inicia sesión de nuevo.';
        } else if (res.status === 404) {
          errorDetail = `El pedido #${orderNumber} no fue encontrado en la base de datos.`;
        } else if (res.status === 400) {
          errorDetail = data?.message || 'El pedido aún no tiene una guía generada para reenviar.';
        } else if (res.status === 422 || data?.code === 'SMTP_NOT_CONFIGURED') {
          errorDetail = data?.message || 'El servidor SMTP no está configurado. Ve a la pestaña "Configuración" en el panel para ingresar las credenciales de correo (Gmail, Resend o Brevo).';
        } else if (res.status === 502) {
          errorDetail = data?.message || 'El servidor SMTP rechazó la entrega del correo.';
        } else if (res.status === 504) {
          errorDetail = 'Tiempo de espera agotado al conectar con el servidor de correo SMTP en Vercel.';
        } else if (!errorDetail) {
          errorDetail = `Error del servidor (${res.status}). Revise la configuración SMTP en la pestaña Configuración.`;
        }

        alert(`⚠️ No se pudo reenviar la notificación:\n${errorDetail}`);
      }
    } catch (err) {
      console.error('[ResendEmail Network/Client Error]', err);
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        alert('⚠️ Error de conexión: No se pudo contactar al servidor. Comprueba tu conexión a internet.');
      } else {
        alert(`⚠️ Error inesperado al procesar el reenvío: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      setResendingEmail(null);
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

  // Directorio de Clientes consolidado a partir de pedidos
  const customersList = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const email = (o.customer_email || '').toLowerCase().trim();
      if (!email) return;
      if (!map.has(email)) {
        map.set(email, {
          email,
          name: `${o.customer_name || ''} ${o.customer_surname || ''}`.trim() || 'Cliente',
          phone: o.customer_phone || '—',
          doc: o.customer_doc || '—',
          city: o.delivery_city || '—',
          department: o.delivery_department || '—',
          totalSpent: 0,
          ordersCount: 0,
          lastOrderDate: o.created_at,
          orders: []
        });
      }
      const c = map.get(email);
      c.totalSpent += Number(o.total || 0);
      c.ordersCount += 1;
      c.orders.push(o.order_number);
      if (new Date(o.created_at) > new Date(c.lastOrderDate)) {
        c.lastOrderDate = o.created_at;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  // Filtrado de clientes
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList;
    const term = customerSearch.toLowerCase();
    return customersList.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.phone.includes(term)
    );
  }, [customersList, customerSearch]);

  // Categorías calculadas
  const categoriesStats = useMemo(() => {
    const map = {
      'Camisetas': { count: 0, stock: 0, icon: '👕', desc: 'Prendas Heavyweight y Oversized' },
      'Hoodies': { count: 0, stock: 0, icon: '🧥', desc: 'Sudaderas y sacos pesados con capucha' },
      'Pantalones & Joggers': { count: 0, stock: 0, icon: '👖', desc: 'Cargos tácticos, joggers y utility' },
      'Chaquetas': { count: 0, stock: 0, icon: '🧥', desc: 'Bombers tech, rompevientos y outerwear' },
      'Zapatillas': { count: 0, stock: 0, icon: '👟', desc: 'Sneakers urbanos, Air Force y kicks' },
      'Accesorios': { count: 0, stock: 0, icon: '🧢', desc: 'Gorras, cadenas de acero y bolsos tácticos' }
    };

    productsList.forEach((p) => {
      const cat = p.category || 'Accesorios';
      if (!map[cat]) {
        map[cat] = { count: 0, stock: 0, icon: '🏷️', desc: 'Artículos de colección urbana' };
      }
      map[cat].count += 1;
      map[cat].stock += Number(p.stock || 0);
    });

    return Object.entries(map).map(([name, data]) => ({ name, ...data }));
  }, [productsList]);

  // Alertas de inventario
  const lowStockProducts = useMemo(() => {
    return productsList.filter((p) => Number(p.stock || 0) <= 10);
  }, [productsList]);

  const outOfStockProducts = useMemo(() => {
    return productsList.filter((p) => Number(p.stock || 0) === 0);
  }, [productsList]);

  // Filtrado de inventario
  const filteredInventory = useMemo(() => {
    return productsList.filter((p) => {
      const stock = Number(p.stock || 0);
      if (inventoryStatusFilter === 'OUT' && stock > 0) return false;
      if (inventoryStatusFilter === 'LOW' && (stock === 0 || stock > 10)) return false;
      if (inventoryStatusFilter === 'HEALTHY' && stock <= 10) return false;

      if (inventorySearch.trim()) {
        const term = inventorySearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.color && p.color.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [productsList, inventoryStatusFilter, inventorySearch]);

  // Productos con descuento
  const discountedProducts = useMemo(() => {
    return productsList.filter((p) => Number(p.discountPercent || p.discount_percent || 0) > 0);
  }, [productsList]);

  // Definición completa de Pestañas de Navegación Persistente
  const navTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'products', label: 'Productos', icon: '🏷️', badge: productsList.length },
    { id: 'categories', label: 'Categorías', icon: '📂', badge: categoriesStats.length },
    { id: 'discounts', label: 'Descuentos', icon: '🏷️', badge: discountedProducts.length || null },
    { id: 'inventory', label: 'Inventario', icon: '📦', alert: lowStockProducts.length > 0 ? `${lowStockProducts.length} bajo stock` : null, alertTitle: `${lowStockProducts.length} productos con inventario bajo (10 unidades o menos)` },
    { id: 'orders', label: 'Pedidos', icon: '📑', badge: stats?.totalOrders || orders.length },
    { id: 'customers', label: 'Clientes', icon: '👥', badge: customersList.length || null },
    { id: 'shipments', label: 'Envíos', icon: '🚚', badge: shipments.length || null },
    { id: 'announcements', label: 'Barra Superior', icon: '📢', badge: announcements.filter(a => a.is_active).length || null },
    { id: 'popups', label: 'Anuncios Emergentes', icon: '📣' },
    { id: 'emails', label: 'Correos', icon: '✉️' },
    { id: 'site_settings', label: 'Configuración del Sitio', icon: '🌐' },
    { id: 'settings', label: 'Diagnóstico & SMTP', icon: '⚙️' }
  ];

  if (!isOpen) return null;

  return (
    <div className="admin-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <div className="admin-container">
        
        {/* =====================================================================
           1. CABECERA ADMINISTRATIVA FIJA Y VISIBLE
           ===================================================================== */}
        <header className="admin-header">
          <div className="admin-brand-box">
            <span className="admin-badge">URBAN STYLE BACKOFFICE</span>
            <h2 className="admin-title" id="admin-title">
              Panel Administrativo de Control y Envíos
            </h2>
          </div>

          <div className="admin-header-actions">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-store-link"
              title="Abrir tienda pública en una pestaña nueva"
            >
              🏪 Ver Tienda ↗
            </a>
            {adminUser && (
              <span className="admin-user-chip" title="Usuario administrador autenticado">
                👤 {adminUser.username}
              </span>
            )}
            {adminUser && (
              <button type="button" className="admin-logout-btn" onClick={handleLogout}>
                Cerrar Sesión
              </button>
            )}
            <button
              type="button"
              className="admin-close-btn"
              onClick={onClose}
              aria-label="Cerrar panel administrativo"
              title="Volver a la tienda"
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </header>

        {/* FEEDBACK TOAST DE ACCIONES EXITOSAS */}
        {actionFeedback && (
          <div className="admin-feedback-toast" role="status">
            <span>✓ {actionFeedback}</span>
          </div>
        )}

        {/* =====================================================================
           2. BARRA DE NAVEGACIÓN PERSISTENTE (NUNCA DESAPARECE, NUNCA SE OCULTA)
           ===================================================================== */}
        {adminUser && (
          <nav className="admin-persistent-nav" aria-label="Navegación del Panel Administrativo">
            
            {/* SELECTOR DESPLEGABLE EN PANTALLAS PEQUEÑAS / MÓVILES */}
            <div className="admin-nav-mobile-wrapper">
              <span className="mobile-nav-label">Módulo activo:</span>
              <select
                className="admin-nav-mobile-select"
                value={activeTab}
                onChange={(e) => handleTabChange(e.target.value)}
                aria-label="Seleccionar módulo del panel"
              >
                {navTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.icon} {tab.label} {tab.badge ? `(${tab.badge})` : ''} {tab.alert ? tab.alert : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* BARRA HORIZONTAL COMPLETA DE PESTAÑAS (ESCRITORIO Y TABLETS) */}
            <div className="admin-nav-tabs-scrollable">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id)}
                    title={`Abrir sección ${tab.label}`}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-label-text">{tab.label}</span>
                    {tab.badge !== undefined && tab.badge !== null && (
                      <span className={`tab-counter-badge ${isActive ? 'active-badge' : ''}`}>
                        {tab.badge}
                      </span>
                    )}
                    {tab.alert && (
                      <span className="tab-alert-badge" title={tab.alertTitle || "Alerta de inventario"}>
                        {tab.alert}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* =====================================================================
           3. ÁREA DE TRABAJO INDEPENDIENTE CON DESPLAZAMIENTO VERTICAL EXCLUSIVO
           ===================================================================== */}
        <main className="admin-workspace" ref={workspaceRef} id="admin-workspace-scroll">
          
          {/* VERIFICANDO SESIÓN */}
          {isCheckingAuth ? (
            <div className="auth-loading-card">
              <div className="spinner-icon">⏳</div>
              <p>Verificando credenciales de sesión en Urban Style...</p>
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
            <>
              {/* ===============================================================
                 SECCIÓN 1: DASHBOARD / INICIO GENERAL
                 =============================================================== */}
              {activeTab === 'dashboard' && (
                <div className="tab-pane dashboard-home-pane">
                  {/* RESUMEN DE VENTAS Y PEDIDOS */}
                  {stats && (
                    <div className="admin-metrics-grid">
                      <div className="metric-card">
                        <span className="metric-label">Ventas Totales</span>
                        <strong className="metric-value">{stats.formattedRevenue}</strong>
                        <span className="metric-subtext">Ingresos netos consolidados</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">Total Pedidos</span>
                        <strong className="metric-value">{stats.totalOrders}</strong>
                        <span className="metric-subtext">Histórico en tienda</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">En Preparación</span>
                        <strong className="metric-value text-accent">{stats.pendingOrders}</strong>
                        <span className="metric-subtext">Listos para despachar</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">Despachados</span>
                        <strong className="metric-value text-green">{stats.shippedOrders}</strong>
                        <span className="metric-subtext">Con guía Mi Paquete</span>
                      </div>
                    </div>
                  )}

                  {/* BARRA DE ACCESOS DIRECTOS RÁPIDOS */}
                  <div className="quick-access-bar">
                    <span className="quick-label">⚡ Accesos Directos:</span>
                    <div className="quick-actions-pills">
                      <button
                        type="button"
                        className="quick-pill-btn"
                        onClick={() => handleTabChange('products')}
                      >
                        🏷️ Ver Catálogo de Productos ({productsList.length})
                      </button>
                      <button
                        type="button"
                        className="quick-pill-btn"
                        onClick={() => handleTabChange('discounts')}
                      >
                        🏷️ Administrar Descuentos ({discountedProducts.length})
                      </button>
                      <button
                        type="button"
                        className="quick-pill-btn"
                        onClick={() => handleTabChange('inventory')}
                      >
                        📦 Control de Stock {lowStockProducts.length > 0 && `(${lowStockProducts.length} bajo stock)`}
                      </button>
                      <button
                        type="button"
                        className="quick-pill-btn"
                        onClick={() => handleTabChange('orders')}
                      >
                        📑 Gestión de Pedidos ({orders.length})
                      </button>
                      <button
                        type="button"
                        className="quick-pill-btn"
                        onClick={() => handleTabChange('announcements')}
                      >
                        📢 Configurar Anuncios
                      </button>
                    </div>
                  </div>

                  {/* DISTRIBUCIÓN EN 2 COLUMNAS: PEDIDOS RECIENTES + ALERTAS DE STOCK */}
                  <div className="dashboard-two-columns">
                    {/* PEDIDOS RECIENTES */}
                    <div className="dashboard-widget-card">
                      <div className="widget-header">
                        <h3 className="widget-title">📑 Últimos Pedidos Registrados</h3>
                        <button
                          type="button"
                          className="widget-action-link"
                          onClick={() => handleTabChange('orders')}
                        >
                          Ver todos ({orders.length}) →
                        </button>
                      </div>
                      {orders.length === 0 ? (
                        <p className="widget-empty-msg">No hay pedidos registrados en la tienda.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="admin-table mini-table">
                            <thead>
                              <tr>
                                <th>Orden</th>
                                <th>Cliente</th>
                                <th>Total COP</th>
                                <th>Estado</th>
                                <th>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orders.slice(0, 5).map((ord) => (
                                <tr key={ord.order_number}>
                                  <td><strong>#{ord.order_number}</strong></td>
                                  <td>{ord.customer_name} {ord.customer_surname}</td>
                                  <td>${ord.total.toLocaleString('es-CO')}</td>
                                  <td>
                                    <span className={`status-pill status-${ord.status.toLowerCase()}`}>
                                      {ord.status}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="action-link"
                                      onClick={() => handleViewOrderDetail(ord.order_number)}
                                    >
                                      👁️ Ver
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ALERTAS DE STOCK */}
                    <div className="dashboard-widget-card">
                      <div className="widget-header">
                        <h3 className="widget-title">📦 Alertas de Inventario (Bajo Stock)</h3>
                        <button
                          type="button"
                          className="widget-action-link"
                          onClick={() => handleTabChange('inventory')}
                        >
                          Gestionar Stock →
                        </button>
                      </div>
                      {lowStockProducts.length === 0 ? (
                        <div className="stock-all-good-box">
                          <span className="all-good-icon">✓</span>
                          <p>¡Todo en orden! No hay productos con stock crítico o agotado.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="admin-table mini-table">
                            <thead>
                              <tr>
                                <th>Prenda</th>
                                <th>Categoría</th>
                                <th>Stock Actual</th>
                                <th>Acción Rápida</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lowStockProducts.slice(0, 5).map((p) => {
                                const stock = Number(p.stock || 0);
                                return (
                                  <tr key={p.id}>
                                    <td><strong>{p.name}</strong></td>
                                    <td>{p.category}</td>
                                    <td>
                                      <span className={`stock-status-pill ${stock === 0 ? 'stock-out' : 'stock-low'}`}>
                                        {stock === 0 ? '❌ Agotado' : `🟡 ${stock} un. (bajo)`}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn-stock-quick-add"
                                        onClick={() => handleQuickStockUpdate(p, stock + 10)}
                                        title="Agregar 10 unidades al stock"
                                      >
                                        ＋10 un.
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ESTADO RÁPIDO DE SERVICIOS */}
                  <div className="system-health-banner">
                    <div className="health-item">
                      <span className="health-dot dot-green" />
                      <span><strong>Tienda Online:</strong> Operacional</span>
                    </div>
                    <div className="health-item">
                      <span className="health-dot dot-green" />
                      <span><strong>Base de Datos:</strong> PostgreSQL Neon & SQLite WAL</span>
                    </div>
                    <div className="health-item">
                      <span className="health-dot dot-green" />
                      <span><strong>Logística:</strong> Mi Paquete Colombia</span>
                    </div>
                    <div className="health-item">
                      <span className="health-dot dot-green" />
                      <span><strong>Correos:</strong> Notificaciones Activas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 2: PRODUCTOS (CATÁLOGO REESTRUCTURADO EN 9 COLUMNAS)
                 =============================================================== */}
              {activeTab === 'products' && (
                <div className="tab-pane">
                  <AdminProductsSection
                    initialCategory={selectedCategoryFilter}
                    initialDiscountFilter={selectedDiscountFilter}
                    onNotification={(msg) => {
                      setActionFeedback(msg);
                      loadDashboardData();
                      setTimeout(() => setActionFeedback(null), 4000);
                    }}
                  />
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 3: CATEGORÍAS (EXPLORADOR Y FILTRADO DIRECTO)
                 =============================================================== */}
              {activeTab === 'categories' && (
                <div className="tab-pane categories-pane">
                  <div className="section-intro-card">
                    <div>
                      <h3 className="section-title">📂 Explorador de Categorías de URBAN STYLE</h3>
                      <p className="section-subtitle">
                        Consulta y gestiona el volumen de productos, stock disponible y precios promedio organizados por categoría.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary-action"
                      onClick={() => handleTabChange('products')}
                    >
                      🏷️ Ver Todo el Catálogo
                    </button>
                  </div>

                  <div className="categories-cards-grid">
                    {categoriesStats.map((cat) => (
                      <div key={cat.name} className="category-explorer-card">
                        <div className="category-icon-box">{cat.icon}</div>
                        <h4 className="category-card-title">{cat.name}</h4>
                        <p className="category-card-desc">{cat.desc}</p>
                        
                        <div className="category-stats-row">
                          <div className="stat-col">
                            <span className="stat-label">Prendas:</span>
                            <strong className="stat-val">{cat.count}</strong>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">Stock Total:</span>
                            <strong className="stat-val">{cat.stock} un.</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-category-action"
                          onClick={() => handleTabChange('products', cat.name, 'ALL')}
                        >
                          Ver Productos de {cat.name} →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 4: DESCUENTOS Y PROMOCIONES
                 =============================================================== */}
              {activeTab === 'discounts' && (
                <div className="tab-pane discounts-pane">
                  <div className="section-intro-card">
                    <div>
                      <h3 className="section-title">🏷️ Centro de Descuentos y Promociones</h3>
                      <p className="section-subtitle">
                        Configura porcentajes de rebaja, fechas de vigencia y promociones para temporadas especiales.
                      </p>
                    </div>
                  </div>

                  {/* MÉTRICAS DE DESCUENTOS */}
                  <div className="admin-metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Productos con Descuento</span>
                      <strong className="metric-value text-accent">{discountedProducts.length}</strong>
                      <span className="metric-subtext">Con oferta activa o programada</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Descuento Promedio</span>
                      <strong className="metric-value">
                        {discountedProducts.length > 0
                          ? `${Math.round(
                              discountedProducts.reduce((acc, p) => acc + (p.discountPercent || p.discount_percent || 0), 0) /
                                discountedProducts.length
                            )}%`
                          : '0%'}
                      </strong>
                      <span className="metric-subtext">Sobre precio oficial</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Productos sin Descuento</span>
                      <strong className="metric-value">{productsList.length - discountedProducts.length}</strong>
                      <span className="metric-subtext">A precio estándar regular</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Total en Catálogo</span>
                      <strong className="metric-value">{productsList.length}</strong>
                      <span className="metric-subtext">Prendas registradas</span>
                    </div>
                  </div>

                  {/* TABLA DE PRODUCTOS EN MODO DESCUENTOS */}
                  <AdminProductsSection
                    initialCategory="ALL"
                    initialDiscountFilter="WITH_DISCOUNT"
                    onNotification={(msg) => {
                      setActionFeedback(msg);
                      loadDashboardData();
                      setTimeout(() => setActionFeedback(null), 4000);
                    }}
                  />
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 5: INVENTARIO Y STOCK
                 =============================================================== */}
              {activeTab === 'inventory' && (
                <div className="tab-pane inventory-pane">
                  <div className="section-intro-card">
                    <div>
                      <h3 className="section-title">📦 Control de Inventario y Existencias</h3>
                      <p className="section-subtitle">
                        Modifica en tiempo real el stock de cada producto, atiende alertas de prendas agotadas y mantén la bodega sincronizada.
                      </p>
                    </div>
                  </div>

                  {/* MÉTRICAS DE INVENTARIO */}
                  <div className="admin-metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Unidades en Bodega</span>
                      <strong className="metric-value text-green">
                        {productsList.reduce((acc, p) => acc + Number(p.stock || 0), 0)} un.
                      </strong>
                      <span className="metric-subtext">Inventario físico total</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Prendas Agotadas</span>
                      <strong className="metric-value text-danger">{outOfStockProducts.length}</strong>
                      <span className="metric-subtext">Stock en 0 unidades</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Stock Bajo (&le; 10)</span>
                      <strong className="metric-value text-accent">{lowStockProducts.length}</strong>
                      <span className="metric-subtext">Requieren reabastecimiento</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Stock Saludable</span>
                      <strong className="metric-value">
                        {productsList.length - lowStockProducts.length}
                      </strong>
                      <span className="metric-subtext">Mayor a 10 unidades</span>
                    </div>
                  </div>

                  {/* BARRA DE FILTROS DE INVENTARIO */}
                  <div className="filters-bar">
                    <div className="filter-group">
                      <label htmlFor="inv-status-filter">Filtrar por Stock:</label>
                      <select
                        id="inv-status-filter"
                        className="filter-select"
                        value={inventoryStatusFilter}
                        onChange={(e) => setInventoryStatusFilter(e.target.value)}
                      >
                        <option value="ALL">Todos los Productos ({productsList.length})</option>
                        <option value="OUT">❌ Solo Agotados ({outOfStockProducts.length})</option>
                        <option value="LOW">🟡 Solo Stock Bajo &le; 10 ({lowStockProducts.length})</option>
                        <option value="HEALTHY">✓ Stock Normal &gt; 10</option>
                      </select>
                    </div>

                    <div className="filter-group">
                      <input
                        type="search"
                        className="filter-search"
                        placeholder="Buscar por prenda, ID, categoría..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* TABLA INTERACTIVA DE INVENTARIO */}
                  <div className="table-responsive">
                    <table className="admin-table admin-inventory-table">
                      <thead>
                        <tr>
                          <th style={{ width: '130px' }}>ID</th>
                          <th>Producto</th>
                          <th style={{ width: '140px' }}>Categoría</th>
                          <th style={{ width: '130px' }}>Color</th>
                          <th style={{ width: '120px' }}>Precio COP</th>
                          <th style={{ width: '150px' }}>Estado Stock</th>
                          <th style={{ width: '240px', textAlign: 'center' }}>Ajuste Rápido de Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-4 text-muted">
                              No se encontraron productos con el filtro aplicado.
                            </td>
                          </tr>
                        ) : (
                          filteredInventory.map((p) => {
                            const stock = Number(p.stock || 0);
                            const isSaving = savingStockId === p.id;
                            return (
                              <tr key={p.id}>
                                <td>
                                  <code className="id-code-badge">{p.id}</code>
                                </td>
                                <td>
                                  <div className="inventory-prod-cell">
                                    <img
                                      src={p.image || '/images/products/prod-tshirt.jpg'}
                                      alt={p.name}
                                      className="inventory-thumb"
                                    />
                                    <div>
                                      <strong>{p.name}</strong>
                                      <div className="text-xs text-muted">{p.brand || 'URBAN STYLE'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>{p.category}</td>
                                <td>{p.color || 'Negro'}</td>
                                <td><strong>${Number(p.price || 0).toLocaleString('es-CO')}</strong></td>
                                <td>
                                  <span
                                    className={`stock-status-pill ${
                                      stock === 0
                                        ? 'stock-out'
                                        : stock <= 10
                                        ? 'stock-low'
                                        : 'stock-high'
                                    }`}
                                  >
                                    {stock === 0 ? '❌ Agotado' : stock <= 10 ? `🟡 ${stock} un. (bajo)` : `✓ ${stock} un.`}
                                  </span>
                                </td>
                                <td>
                                  <div className="stock-stepper-cell">
                                    <button
                                      type="button"
                                      className="btn-stepper step-sub"
                                      disabled={stock <= 0 || isSaving}
                                      onClick={() => handleQuickStockUpdate(p, stock - 1)}
                                      title="Restar 1 unidad"
                                    >
                                      -1
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      className="stock-direct-input"
                                      value={stock}
                                      onChange={(e) => handleQuickStockUpdate(p, e.target.value)}
                                      disabled={isSaving}
                                      title="Escribe directamente el número de existencias"
                                    />
                                    <button
                                      type="button"
                                      className="btn-stepper step-add"
                                      disabled={isSaving}
                                      onClick={() => handleQuickStockUpdate(p, stock + 1)}
                                      title="Sumar 1 unidad"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-stepper-batch"
                                      disabled={isSaving}
                                      onClick={() => handleQuickStockUpdate(p, stock + 10)}
                                      title="Sumar lote de +10 unidades"
                                    >
                                      +10
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 6: PEDIDOS Y COMPRAS
                 =============================================================== */}
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
                          <th>Notificaciones Correo</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan="10" className="text-center py-4 text-muted">
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
                                <div className="email-status-cell">
                                  <div className="email-badge-row">
                                    <span className="email-label">✉️ Compra:</span>
                                    <span className={`email-badge ${order.order_placed_email_status?.toLowerCase() || 'pending_config'}`}>
                                      {order.order_placed_email_status === 'ACCEPTED' ? '✓ Aceptado' :
                                       order.order_placed_email_status === 'DELIVERED' ? '✓ Entregado' :
                                       order.order_placed_email_status === 'SENT' ? '✓ Enviado' :
                                       order.order_placed_email_status === 'PENDING_CONFIG' ? '⚪ Pendiente SMTP' :
                                       order.order_placed_email_status === 'FAILED' ? '✕ Falló' : '⚪ Pendiente'}
                                    </span>
                                  </div>
                                  <div className="email-badge-row">
                                    <span className="email-label">🚚 Guía:</span>
                                    <span className={`email-badge ${order.shipping_email_status?.toLowerCase() || 'not_dispatched'}`}>
                                      {order.shipping_email_status === 'ACCEPTED' ? '✓ Aceptada' :
                                       order.shipping_email_status === 'DELIVERED' ? '✓ Entregada' :
                                       order.shipping_email_status === 'SENT' ? '✓ Enviada' :
                                       order.shipping_email_status === 'NOT_DISPATCHED' ? 'Sin Despacho' :
                                       order.shipping_email_status === 'PENDING_CONFIG' ? '⚪ Pendiente SMTP' :
                                       order.shipping_email_status === 'FAILED' ? '✕ Falló' : '⚪ Pendiente'}
                                    </span>
                                  </div>
                                  {order.email_last_sent && (
                                    <div className="text-muted text-xs" style={{ marginTop: '2px' }}>
                                      🕒 {new Date(order.email_last_sent).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  )}
                                  {order.order_placed_email_status === 'PENDING_CONFIG' && (
                                    <button
                                      type="button"
                                      onClick={() => handleTabChange('settings')}
                                      className="email-config-hint"
                                      title="El servidor de correo no está configurado. Haz clic para configurar SMTP."
                                    >
                                      ⚙️ Requiere SMTP
                                    </button>
                                  )}
                                  {order.order_placed_email_status === 'FAILED' && order.order_placed_email_error && (
                                    <div className="email-error-hint" title={order.order_placed_email_error}>
                                      ❌ Error de envío
                                    </div>
                                  )}
                                </div>
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
                                    onClick={() => handleResendEmail(order.order_number, 'ALL')}
                                    title="Reenviar correos de compra y guía"
                                    disabled={resendingEmail?.startsWith(order.order_number)}
                                  >
                                    {resendingEmail?.startsWith(order.order_number) ? '⏳ Enviando...' : '✉️ Reenviar'}
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

              {/* ===============================================================
                 SECCIÓN 7: CLIENTES (DIRECTORIO CONSOLIDADO)
                 =============================================================== */}
              {activeTab === 'customers' && (
                <div className="tab-pane customers-pane">
                  <div className="section-intro-card">
                    <div>
                      <h3 className="section-title">👥 Directorio de Clientes de URBAN STYLE</h3>
                      <p className="section-subtitle">
                        Base de compradores frecuentes, contacto directo, ciudad de destino y volumen histórico de compras.
                      </p>
                    </div>
                  </div>

                  {/* MÉTRICAS DE CLIENTES */}
                  <div className="admin-metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Clientes Registrados</span>
                      <strong className="metric-value">{customersList.length}</strong>
                      <span className="metric-subtext">Usuarios únicos con órdenes</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Clientes Recurrentes</span>
                      <strong className="metric-value text-accent">
                        {customersList.filter((c) => c.ordersCount > 1).length}
                      </strong>
                      <span className="metric-subtext">Más de 1 compra realizada</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Ticket Promedio por Cliente</span>
                      <strong className="metric-value text-green">
                        ${customersList.length > 0
                          ? Math.round(
                              customersList.reduce((acc, c) => acc + c.totalSpent, 0) / customersList.length
                            ).toLocaleString('es-CO')
                          : 0}{' '}
                        COP
                      </strong>
                      <span className="metric-subtext">Gasto acumulado por cliente</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Ciudades de Cobertura</span>
                      <strong className="metric-value">
                        {new Set(customersList.map((c) => c.city).filter((c) => c && c !== '—')).size}
                      </strong>
                      <span className="metric-subtext">Destinos a nivel nacional</span>
                    </div>
                  </div>

                  {/* BUSCADOR DE CLIENTES */}
                  <div className="filters-bar">
                    <div className="filter-group">
                      <input
                        type="search"
                        className="filter-search"
                        placeholder="Buscar cliente por nombre, email, ciudad o teléfono..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        style={{ minWidth: '320px' }}
                      />
                    </div>
                    <span className="text-muted text-sm">
                      Mostrando {filteredCustomers.length} de {customersList.length} clientes
                    </span>
                  </div>

                  {/* TABLA DE CLIENTES */}
                  <div className="table-responsive">
                    <table className="admin-table admin-customers-table">
                      <thead>
                        <tr>
                          <th>Nombre del Cliente</th>
                          <th>Cédula / Documento</th>
                          <th>Correo Electrónico</th>
                          <th>Teléfono</th>
                          <th>Ciudad y Depto</th>
                          <th style={{ textAlign: 'center' }}>N° Pedidos</th>
                          <th>Total Comprado COP</th>
                          <th>Última Compra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-4 text-muted">
                              No se encontraron clientes con el criterio de búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredCustomers.map((cust) => (
                            <tr key={cust.email}>
                              <td><strong>{cust.name}</strong></td>
                              <td><code>{cust.doc}</code></td>
                              <td><a href={`mailto:${cust.email}`} className="guide-link">{cust.email}</a></td>
                              <td>{cust.phone}</td>
                              <td>{cust.city} ({cust.department})</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="tab-counter-badge active-badge">{cust.ordersCount}</span>
                              </td>
                              <td><strong>${cust.totalSpent.toLocaleString('es-CO')} COP</strong></td>
                              <td>{new Date(cust.lastOrderDate).toLocaleDateString('es-CO')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 8: GUÍAS Y ENVÍOS MI PAQUETE
                 =============================================================== */}
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

              {/* ===============================================================
                 SECCIÓN 9: BARRA DE ANUNCIOS
                 =============================================================== */}
              {activeTab === 'announcements' && (
                <div className="tab-pane">
                  {/* BARRA SUPERIOR DE CONTROL GLOBAL */}
                  <div className="announcements-control-bar">
                    <div className="announcements-global-toggle-box">
                      <label className="toggle-switch-label">
                        <input
                          type="checkbox"
                          className="toggle-switch-input"
                          checked={isBarEnabled}
                          onChange={(e) => handleToggleBarEnabled(e.target.checked)}
                        />
                        <span className="toggle-switch-slider" />
                      </label>
                      <div className="toggle-info">
                        <span className="toggle-title">
                          Estado de la Barra de Anuncios:
                          <strong className={isBarEnabled ? 'text-green' : 'text-muted'}>
                            {isBarEnabled ? ' 🟢 ACTIVA EN LA TIENDA' : ' ⚪ DESACTIVADA'}
                          </strong>
                        </span>
                        <span className="toggle-subtitle">
                          {isBarEnabled
                            ? 'Los anuncios activos se muestran rotando en la parte superior de la tienda.'
                            : 'La barra está oculta en la tienda pública.'}
                        </span>
                      </div>
                    </div>

                    <div className="announcements-speed-box">
                      <label htmlFor="rotation-select">Velocidad:</label>
                      <select
                        id="rotation-select"
                        className="filter-select"
                        value={rotationSeconds}
                        onChange={(e) => handleChangeRotation(Number(e.target.value))}
                      >
                        <option value={3}>3s (Rápido)</option>
                        <option value={4}>4s (Recomendado)</option>
                        <option value={5}>5s (Normal)</option>
                        <option value={6}>6s (Pausado)</option>
                        <option value={8}>8s (Lento)</option>
                      </select>
                      <button
                        type="button"
                        className="btn-search"
                        onClick={() => handleOpenCreateAnnouncement()}
                      >
                        ➕ Nuevo Anuncio
                      </button>
                    </div>
                  </div>

                  {/* PRESETS RÁPIDOS */}
                  <div className="announcement-presets-card">
                    <span className="presets-label">⚡ Mensajes promocionales sugeridos (clic para añadir):</span>
                    <div className="presets-buttons-group">
                      <button
                        type="button"
                        className="btn-preset-chip"
                        onClick={() => handleOpenCreateAnnouncement('¡Envíos a todo Colombia!', '#beneficios')}
                      >
                        + ¡Envíos a todo Colombia!
                      </button>
                      <button
                        type="button"
                        className="btn-preset-chip"
                        onClick={() => handleOpenCreateAnnouncement('¡Ofertas especiales por tiempo limitado!', '#ofertas')}
                      >
                        + ¡Ofertas especiales por tiempo limitado!
                      </button>
                      <button
                        type="button"
                        className="btn-preset-chip"
                        onClick={() => handleOpenCreateAnnouncement('¡Nuevas colecciones disponibles!', '#coleccion')}
                      >
                        + ¡Nuevas colecciones disponibles!
                      </button>
                      <button
                        type="button"
                        className="btn-preset-chip"
                        onClick={() => handleOpenCreateAnnouncement('¡Descuentos especiales en productos seleccionados!', '#productos')}
                      >
                        + ¡Descuentos especiales en productos seleccionados!
                      </button>
                    </div>
                  </div>

                  {/* TABLA DE ANUNCIOS */}
                  <div className="table-responsive">
                    <table className="admin-table admin-announcements-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px', textAlign: 'center' }}>Orden</th>
                          <th>Mensaje del Anuncio</th>
                          <th style={{ width: '180px' }}>Enlace de Destino</th>
                          <th style={{ width: '170px' }}>Programación Fechas</th>
                          <th style={{ width: '110px', textAlign: 'center' }}>Estado</th>
                          <th style={{ width: '180px', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {announcements.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                              No hay anuncios registrados. Haz clic en «➕ Nuevo Anuncio» o selecciona un mensaje sugerido.
                            </td>
                          </tr>
                        ) : (
                          announcements.map((ann, idx) => (
                            <tr key={ann.id}>
                              <td style={{ textAlign: 'center' }}>
                                <div className="order-stepper-btns">
                                  <button
                                    type="button"
                                    className="btn-order-step"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveAnnouncement(idx, 'up')}
                                    title="Subir prioridad"
                                  >
                                    ▲
                                  </button>
                                  <span className="order-num-text">{idx + 1}</span>
                                  <button
                                    type="button"
                                    className="btn-order-step"
                                    disabled={idx === announcements.length - 1}
                                    onClick={() => handleMoveAnnouncement(idx, 'down')}
                                    title="Bajar prioridad"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </td>
                              <td>
                                <strong className="ann-text-preview">{ann.text}</strong>
                              </td>
                              <td>
                                {ann.link ? (
                                  <span className="ann-link-badge">{ann.link}</span>
                                ) : (
                                  <span className="text-muted text-xs">Sin enlace</span>
                                )}
                              </td>
                              <td>
                                <div className="ann-dates-box">
                                  <span>{ann.start_date ? `Desde: ${ann.start_date.split('T')[0]}` : 'Inmediato'}</span>
                                  <span>{ann.end_date ? `Hasta: ${ann.end_date.split('T')[0]}` : 'Indefinido'}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className={`status-toggle-btn ${ann.is_active ? 'active' : 'inactive'}`}
                                  onClick={() => handleToggleAnnouncementStatus(ann)}
                                  title="Clic para activar/desactivar"
                                >
                                  {ann.is_active ? '🟢 Activo' : '⚪ Inactivo'}
                                </button>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="actions-cell" style={{ justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="action-link"
                                    onClick={() => handleOpenEditAnnouncement(ann)}
                                    title="Editar mensaje y configuración"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-action-delete"
                                    onClick={() => setAnnouncementDeleteTarget(ann)}
                                    title="Eliminar anuncio permanentemente"
                                  >
                                    🗑️ Borrar
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

              {/* ===============================================================
                 SECCIÓN NUEVA: ANUNCIOS EMERGENTES (POPUPS EN LA TIENDA)
                 =============================================================== */}
              {activeTab === 'popups' && (
                <div className="tab-pane">
                  <AdminPopupsSection
                    onToast={(msg) => setActionFeedback(msg)}
                  />
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 10: REGISTRO DE CORREOS
                 =============================================================== */}
              {activeTab === 'emails' && (
                <div className="tab-pane">
                  <div className="table-responsive">
                    <table className="admin-table admin-emails-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>N° Orden</th>
                          <th>Tipo Notificación</th>
                          <th>Destinatario</th>
                          <th>Message-ID & Proveedor</th>
                          <th>Estado</th>
                          <th>Fecha y Hora</th>
                          <th>Vista Previa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailLogs.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-4 text-muted">
                              No hay registros de correo aún.
                            </td>
                          </tr>
                        ) : (
                          emailLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{log.id}</td>
                              <td><strong>#{log.order_number}</strong></td>
                              <td>
                                <div>
                                  <strong>
                                    {log.email_type === 'ORDER_CONFIRMATION' ? '✉️ Confirmación' : '🚚 Guía Despacho'}
                                  </strong>
                                </div>
                                <div className="text-muted text-xs">{log.subject}</div>
                              </td>
                              <td><strong>{log.recipient_email}</strong></td>
                              <td>
                                {log.message_id ? (
                                  <div><code style={{ fontSize: '0.72rem' }}>{log.message_id}</code></div>
                                ) : (
                                  <div className="text-muted text-xs">Sin Message-ID</div>
                                )}
                                <div className="text-muted text-xs">
                                  {log.provider_name || 'SMTP'} {log.provider_response ? `(${log.provider_response})` : ''}
                                </div>
                              </td>
                              <td>
                                <span className={`email-badge ${log.status?.toLowerCase() || 'pending_config'}`}>
                                  {log.status === 'ACCEPTED' ? '✓ Aceptado SMTP' :
                                   log.status === 'DELIVERED' ? '✓ Entregado' :
                                   log.status === 'SENT' ? '✓ Enviado' :
                                   log.status === 'PENDING_CONFIG' ? '⚪ Pendiente SMTP' :
                                   log.status === 'IDEMPOTENT_SKIPPED' ? 'Omitido' : '✕ Falló'}
                                </span>
                                {log.status === 'PENDING_CONFIG' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleTabChange('settings')}
                                    className="email-config-hint"
                                    title="El servidor SMTP no está configurado. Haz clic para ir a Configuración."
                                  >
                                    ⚙️ Requiere SMTP
                                  </button>
                                ) : log.error_message ? (
                                  <div className="email-error-hint" title={log.error_message}>
                                    ❌ {log.error_message.length > 25 ? `${log.error_message.substring(0, 25)}...` : log.error_message}
                                  </div>
                                ) : null}
                              </td>
                              <td>{new Date(log.sent_at || log.created_at).toLocaleString('es-CO')}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <a
                                    href={`/api/orders/${log.order_number}/email-preview?type=${log.email_type === 'SHIPPING_NOTIFICATION' ? 'shipping' : 'placed'}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-table-action preview"
                                  >
                                    🔍 HTML
                                  </a>
                                  {log.preview_url && log.preview_url.startsWith('http') && (
                                    <a
                                      href={log.preview_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-table-action edit"
                                      title="Ver mensaje en buzón web real"
                                    >
                                      🌐 Buzón
                                    </a>
                                  )}
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

              {/* ===============================================================
                 SECCIÓN NUEVA: CONFIGURACIÓN DEL SITIO (FOOTER, DATOS, CONTACTO Y REDES)
                 =============================================================== */}
              {activeTab === 'site_settings' && (
                <div className="tab-pane">
                  <AdminSiteSettingsSection
                    onToast={(msg) => setActionFeedback(msg)}
                  />
                </div>
              )}

              {/* ===============================================================
                 SECCIÓN 11: CONFIGURACIÓN Y DIAGNÓSTICO DEL SISTEMA
                 =============================================================== */}
              {(activeTab === 'settings' || activeTab === 'diagnostic') && configStatus && (
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

                  <div className="diagnostic-card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h4 className="diag-title" style={{ margin: 0 }}>
                        2. Servidor de Correos Electrónicos (SMTP & Transaccional)
                      </h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className={`badge-${configStatus.mailer.isConfigured ? 'ok' : 'pending'}`}>
                          {configStatus.mailer.isConfigured
                            ? `✓ Conectado (${smtpSource === 'DATABASE' ? 'Neon DB' : 'Vercel Env'})`
                            : '⚪ Sin Configurar'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => setShowSmtpHelp(!showSmtpHelp)}
                          title="Ver ayuda paso a paso para configurar tu correo"
                        >
                          {showSmtpHelp ? 'Ocultar Guía' : '📖 Guía Paso a Paso'}
                        </button>
                      </div>
                    </div>

                    {showSmtpHelp && (
                      <div style={{ background: '#181818', border: '1px solid #333', borderRadius: '6px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.8rem', lineHeight: 1.6 }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: '#FF5A1F', fontSize: '0.85rem' }}>
                          💡 ¿Cómo configurar el envío de correos reales en 2 minutos?
                        </h5>
                        <p style={{ margin: '0 0 0.5rem 0' }}>
                          Tienes 3 opciones sencillas y gratuitas:
                        </p>
                        <ol style={{ paddingLeft: '1.2rem', margin: '0 0 0.75rem 0' }}>
                          <li style={{ marginBottom: '0.4rem' }}>
                            <strong>Opción A - Tu Gmail actual (Recomendada):</strong> Activa la verificación en 2 pasos en tu cuenta de Google &rarr; ve a <em>Seguridad &rarr; Contraseñas de aplicaciones</em> &rarr; genera una para &ldquo;Urban Style&rdquo; (16 letras) &rarr; pégala en el campo <strong>Contraseña</strong> abajo &rarr; haz clic en Guardar y Probar.
                          </li>
                          <li style={{ marginBottom: '0.4rem' }}>
                            <strong>Opción B - Resend (Alta entregabilidad):</strong> Crea una cuenta gratis en <code>resend.com</code> &rarr; obtén tu API Key (<code>re_...</code>) &rarr; selecciona la plantilla <em>Resend</em> abajo &rarr; pega tu API Key &rarr; Guardar y Probar.
                          </li>
                          <li style={{ marginBottom: '0.4rem' }}>
                            <strong>Opción C - Brevo / Sendinblue o tu propio hosting:</strong> Selecciona <em>Brevo</em> o <em>Personalizado</em> con tus datos SMTP corporativos.
                          </li>
                        </ol>
                        <p style={{ margin: 0, color: '#aaa', fontSize: '0.75rem' }}>
                          * Los datos guardados aquí se almacenan de forma segura en tu base de datos <strong>Neon PostgreSQL</strong> y son utilizados automáticamente por todas las funciones de Vercel en la nube.
                        </p>
                      </div>
                    )}

                    {/* SELECTOR DE PLANTILLAS PREDEFINIDAS */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#888', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                        SELECCIONA TU PROVEEDOR DE CORREO:
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`btn-preset ${smtpForm.provider === 'gmail' ? 'active' : ''}`}
                          onClick={() => handleSelectPreset('gmail')}
                        >
                          📧 Gmail (smtp.gmail.com)
                        </button>
                        <button
                          type="button"
                          className={`btn-preset ${smtpForm.provider === 'resend' ? 'active' : ''}`}
                          onClick={() => handleSelectPreset('resend')}
                        >
                          ⚡ Resend (smtp.resend.com)
                        </button>
                        <button
                          type="button"
                          className={`btn-preset ${smtpForm.provider === 'brevo' ? 'active' : ''}`}
                          onClick={() => handleSelectPreset('brevo')}
                        >
                          🚀 Brevo / Sendinblue
                        </button>
                        <button
                          type="button"
                          className={`btn-preset ${smtpForm.provider === 'outlook' ? 'active' : ''}`}
                          onClick={() => handleSelectPreset('outlook')}
                        >
                          💼 Outlook / Office 365
                        </button>
                        <button
                          type="button"
                          className={`btn-preset ${smtpForm.provider === 'custom' ? 'active' : ''}`}
                          onClick={() => handleSelectPreset('custom')}
                        >
                          🛠️ Servidor Personalizado
                        </button>
                      </div>
                    </div>

                    {/* FORMULARIO DE CONFIGURACIÓN SMTP */}
                    <form onSubmit={handleSaveSmtpConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: '#141414', padding: '1.25rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
                          Servidor SMTP (Host):
                        </label>
                        <input
                          type="text"
                          className="admin-input-dark"
                          value={smtpForm.host}
                          onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                          placeholder="smtp.gmail.com"
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
                            Puerto:
                          </label>
                          <input
                            type="number"
                            className="admin-input-dark"
                            value={smtpForm.port}
                            onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 465 })}
                            placeholder="465"
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.6rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#ccc', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={smtpForm.secure}
                              onChange={(e) => setSmtpForm({ ...smtpForm, secure: e.target.checked })}
                            />
                            SSL / TLS (465)
                          </label>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
                          Usuario o Correo Remitente:
                        </label>
                        <input
                          type="text"
                          className="admin-input-dark"
                          value={smtpForm.user}
                          onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                          placeholder="urbanstyle@gmail.com o resend"
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
                          Contraseña o Clave de App: {hasStoredSmtpPass && <span style={{ color: '#48bb78', fontWeight: 400 }}>(✓ Guardada)</span>}
                        </label>
                        <input
                          type="password"
                          className="admin-input-dark"
                          value={smtpForm.pass}
                          onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                          placeholder={hasStoredSmtpPass ? '•••••••••••• (dejar vacío para mantener)' : 'Clave de aplicación o SMTP'}
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.35rem', fontWeight: 600 }}>
                          Dirección Remitente Oficial (MAIL_FROM):
                        </label>
                        <input
                          type="text"
                          className="admin-input-dark"
                          value={smtpForm.mailFrom}
                          onChange={(e) => setSmtpForm({ ...smtpForm, mailFrom: e.target.value })}
                          placeholder='"URBAN STYLE" <pedidos@tudominio.com>'
                        />
                        <span style={{ fontSize: '0.7rem', color: '#777', display: 'block', marginTop: '0.25rem' }}>
                          * Si usas Gmail personal, ingresa tu correo exacto de Gmail (ej: &ldquo;URBAN STYLE&rdquo; &lt;micorreo@gmail.com&gt;).
                        </span>
                      </div>

                      {/* FEEDBACK DEL SERVIDOR */}
                      {smtpFeedback && (
                        <div style={{
                          gridColumn: '1 / -1',
                          padding: '0.75rem 1rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: smtpFeedback.type === 'success' ? 'rgba(72, 187, 120, 0.15)' : 'rgba(245, 101, 101, 0.15)',
                          border: `1px solid ${smtpFeedback.type === 'success' ? '#48bb78' : '#f56565'}`,
                          color: smtpFeedback.type === 'success' ? '#48bb78' : '#fc8181'
                        }}>
                          <span>{smtpFeedback.type === 'success' ? '✓' : '⚠️'}</span>
                          <span>{smtpFeedback.message}</span>
                        </div>
                      )}

                      {/* BOTONES DE ACCIÓN: GUARDAR Y PROBAR */}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                          type="submit"
                          className="btn-primary-action"
                          disabled={savingSmtp || testingSmtp}
                          style={{ minWidth: '180px' }}
                        >
                          {savingSmtp ? '⏳ Guardando en Neon...' : '💾 Guardar Configuración'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            type="email"
                            className="admin-input-dark"
                            style={{ width: '220px' }}
                            placeholder="correo-destino@ejemplo.com"
                            value={testEmailRecipient}
                            onChange={(e) => setTestEmailRecipient(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleTestSmtpConnection}
                            disabled={testingSmtp || savingSmtp}
                          >
                            {testingSmtp ? '⏳ Probando Enlace...' : '🧪 Probar y Enviar Correo'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="diagnostic-card">
                    <h4 className="diag-title">3. Base de Datos Transaccional y Nube</h4>
                    <div className="diag-details">
                      <p><strong>Motor Local:</strong> SQLite3 con WAL activado (ACID transactions)</p>
                      <p><strong>Motor Cloud:</strong> Neon PostgreSQL Serverless (Pooler US-East-2)</p>
                      <p><strong>Archivo SQLite:</strong> <code>{configStatus.database.file}</code></p>
                      <p><strong>Estado:</strong> <span className="badge-ok">Operacional con failover automático</span></p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* =====================================================================
           MODAL DETALLE DE ORDEN CON TRAZABILIDAD
           ===================================================================== */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h4 className="detail-sec-title" style={{ margin: 0 }}>Notificaciones por Correo Electrónico</h4>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => handleResendEmail(selectedOrder.order.order_number, 'placed')}
                        disabled={resendingEmail?.startsWith(selectedOrder.order.order_number)}
                      >
                        {resendingEmail === `${selectedOrder.order.order_number}-placed` ? '⏳ Enviando...' : '✉️ Reenviar Compra'}
                      </button>
                      {selectedOrder.shipment && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleResendEmail(selectedOrder.order.order_number, 'shipping')}
                          disabled={resendingEmail?.startsWith(selectedOrder.order.order_number)}
                        >
                          {resendingEmail === `${selectedOrder.order.order_number}-shipping` ? '⏳ Enviando...' : '🚚 Reenviar Guía'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => handleResendEmail(selectedOrder.order.order_number, 'ALL')}
                        disabled={resendingEmail?.startsWith(selectedOrder.order.order_number)}
                      >
                        {resendingEmail === `${selectedOrder.order.order_number}-ALL` ? '⏳ Enviando...' : '🔄 Reenviar Ambos'}
                      </button>
                    </div>
                  </div>

                  <p><strong>Destinatario Registrado:</strong> <code>{selectedOrder.order.customer_email}</code></p>

                  {(!selectedOrder.emails || selectedOrder.emails.length === 0) ? (
                    <p className="text-muted text-xs">No hay registros de envío para esta orden aún.</p>
                  ) : (
                    <div className="order-emails-log-list">
                      {selectedOrder.emails.map((em) => (
                        <div key={em.id} className="email-log-item-card">
                          <div className="email-log-item-header">
                            <span className="email-log-type-tag">
                              {em.email_type === 'ORDER_CONFIRMATION' ? '✉️ Confirmación de Pedido' : '🚚 Notificación de Guía'}
                            </span>
                            <span className={`email-badge ${em.status?.toLowerCase()}`}>
                              {em.status === 'ACCEPTED' ? 'Aceptado por Servidor SMTP' :
                               em.status === 'DELIVERED' ? 'Entregado al Destinatario' :
                               em.status === 'SENT' ? 'Enviado' :
                               em.status === 'PENDING_CONFIG' ? 'Pendiente Configuración SMTP' :
                               em.status === 'IDEMPOTENT_SKIPPED' ? 'Omitido (Duplicado)' : 'Fallido'}
                            </span>
                          </div>
                          <div className="email-log-item-meta text-xs">
                            <div><strong>Asunto:</strong> {em.subject}</div>
                            {em.message_id && <div><strong>Message-ID:</strong> <code>{em.message_id}</code></div>}
                            {em.provider_name && <div><strong>Proveedor:</strong> {em.provider_name}</div>}
                            {em.provider_response && <div><strong>Respuesta SMTP:</strong> <code>{em.provider_response}</code></div>}
                            <div><strong>Fecha/Hora:</strong> {new Date(em.sent_at || em.created_at).toLocaleString('es-CO')}</div>
                            {em.error_message && <div style={{ color: '#F56565' }}><strong>Detalle:</strong> {em.error_message}</div>}
                          </div>
                          <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <a
                              href={`/api/orders/${selectedOrder.order.order_number}/email-preview?type=${em.email_type === 'ORDER_CONFIRMATION' ? 'placed' : 'shipping'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-xs"
                            >
                              🔍 Ver Plantilla HTML
                            </a>
                            {em.preview_url && em.preview_url.startsWith('http') && (
                              <a
                                href={em.preview_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-xs"
                              >
                                🌐 Ver en Buzón SMTP Ethereal
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

        {/* =====================================================================
           MODAL CREAR / EDITAR ANUNCIO
           ===================================================================== */}
        {isAnnouncementModalOpen && (
          <div className="product-modal-backdrop" onClick={() => setIsAnnouncementModalOpen(false)}>
            <div className="product-modal-card announcement-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="product-modal-header">
                <div>
                  <span className="modal-badge-tag">Barra Superior</span>
                  <h3 className="modal-title-text">
                    {editingAnnouncement ? 'Editar Anuncio Promocional' : 'Nuevo Anuncio Promocional'}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAnnouncement} className="product-modal-body">
                {/* VISTA PREVIA EN VIVO */}
                <div className="announcement-live-preview-box">
                  <span className="preview-label">Vista previa en tiempo real:</span>
                  <div className="announcement-preview-bar">
                    <span className="announcement-bullet">🔥</span>
                    <span className="announcement-text">
                      {announcementForm.text || 'Texto del anuncio...'}
                    </span>
                    {announcementForm.link && (
                      <span className="announcement-cta">Ver más →</span>
                    )}
                  </div>
                </div>

                <div className="modal-field-group">
                  <label className="modal-field-label">Texto del Anuncio *</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Ej: ¡Envíos a todo Colombia!"
                    value={announcementForm.text}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, text: e.target.value })}
                    required
                  />
                  <small style={{ color: '#888', fontSize: '0.72rem' }}>
                    Recomendamos mensajes breves, directos y atractivos para una óptima lectura.
                  </small>
                </div>

                <div className="modal-field-group">
                  <label className="modal-field-label">Enlace de Destino (Opcional)</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Ej: #ofertas, #tenis, #hombre, #beneficios o URL completa"
                    value={announcementForm.link}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, link: e.target.value })}
                  />
                  <small style={{ color: '#888', fontSize: '0.72rem' }}>
                    Si defines un enlace, los usuarios podrán hacer clic en el anuncio para ir directamente a la sección.
                  </small>
                </div>

                <div className="product-form-grid">
                  <div className="modal-field-group">
                    <label className="modal-field-label">Fecha de Inicio (Opcional)</label>
                    <input
                      type="date"
                      className="modal-input"
                      value={announcementForm.start_date}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="modal-field-group">
                    <label className="modal-field-label">Fecha de Finalización (Opcional)</label>
                    <input
                      type="date"
                      className="modal-input"
                      value={announcementForm.end_date}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-field-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="ann-active-check"
                    checked={announcementForm.is_active}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="ann-active-check" style={{ color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                    Activar y mostrar inmediatamente en la tienda pública
                  </label>
                </div>

                <div className="product-modal-footer">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => setIsAnnouncementModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-modal-save"
                    disabled={isSubmittingAnnouncement}
                  >
                    {isSubmittingAnnouncement ? 'Guardando...' : editingAnnouncement ? 'Guardar Cambios' : 'Publicar Anuncio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================================
           MODAL DE CONFIRMACIÓN PARA ELIMINAR ANUNCIO
           ===================================================================== */}
        {announcementDeleteTarget && (
          <div className="product-modal-backdrop" onClick={() => setAnnouncementDeleteTarget(null)}>
            <div className="product-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <div className="product-modal-header">
                <div>
                  <span className="modal-badge-tag text-danger">Eliminación</span>
                  <h3 className="modal-title-text">¿Eliminar este anuncio?</h3>
                </div>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setAnnouncementDeleteTarget(null)}
                >
                  ✕
                </button>
              </div>
              <div className="product-modal-body" style={{ gap: '0.75rem' }}>
                <p style={{ color: '#ccc', fontSize: '0.88rem', margin: 0, lineHeight: 1.4 }}>
                  Estás a punto de eliminar permanentemente el anuncio:
                </p>
                <div style={{ background: '#1c1c1c', padding: '0.85rem', borderRadius: '6px', borderLeft: '3px solid #ff4d4f' }}>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>«{announcementDeleteTarget.text}»</strong>
                </div>
                <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>
                  Esta acción no se puede deshacer y el anuncio dejará de rotar en la tienda.
                </p>
              </div>
              <div className="product-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setAnnouncementDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-confirm-delete"
                  onClick={handleConfirmDeleteAnnouncement}
                >
                  Eliminar Anuncio
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
