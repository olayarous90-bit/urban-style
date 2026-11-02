import express from 'express';
import { db } from '../db/database.js';
import { retryOrderEmail } from '../services/mailer.js';
import {
  verifyPassword,
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
  validateLoginInput,
  checkRateLimit,
  recordFailedAttempt,
  resetFailedAttempts
} from '../auth/security.js';
import {
  findAdminByUsername,
  createAdminSession,
  getAdminSession,
  revokeAdminSession,
  logLoginAttempt
} from '../services/adminAuthService.js';
import {
  getAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct
} from '../services/productService.js';
import {
  uploadProductImage,
  getProductImages,
  setPrimaryImage,
  reorderProductImages,
  deleteProductImage,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES
} from '../services/imageStorageService.js';

const router = express.Router();

/**
 * Middleware para proteger rutas administrativas
 * Admite autenticación por Cookie HttpOnly (principal) o Cabecera Bearer (API clients)
 */
export async function requireAdmin(req, res, next) {
  try {
    // 1. Obtener token desde Cookie HttpOnly o Cabecera Authorization
    let token = req.cookies?.[ADMIN_COOKIE_NAME];
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Acceso no autorizado. Se requiere sesión de administrador.'
      });
    }

    // 2. Validar sesión en base de datos (Neon PostgreSQL / fallback local)
    const session = await getAdminSession(token);
    if (!session) {
      // Limpiar cookie huérfana si existía
      if (req.cookies?.[ADMIN_COOKIE_NAME]) {
        res.clearCookie(ADMIN_COOKIE_NAME, { ...getAdminCookieOptions(), maxAge: 0 });
      }
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'Sesión administrativa expirada o inválida. Inicia sesión nuevamente.'
      });
    }

    req.adminUser = session.user;
    req.sessionToken = token;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verificando autenticación de administrador.'
    });
  }
}

/**
 * POST /api/admin/login
 * Autenticación robusta con rate-limiting, PBKDF2 y Cookie HttpOnly
 */
router.post('/login', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // 1. Validar formato de datos de entrada
    const validation = validateLoginInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const { cleanUsername, password } = validation;

    // 2. Control de Fuerza Bruta / Rate Limiting
    const rateCheck = checkRateLimit(clientIp, cleanUsername);
    if (!rateCheck.allowed) {
      await logLoginAttempt({ ipAddress: clientIp, username: cleanUsername, success: false });
      return res.status(429).json({
        success: false,
        locked: true,
        remainingSeconds: rateCheck.remainingSeconds,
        message: rateCheck.message
      });
    }

    // 3. Buscar usuario en base de datos
    const admin = await findAdminByUsername(cleanUsername);
    if (!admin) {
      const attempt = recordFailedAttempt(clientIp, cleanUsername);
      await logLoginAttempt({ ipAddress: clientIp, username: cleanUsername, success: false });

      // Demora deliberada para frustrar escaneos automáticos de tiempo
      await new Promise((r) => setTimeout(r, 600));

      return res.status(401).json({
        success: false,
        message: 'Credenciales de acceso incorrectas.',
        remainingAttempts: attempt.remainingAttempts
      });
    }

    // 4. Verificar contraseña con hash seguro PBKDF2 y tiempo constante
    const isValid = verifyPassword(password, admin.password_hash, admin.salt);
    if (!isValid) {
      const attempt = recordFailedAttempt(clientIp, cleanUsername);
      await logLoginAttempt({ ipAddress: clientIp, username: cleanUsername, success: false });

      // Demora deliberada
      await new Promise((r) => setTimeout(r, 600));

      return res.status(401).json({
        success: false,
        message: 'Credenciales de acceso incorrectas.',
        remainingAttempts: attempt.remainingAttempts
      });
    }

    // 5. Credenciales correctas: resetear contador de intentos
    resetFailedAttempts(clientIp, cleanUsername);
    await logLoginAttempt({ ipAddress: clientIp, username: cleanUsername, success: true });

    // 6. Crear sesión en base de datos
    const session = await createAdminSession({
      userId: admin.id,
      username: admin.username,
      role: admin.role,
      ipAddress: clientIp,
      userAgent
    });

    // 7. Establecer Cookie de sesión HttpOnly segura
    const cookieOptions = getAdminCookieOptions();
    res.cookie(ADMIN_COOKIE_NAME, session.sessionToken, cookieOptions);

    res.json({
      success: true,
      message: 'Autenticación exitosa',
      token: session.sessionToken, // Se devuelve para compatibilidad
      user: {
        username: admin.username,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('[Admin Login Error]', error);
    res.status(500).json({ success: false, message: 'Error interno en el proceso de autenticación.' });
  }
});

/**
 * POST /api/admin/logout
 * Cierre de sesión seguro: revoca sesión en BD y destruye la cookie
 */
router.post('/logout', async (req, res) => {
  try {
    let token = req.cookies?.[ADMIN_COOKIE_NAME];
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      await revokeAdminSession(token);
    }

    res.clearCookie(ADMIN_COOKIE_NAME, { ...getAdminCookieOptions(), maxAge: 0 });

    res.json({
      success: true,
      message: 'Sesión administrativa cerrada correctamente.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cerrando sesión.' });
  }
});

