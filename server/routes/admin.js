import express from 'express';
import { db } from '../db/database.js';
import {
  retryOrderEmail,
  getStoredSmtpSettings,
  saveStoredSmtpSettings,
  testSmtpConnection,
  getTransporterInfo
} from '../services/mailer.js';
import {
  getAdminStatsData,
  getAdminOrdersList,
  getAdminOrderDetails,
  updateOrderStatus,
  getAdminEmailLogs,
  getAdminShipmentsList
} from '../services/orderService.js';
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
  deleteProduct,
  updateProductDiscount,
  toggleProductDiscount,
  parseCOP
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
import {
  getAllAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  setBarEnabled,
  setRotationInterval,
  reorderAnnouncements
} from '../services/announcementService.js';

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
 * Resumen de métricas comerciales y logísticas desde Neon PostgreSQL
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getAdminStatsData();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/orders
 * Listado de pedidos con filtros desde Neon PostgreSQL
 */
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    const orders = await getAdminOrdersList({ status, search });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/orders/:orderNumber
 * Consulta detallada de una orden con trazabilidad completa desde Neon PostgreSQL
 */
router.get('/orders/:orderNumber', requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const details = await getAdminOrderDetails(orderNumber);

    if (!details || !details.order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    res.json({
      success: true,
      order: details.order,
      items: details.items || [],
      shipment: details.shipment || null,
      history: details.history || [],
      payments: details.payments || [],
      emails: details.emails || []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/orders/:orderNumber/status
 * Actualiza el estado de una orden con trazabilidad en Neon PostgreSQL y SQLite
 */
router.patch('/orders/:orderNumber/status', requireAdmin, async (req, res) => {
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

    const details = await getAdminOrderDetails(orderNumber);
    if (!details || !details.order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const adminUser = req.adminUser?.username || 'ADMIN';
    await updateOrderStatus(orderNumber, newStatus, comment, adminUser);

    res.json({
      success: true,
      message: `Estado del pedido #${orderNumber} actualizado a ${newStatus}.`,
      previousStatus: details.order.status,
      newStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/orders/:orderNumber/resend-email
 * Reintento manual de envío de notificación por correo (Compra o Guía)
 */
router.post('/orders/:orderNumber/resend-email', requireAdmin, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const details = await getAdminOrderDetails(orderNumber);
    if (!details || !details.order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: `El pedido #${orderNumber} no fue encontrado en la base de datos.`
      });
    }

    const emailType = req.body?.emailType || 'ALL';

    // Validación preventiva: Si se pide reenviar la guía de envío, verificar que exista guía
    if ((emailType === 'shipping' || emailType === 'SHIPPING_NOTIFICATION') && (!details.shipment || !details.shipment.guide_number)) {
      return res.status(400).json({
        success: false,
        code: 'NO_SHIPMENT',
        message: `El pedido #${orderNumber} no tiene una guía de transporte asociada todavía. Genere el despacho primero antes de reenviarla al cliente.`
      });
    }

    // Pasar objeto de detalle completo para evitar desfase de IDs entre Neon y SQLite
    const result = await retryOrderEmail({
      order: details.order,
      shipment: details.shipment,
      items: details.items,
      emailType,
      force: true
    });

    // Validar si el proveedor SMTP falló o no está configurado
    const failedResults = (result.results || []).filter((r) => r && !r.success);
    if (failedResults.length > 0 && failedResults.length === (result.results || []).length) {
      const failure = failedResults[0];
      if (failure?.status === 'PENDING_CONFIG') {
        return res.status(422).json({
          success: false,
          code: 'SMTP_NOT_CONFIGURED',
          message: 'No se puede enviar el correo a la bandeja del cliente: El servidor SMTP no tiene credenciales configuradas en Vercel ni en Ajustes. Configure sus credenciales en la pestaña «Configuración» para enviar correos reales.',
          result
        });
      }
      return res.status(502).json({
        success: false,
        code: 'SMTP_FAILURE',
        message: failure?.error || 'El servidor SMTP no pudo entregar el correo.',
        result
      });
    }

    const typeDesc = emailType === 'placed'
      ? 'de confirmación de compra'
      : emailType === 'shipping'
      ? `con guía de transporte (${details.shipment?.guide_number})`
      : 'completa (compra y guía)';

    res.json({
      success: true,
      code: 'EMAIL_RESENT',
      message: `Notificación ${typeDesc} enviada exitosamente a ${details.order.customer_email}.`,
      result
    });
  } catch (error) {
    console.error('[Admin Resend Email Error]', error);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: error.message || 'Error interno al procesar el reenvío de correo.'
    });
  }
});

/**
 * GET /api/admin/emails
 * Consulta de registros de correos y fallos desde Neon PostgreSQL
 */
router.get('/emails', requireAdmin, async (req, res) => {
  try {
    const logs = await getAdminEmailLogs(50);
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
 * Listado de todos los despachos y guías generadas desde Neon PostgreSQL
 */
router.get('/shipments', requireAdmin, async (req, res) => {
  try {
    const shipments = await getAdminShipmentsList();
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
 * GET /api/admin/smtp-config
 * Consulta la configuración SMTP guardada (sin exponer contraseñas en claro)
 */
router.get('/smtp-config', requireAdmin, async (req, res) => {
  try {
    const stored = await getStoredSmtpSettings();
    const envHost = process.env.SMTP_HOST;
    const envUser = process.env.SMTP_USER;
    const hasEnvPass = !!process.env.SMTP_PASS;
    const hasEnvResend = !!process.env.RESEND_API_KEY;

    res.json({
      success: true,
      config: {
        provider: stored.smtp_provider || (envHost?.includes('gmail') ? 'gmail' : envHost ? 'custom' : hasEnvResend ? 'resend' : 'pending'),
        host: envHost || stored.smtp_host || '',
        port: Number(process.env.SMTP_PORT || stored.smtp_port) || 587,
        secure: (process.env.SMTP_SECURE === 'true' || stored.smtp_secure === 'true'),
        user: envUser || stored.smtp_user || '',
        hasPassword: hasEnvPass || !!stored.smtp_pass,
        mailFrom: process.env.MAIL_FROM || stored.mail_from || '',
        hasResendKey: hasEnvResend || !!stored.resend_api_key,
        source: (envHost || hasEnvResend) ? 'ENVIRONMENT_VARIABLES' : stored.smtp_host ? 'DATABASE_STORE' : 'NONE'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/smtp-config
 * Guarda la configuración SMTP en Neon PostgreSQL y SQLite (store_settings)
 */
router.post('/smtp-config', requireAdmin, async (req, res) => {
  try {
    const { provider, host, port, secure, user, pass, mailFrom, resendKey } = req.body;

    const updated = await saveStoredSmtpSettings({
      smtp_provider: provider,
      smtp_host: host,
      smtp_port: port,
      smtp_secure: secure ? 'true' : 'false',
      smtp_user: user,
      smtp_pass: pass,
      mail_from: mailFrom,
      resend_api_key: resendKey
    });

    res.json({
      success: true,
      message: 'Configuración de servidor SMTP guardada exitosamente en Neon PostgreSQL y SQLite.',
      config: {
        host: updated.smtp_host,
        port: updated.smtp_port,
        user: updated.smtp_user,
        hasPassword: !!updated.smtp_pass,
        mailFrom: updated.mail_from
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/smtp-test
 * Prueba la conexión SMTP en vivo y opcionalmente envía un correo de prueba real
 */
router.post('/smtp-test', requireAdmin, async (req, res) => {
  try {
    const { toEmail, host, port, secure, user, pass, mailFrom, resendKey } = req.body;

    // Si no se enviaron datos en el body, usar los configurados
    let testHost = host;
    let testPort = port;
    let testSecure = secure;
    let testUser = user;
    let testPass = pass;
    let testFrom = mailFrom;
    let testResendKey = resendKey;

    if (!testHost && !testResendKey) {
      const stored = await getStoredSmtpSettings();
      testHost = process.env.SMTP_HOST || stored.smtp_host;
      testPort = process.env.SMTP_PORT || stored.smtp_port || 587;
      testSecure = process.env.SMTP_SECURE === 'true' || stored.smtp_secure === 'true';
      testUser = process.env.SMTP_USER || stored.smtp_user;
      testPass = process.env.SMTP_PASS || stored.smtp_pass;
      testFrom = process.env.MAIL_FROM || stored.mail_from;
      testResendKey = process.env.RESEND_API_KEY || stored.resend_api_key;
    }

    const testResult = await testSmtpConnection({
      host: testHost,
      port: testPort,
      secure: testSecure,
      user: testUser,
      pass: testPass,
      mailFrom: testFrom,
      toEmail,
      resendKey: testResendKey
    });

    res.json({
      success: true,
      message: testResult.message,
      result: testResult
    });
  } catch (error) {
    console.error('[Admin SMTP Test Error]', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Fallo al conectar con el servidor SMTP.',
      code: error.code || 'SMTP_TEST_FAILED'
    });
  }
});

/**
 * GET /api/admin/config-status
 * Diagnóstico de servicios externos sin exponer claves
 */
router.get('/config-status', requireAdmin, async (req, res) => {
  const mailerInfo = await getTransporterInfo();

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
        provider: mailerInfo.providerName,
        isConfigured: mailerInfo.isConfigured,
        activeMode: mailerInfo.mode,
        fromAddress: mailerInfo.fromAddress,
        host: mailerInfo.host,
        port: mailerInfo.port,
        secure: mailerInfo.secure || false,
        requiredVercelVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'MAIL_FROM']
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
    const { search, category, status, discount_status } = req.query;
    const products = await getAdminProducts({ search, category, status, discount_status });
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
    const { name, brand, model, department, category, price, description, sizes, composition, color, stock, is_active } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'El nombre del producto debe tener al menos 3 caracteres.' });
    }

    if (!category || typeof category !== 'string' || category.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'La categoría es obligatoria.' });
    }

    const numPrice = parseCOP(price);
    if (isNaN(numPrice) || numPrice < 1000) {
      return res.status(400).json({ success: false, message: 'El precio debe ser un número válido mayor o igual a $1.000 COP.' });
    }

    const numStock = stock !== undefined ? (typeof stock === 'string' ? parseCOP(stock) : Number(stock)) : 50;
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ success: false, message: 'El inventario debe ser un número entero mayor o igual a cero.' });
    }

    if (!color || typeof color !== 'string' || color.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'El color principal es obligatorio.' });
    }

    const newProduct = await createProduct({
      name,
      brand: brand || 'URBAN STYLE',
      model: model || '',
      department: department || '',
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
      const numPrice = parseCOP(price);
      if (isNaN(numPrice) || numPrice < 1000) {
        return res.status(400).json({ success: false, message: 'El precio debe ser mayor o igual a $1.000 COP.' });
      }
    }

    if (stock !== undefined) {
      const numStock = typeof stock === 'string' ? parseCOP(stock) : Number(stock);
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
 * PUT /api/admin/products/:id/discount
 * Configura o modifica la promoción, porcentaje y fechas del producto
 */
router.put('/products/:id/discount', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { price, discount_active, discount_percent, discount_start_at, discount_end_at } = req.body;

    const updated = await updateProductDiscount(id, {
      price,
      discount_active,
      discount_percent,
      discount_start_at,
      discount_end_at
    });

    res.json({
      success: true,
      message: 'Configuración de descuento y precios actualizada exitosamente.',
      product: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/products/:id/discount/status
 * Activa o desactiva rápidamente el descuento de un producto
 */
router.patch('/products/:id/discount/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { discount_active } = req.body;

    if (discount_active === undefined) {
      return res.status(400).json({ success: false, message: 'El campo discount_active es requerido.' });
    }

    const updated = await toggleProductDiscount(id, discount_active);
    res.json({
      success: true,
      message: `Descuento ${updated.discountActive ? 'activado' : 'desactivado'} para el producto.`,
      product: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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

/* ==========================================================================
   RUTAS DE GESTIÓN DE BARRA DE ANUNCIOS Y MENSAJES PROMOCIONALES
   ========================================================================== */

/**
 * GET /api/admin/announcements
 * Obtiene todos los anuncios y la configuración general de la barra
 */
router.get('/announcements', requireAdmin, async (req, res) => {
  try {
    const data = await getAllAdminAnnouncements();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/announcements
 * Crea un nuevo anuncio promocional
 */
router.post('/announcements', requireAdmin, async (req, res) => {
  try {
    const created = await createAnnouncement(req.body);
    res.status(201).json({
      success: true,
      message: 'Anuncio creado correctamente',
      data: created
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/announcements/:id
 * Actualiza un anuncio promocional existente
 */
router.put('/announcements/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await updateAnnouncement(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Anuncio actualizado correctamente',
      data: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * Elimina un anuncio promocional
 */
router.delete('/announcements/:id', requireAdmin, async (req, res) => {
  try {
    await deleteAnnouncement(req.params.id);
    res.json({
      success: true,
      message: 'Anuncio eliminado correctamente',
      deletedId: req.params.id
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/announcements/toggle-bar
 * Activa o desactiva la barra de anuncios completa en la tienda
 */
router.post('/announcements/toggle-bar', requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    const result = await setBarEnabled(enabled);
    res.json({
      success: true,
      message: enabled ? 'Barra de anuncios activada en la tienda' : 'Barra de anuncios desactivada',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/announcements/rotation-interval
 * Configura la velocidad de rotación de anuncios en segundos
 */
router.post('/announcements/rotation-interval', requireAdmin, async (req, res) => {
  try {
    const { rotationSeconds } = req.body;
    const result = await setRotationInterval(rotationSeconds);
    res.json({
      success: true,
      message: `Intervalo de rotación establecido en ${result.rotationSeconds} segundos`,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/announcements/reorder
 * Reordena la lista de anuncios según los IDs enviados
 */
router.post('/announcements/reorder', requireAdmin, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    await reorderAnnouncements(orderedIds);
    res.json({
      success: true,
      message: 'Orden de anuncios actualizado exitosamente'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
