import express from 'express';
import crypto from 'crypto';
import { db, verifyPassword } from '../db/database.js';
import { retryOrderEmail } from '../services/mailer.js';

const router = express.Router();

// Almacén de sesiones activas en memoria con tiempo de expiración
const activeSessions = new Map();

/**
 * Middleware para proteger rutas administrativas
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado. Se requiere token de administrador.'
    });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return res.status(401).json({
      success: false,
      message: 'Sesión administrativa expirada o inválida. Inicia sesión nuevamente.'
    });
  }

  // Renovar sesión activa
  session.expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 horas
  req.adminUser = session.user;
  next();
}

/**
 * POST /api/admin/login
 * Autenticación segura de administrador
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son requeridos.'
      });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username.trim());
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales de acceso incorrectas.'
      });
    }

    const isValid = verifyPassword(password, admin.password_hash, admin.salt);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales de acceso incorrectas.'
      });
    }

    // Generar token de sesión seguro
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      user: { id: admin.id, username: admin.username, role: admin.role },
      expiresAt: Date.now() + 4 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Autenticación exitosa',
      token,
      user: {
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Resumen de métricas comerciales y logísticas
 */
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT count(*) as count FROM orders').get().count;
    const revenue = db.prepare("SELECT coalesce(sum(total), 0) as total FROM orders WHERE status != 'CANCELLED'").get().total;
    const pendingOrders = db.prepare("SELECT count(*) as count FROM orders WHERE status IN ('PENDING_PAYMENT', 'PROCESSING')").get().count;
    const shippedOrders = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'SHIPPED'").get().count;
    const totalItems = db.prepare('SELECT coalesce(sum(quantity), 0) as count FROM order_items').get().count;
    const emailLogsCount = db.prepare('SELECT count(*) as count FROM email_logs').get().count;

    res.json({
      success: true,
      stats: {
        totalOrders,
        revenue,
        formattedRevenue: `$${revenue.toLocaleString('es-CO')} COP`,
        pendingOrders,
        shippedOrders,
        totalItems,
        emailLogsCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/orders
 * Listado de pedidos con filtros
 */
router.get('/orders', requireAdmin, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT o.*, s.guide_number, s.carrier_name, s.tracking_status, s.pdf_guide_url
      FROM orders o
      LEFT JOIN shipments s ON o.id = s.order_id
    `;
    const params = [];

    const conditions = [];
    if (status && status !== 'ALL') {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR s.guide_number LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY o.id DESC';

    const orders = db.prepare(query).all(...params);

    // Adjuntar items a cada orden
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enriched = orders.map((ord) => ({
      ...ord,
      items: getItems.all(ord.id)
    }));

    res.json({
      success: true,
      count: enriched.length,
      orders: enriched
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/orders/:orderNumber
 * Consulta detallada de una orden con trazabilidad completa
 */
router.get('/orders/:orderNumber', requireAdmin, (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(order.id);
    const payments = db.prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY id ASC').all(order.id);
    const emails = db.prepare('SELECT * FROM email_logs WHERE order_id = ? ORDER BY id DESC').all(order.id);

    res.json({
      success: true,
      order,
      items,
      shipment,
      history,
      payments,
      emails
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/orders/:orderNumber/status
 * Actualiza el estado de una orden con trazabilidad en SQLite
 */
router.patch('/orders/:orderNumber/status', requireAdmin, (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { newStatus, comment } = req.body;

    const validStatuses = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Estado no válido. Opciones permitidas: ${validStatuses.join(', ')}`
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const now = new Date().toISOString();
    const adminUser = req.adminUser?.username || 'ADMIN';

    const updateTx = db.transaction(() => {
      // 1. Actualizar estado de la orden
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, order.id);

      // 2. Registrar en historial
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(order.id, order.status, newStatus, comment || `Estado cambiado a ${newStatus} por ${adminUser}`, adminUser, now);

      // 3. Si se marca como SHIPPED, actualizar tracking del despacho
      if (newStatus === 'SHIPPED') {
        db.prepare('UPDATE shipments SET tracking_status = ?, updated_at = ? WHERE order_id = ?')
          .run('Despachado y en tránsito con transportadora', now, order.id);
      } else if (newStatus === 'CANCELLED') {
        db.prepare('UPDATE shipments SET tracking_status = ?, updated_at = ? WHERE order_id = ?')
          .run('Envío cancelado', now, order.id);
      }
    });

    updateTx();

    res.json({
      success: true,
      message: `Estado del pedido #${orderNumber} actualizado a ${newStatus}.`,
      previousStatus: order.status,
      newStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/orders/:orderNumber/resend-email
 * Reintento manual de envío de notificación por correo
 */
router.post('/orders/:orderNumber/resend-email', requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const result = await retryOrderEmail(order.id);

    res.json({
      success: true,
      message: 'Reintento de envío de correo procesado.',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/emails
 * Consulta de registros de correos y fallos
 */
router.get('/emails', requireAdmin, (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT 50').all();
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/shipments
 * Listado de todos los despachos y guías generadas
 */
router.get('/shipments', requireAdmin, (req, res) => {
  try {
    const shipments = db.prepare(`
      SELECT s.*, o.order_number, o.customer_name, o.customer_email, o.delivery_city, o.delivery_department, o.total, o.payment_method
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      ORDER BY s.id DESC
    `).all();

    res.json({
      success: true,
      count: shipments.length,
      shipments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/config-status
 * Diagnóstico de servicios externos sin exponer claves
 */
router.get('/config-status', requireAdmin, (req, res) => {
  res.json({
    success: true,
    services: {
      mipaquete: {
        provider: 'Mi Paquete v2 (Colombia)',
        baseUrl: process.env.MIPAQUETE_BASE_URL || 'https://api-v2.dev.mpr.mipaquete.com',
        apiKeyConfigured: !!(process.env.MIPAQUETE_APIKEY && process.env.MIPAQUETE_APIKEY.trim().length > 10),
        sessionTrackerConfigured: !!(process.env.MIPAQUETE_SESSION_TRACKER),
        originDaneCode: process.env.ORIGIN_DANE_CODE || '11001000',
        originCity: process.env.ORIGIN_CITY || 'BOGOTÁ D.C.'
      },
      mailer: {
        provider: 'Nodemailer SMTP',
        smtpHostConfigured: !!process.env.SMTP_HOST,
        smtpUserConfigured: !!process.env.SMTP_USER,
        fromAddress: process.env.MAIL_FROM || 'despachos@urbanstyle.com.co',
        fallbackMode: 'Local HTML Log en server/logs/emails/'
      },
      database: {
        engine: 'SQLite3',
        file: 'server/data/urban_style.db',
        status: 'Operational'
      }
    }
  });
});

export default router;