/**
 * GET /api/admin/me
 * Consulta el estado de autenticación de la sesión activa
 */
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.adminUser
  });
});

/**
 * POST /api/admin/register
 * Bloqueo explícito de registro público
 */
router.post('/register', (req, res) => {
  res.status(403).json({
    success: false,
    message: 'El registro público de administradores está deshabilitado por política de seguridad.'
  });
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
        engine: 'Neon PostgreSQL (Primary) / SQLite3 (Fallback)',
        file: 'server/data/urban_style.db',
        status: 'Operational'
      }
    }
  });
});

/**
 * ========================================================
 * GESTIÓN DE PRODUCTOS DEL CATÁLOGO E INVENTARIO (ADMIN)
 * ========================================================
 */

/**
 * GET /api/admin/products
 * Listado de productos con filtros de búsqueda, categoría y estado
 */
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const products = await getAdminProducts({ search, category, status });
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/products/:id
 * Consulta de producto individual para edición
 */
router.get('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/products
 * Creación de nuevo producto en Neon PostgreSQL con validación estricta
 */
router.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, category, price, description, sizes, composition, color, stock, is_active } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'El nombre del producto debe tener al menos 3 caracteres.' });
    }

    if (!category || typeof category !== 'string' || category.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'La categoría es obligatoria.' });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 1000) {
      return res.status(400).json({ success: false, message: 'El precio debe ser un número válido mayor o igual a $1.000 COP.' });
    }

    const numStock = stock !== undefined ? Number(stock) : 50;
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ success: false, message: 'El inventario debe ser un número entero mayor o igual a cero.' });
    }

    if (!color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'El color principal es obligatorio.' });
    }

    const newProduct = await createProduct({
      name,
      category,
      price: numPrice,
      description: description || '',
      sizes: sizes || ['S', 'M', 'L', 'XL'],
      composition: composition || '100% Algodón Premium',
      color,
      stock: numStock,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente en el catálogo oficial.',
      product: newProduct
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/products/:id
 * Edición de producto existente en Neon PostgreSQL
 */
router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description, sizes, composition, color, stock, is_active } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 3)) {
      return res.status(400).json({ success: false, message: 'El nombre debe tener al menos 3 caracteres.' });
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 1000) {
        return res.status(400).json({ success: false, message: 'El precio debe ser mayor o igual a $1.000 COP.' });
      }
    }

    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ success: false, message: 'El inventario no puede ser negativo.' });
      }
    }

    const updated = await updateProduct(id, req.body);
    res.json({
      success: true,
      message: 'Producto actualizado exitosamente.',
      product: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/products/:id/status
 * Activa o desactiva un producto del catálogo
 */
router.patch('/products/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({ success: false, message: 'El campo is_active es requerido.' });
    }

    const result = await toggleProductStatus(id, is_active);
    res.json({
      success: true,
      message: `Producto ${result.is_active ? 'activado' : 'desactivado'} para la tienda pública.`,
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Eliminación protegida (desactiva si tiene órdenes, elimina físicamente si no)
 */
router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteProduct(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * ========================================================
 * GESTIÓN DE IMÁGENES DE PRODUCTOS (NEON S3 / OBJECT STORAGE)
 * ========================================================
 */

function parseBase64Image(dataString, declaredMime) {
  let mimeType = declaredMime || 'image/jpeg';
  let base64Data = dataString;

  if (typeof dataString === 'string' && dataString.startsWith('data:')) {
    const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }
  }

  const buffer = Buffer.from(base64Data, 'base64');
  return { buffer, mimeType };
}

/**
 * GET /api/admin/products/:id/images
 * Consulta la galería de imágenes del producto
 */
router.get('/products/:id/images', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    const images = await getProductImages(id);
    res.json({
      success: true,
      productId: id,
      count: images.length,
      images
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/products/:id/images
 * Sube una o varias imágenes a Neon Object Storage y las vincula al producto
 */
router.post('/products/:id/images', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    // Acepta { images: [...] } o payload individual { image, ... }
    const items = Array.isArray(req.body.images) ? req.body.images : [req.body];

    if (items.length === 0 || !items[0].image && !items[0].data) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron datos de imagen válidos.'
      });
    }

    const uploaded = [];

    for (const item of items) {
      const rawData = item.image || item.data;
      if (!rawData) continue;

      const { buffer, mimeType } = parseBase64Image(rawData, item.mimeType);

      // Validar tipo y tamaño
      if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `El archivo ${item.originalName || 'subido'} tiene formato no permitido (${mimeType}). Formatos aceptados: JPEG, PNG, WebP, AVIF, GIF.`
        });
      }

      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        return res.status(400).json({
          success: false,
          message: `El archivo ${item.originalName || 'subido'} supera el límite máximo de 5 MB.`
        });
      }

      const imgRecord = await uploadProductImage({
        productId: id,
        buffer,
        originalName: item.originalName || `${product.name}-image`,
        mimeType,
        isPrimary: Boolean(item.isPrimary),
        altText: item.altText || product.name
      });

      uploaded.push(imgRecord);
    }

    const allImages = await getProductImages(id);

    res.status(201).json({
      success: true,
      message: `${uploaded.length} imagen(es) subida(s) y almacenada(s) en Neon exitosamente.`,
      uploaded,
      images: allImages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/products/:id/images/:imageId/primary
 * Establece una imagen como la principal del producto
 */
router.put('/products/:id/images/:imageId/primary', requireAdmin, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const result = await setPrimaryImage(id, imageId);
    const images = await getProductImages(id);

    res.json({
      success: true,
      message: 'Imagen principal actualizada exitosamente.',
      result,
      images
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/products/:id/images/reorder
 * Reordena la galería de imágenes del producto
 */
router.put('/products/:id/images/reorder', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderedImageIds } = req.body;

    if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un arreglo orderedImageIds con los identificadores en su nuevo orden.'
      });
    }

    const result = await reorderProductImages(id, orderedImageIds);
    const images = await getProductImages(id);

    res.json({
      success: true,
      message: result.message,
      images
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/products/:id/images/:imageId
 * Elimina una imagen del almacenamiento S3 y de Neon
 */
router.delete('/products/:id/images/:imageId', requireAdmin, async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const result = await deleteProductImage(id, imageId);
    const images = await getProductImages(id);

    res.json({
      success: true,
      message: result.message,
      deletedId: imageId,
      images
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
