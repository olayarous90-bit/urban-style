import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from '../db/neon.js';
import { db } from '../db/database.js';
import { renderPrintableGuideHtml } from './guideGenerator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio para respaldar los correos generados
const EMAIL_LOGS_DIR = process.env.VERCEL
  ? '/tmp/emails'
  : path.resolve(__dirname, '../../server/logs/emails');

if (!fs.existsSync(EMAIL_LOGS_DIR)) {
  fs.mkdirSync(EMAIL_LOGS_DIR, { recursive: true });
}

// Cuenta de pruebas Ethereal en caché para no recrearla en cada llamada
let cachedEtherealAccount = null;

/**
 * Obtiene el transportador configurado con detección inteligente de proveedor
 */
export async function getTransporterInfo() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  // 1. Configuración SMTP explícita (Producción o staging)
  if (host && user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });

    return {
      transporter,
      providerName: `SMTP (${host})`,
      mode: 'PRODUCTION_SMTP',
      isLive: true
    };
  }

  // 2. Soporte nativo para Resend SMTP vía RESEND_API_KEY
  if (process.env.RESEND_API_KEY) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
      },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });

    return {
      transporter,
      providerName: 'Resend SMTP (smtp.resend.com)',
      mode: 'RESEND_SMTP',
      isLive: true
    };
  }

  // 3. Si estamos en producción estricta en Vercel y no hay credenciales
  if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && !process.env.ENABLE_ETHEREAL_TEST) {
    return {
      transporter: null,
      providerName: 'Pendiente de Configuración en Vercel',
      mode: 'UNCONFIGURED_PRODUCTION',
      isLive: false,
      reason: 'Variables SMTP_HOST, SMTP_USER y SMTP_PASS no definidas en el panel de Vercel.'
    };
  }

  // 4. Modo Desarrollo / Pruebas Controladas: Ethereal SMTP (Servidor SMTP real con buzón web)
  try {
    if (!cachedEtherealAccount) {
      cachedEtherealAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de 5s creando cuenta de prueba Ethereal')), 5000))
      ]);
      console.log(`[Mailer] Buzón de pruebas Ethereal inicializado: ${cachedEtherealAccount.user}`);
    }

    const transporter = nodemailer.createTransport({
      host: cachedEtherealAccount.smtp.host,
      port: cachedEtherealAccount.smtp.port,
      secure: cachedEtherealAccount.smtp.secure,
      auth: {
        user: cachedEtherealAccount.user,
        pass: cachedEtherealAccount.pass
      },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });

    return {
      transporter,
      providerName: `Ethereal Test SMTP (${cachedEtherealAccount.smtp.host})`,
      mode: 'ETHEREAL_TEST',
      isLive: true,
      testUser: cachedEtherealAccount.user
    };
  } catch (err) {
    console.warn('[Mailer Ethereal Warning] No se pudo crear cuenta de prueba Ethereal:', err.message);
    return {
      transporter: null,
      providerName: 'Local Fallback (HTML Logs & Previews)',
      mode: 'LOCAL_FALLBACK',
      isLive: false,
      reason: err.message
    };
  }
}

/**
 * Función compatible síncrona/rápida para retrocompatibilidad
 */
export function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }
  return null;
}

/**
 * Protección de idempotencia: verifica si un correo idéntico fue aceptado recientemente
 */
export async function wasEmailRecentlySent(orderId, orderNumber, emailType, windowSeconds = 120) {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // 1. Neon check
  try {
    const res = await query(
      `SELECT id, message_id, status, sent_at, preview_url FROM email_logs
       WHERE (order_id = $1 OR order_number = $2)
         AND email_type = $3
         AND status IN ('ACCEPTED', 'DELIVERED', 'SENT')
         AND (sent_at >= $4 OR created_at >= $4)
       ORDER BY id DESC LIMIT 1`,
      [orderId || -1, orderNumber || '', emailType, cutoff]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];
  } catch (e) {}

  // 2. SQLite fallback
  try {
    const row = db.prepare(`
      SELECT id, message_id, status, sent_at, preview_url FROM email_logs
      WHERE (order_id = ? OR order_number = ?)
        AND email_type = ?
        AND status IN ('ACCEPTED', 'DELIVERED', 'SENT')
        AND sent_at >= ?
      ORDER BY id DESC LIMIT 1
    `).get(orderId || -1, orderNumber || '', emailType, cutoff);
    if (row) return row;
  } catch (e) {}

  return null;
}

/**
 * Registra un envío de correo en Neon PostgreSQL y SQLite con auditoría completa
 */
export async function logEmailRecord({
  orderId,
  orderNumber,
  recipientEmail,
  subject,
  emailType,
  status, // 'ACCEPTED', 'DELIVERED', 'PENDING_CONFIG', 'FAILED', 'IDEMPOTENT_SKIPPED'
  messageId = null,
  providerName = null,
  providerResponse = null,
  attemptCount = 1,
  previewUrl = null,
  errorMessage = null,
  htmlFilePath = null
}) {
  const now = new Date().toISOString();

  // 1. Neon PostgreSQL
  try {
    await query(
      `INSERT INTO email_logs (
        order_id, order_number, recipient_email, subject, email_type,
        status, message_id, provider_name, provider_response, attempt_count,
        preview_url, error_message, content_preview, html_file_path, sent_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)`,
      [
        orderId || null,
        orderNumber,
        recipientEmail,
        subject,
        emailType,
        status,
        messageId,
        providerName,
        providerResponse,
        attemptCount,
        previewUrl,
        errorMessage,
        subject,
        htmlFilePath,
        now
      ]
    );
  } catch (neonErr) {
    console.warn('[Mailer Neon Log Warning]', neonErr.message);
  }

  // 2. SQLite
  try {
    db.prepare(`
      INSERT INTO email_logs (
        order_id, order_number, recipient_email, subject, email_type,
        status, message_id, provider_name, provider_response, attempt_count,
        preview_url, error_message, html_file_path, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId || null,
      orderNumber,
      recipientEmail,
      subject,
      emailType,
      status,
      messageId,
      providerName,
      providerResponse,
      attemptCount,
      previewUrl,
      errorMessage,
      htmlFilePath,
      now
    );
  } catch (sqliteErr) {
    console.warn('[Mailer SQLite Log Warning]', sqliteErr.message);
  }
}

/**
 * EMAIL 1: Plantilla de Confirmación Inmediata de Pedido
 */
export function generateOrderPlacedEmailHtml({ order, items = [] }) {
  const isCOD = order.payment_method === 'COD';
  const paymentLabel = isCOD
    ? 'Pago Contra Entrega (Pagas en efectivo al recibir el paquete)'
    : 'Pago Anticipado / Transferencia';

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 14px 10px; border-bottom: 1px solid #222222; color: #FFFFFF; font-size: 14px;">
          <strong style="color: #FFFFFF; font-size: 15px;">${item.product_name || item.name}</strong><br>
          <span style="font-size: 12px; color: #888888;">Talla: <strong>${item.size || 'Única'}</strong> | Cantidad: <strong>${item.quantity}</strong></span>
        </td>
        <td style="padding: 14px 10px; border-bottom: 1px solid #222222; color: #FFFFFF; text-align: right; font-size: 15px; font-weight: 700; font-family: 'Roboto', 'Inter', -apple-system, sans-serif;">
          $${(item.subtotal || (item.price || item.unit_price || 0) * item.quantity).toLocaleString('es-CO')} COP
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pedido #${order.order_number} - URBAN STYLE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0B0B; font-family: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #EEEEEE;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111111; border: 1px solid #222222;">
    
    <!-- CABECERA -->
    <div style="background-color: #111111; padding: 32px 24px; text-align: center; border-bottom: 2px solid #FF5A1F;">
      <h1 style="margin: 0; font-size: 26px; letter-spacing: 2px; color: #FFFFFF; text-transform: uppercase; font-weight: 900;">
        URBAN STYLE<span style="color: #FF5A1F;">.</span>
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 12px; color: #888888; letter-spacing: 1.5px; text-transform: uppercase;">
        El estilo no se explica. Se demuestra.
      </p>
    </div>

    <!-- BANNER DE CONFIRMACIÓN -->
    <div style="padding: 28px 24px; background: linear-gradient(180deg, #181818 0%, #111111 100%); text-align: center;">
      <div style="display: inline-block; background-color: rgba(72, 187, 120, 0.15); border: 1px solid #48BB78; border-radius: 50px; padding: 6px 18px; margin-bottom: 12px;">
        <span style="color: #48BB78; font-size: 13px; font-weight: 700; letter-spacing: 1px;">PEDIDO CONFIRMADO</span>
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #FFFFFF;">¡Gracias por tu compra, ${order.customer_name}!</h2>
      <p style="margin: 0; font-size: 14px; color: #AAAAAA; line-height: 1.5;">
        Hemos recibido tu pedido oficial <strong style="color: #FFFFFF;">#${order.order_number}</strong>.
        Nuestro equipo ya se encuentra preparando tus prendas en bodega.
      </p>
    </div>

    <!-- AVISO DE DESPACHO INMINENTE -->
    <div style="margin: 0 24px 20px 24px; background-color: #1A1A1A; border-left: 4px solid #FF5A1F; padding: 14px 18px; border-radius: 4px;">
      <strong style="color: #FF5A1F; font-size: 13px; text-transform: uppercase;">Próximo paso: Generación de Guía de Transporte</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #CCCCCC; line-height: 1.4;">
        En cuanto despachemos tu paquete recibirás un segundo correo con el número de guía de Mi Paquete, la transportadora asignada y el enlace de rastreo en tiempo real.
      </p>
    </div>

    <!-- DESTINO Y PAGO -->
    <div style="padding: 0 24px 20px 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <div style="background-color: #161616; padding: 16px; border-radius: 4px; border: 1px solid #222222; min-height: 130px;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Datos del Destinatario</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.5;">
                <strong>${order.customer_name} ${order.customer_surname || ''}</strong><br>
                ${order.delivery_address}<br>
                ${order.delivery_neighborhood ? `Barrio: ${order.delivery_neighborhood}<br>` : ''}
                ${order.delivery_city}, ${order.delivery_department}<br>
                Teléfono: <strong>${order.customer_phone}</strong>
              </p>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 10px;">
            <div style="background-color: #161616; padding: 16px; border-radius: 4px; border: 1px solid #222222; min-height: 130px;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Método de Pago</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.5;">
                ${paymentLabel}
              </p>
              ${order.delivery_notes ? `<p style="margin: 8px 0 0 0; color: #888888; font-size: 12px;"><strong>Notas:</strong> ${order.delivery_notes}</p>` : ''}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- RESUMEN DE PRODUCTOS -->
    <div style="padding: 0 24px 24px 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;">
        Prendas Seleccionadas
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>

      <!-- TOTALES -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; font-family: 'Roboto', 'Inter', -apple-system, sans-serif;">
        <tr>
          <td style="padding: 8px 0; color: #888888;">Subtotal de Productos:</td>
          <td style="padding: 8px 0; color: #FFFFFF; text-align: right; font-weight: 600;">$${Number(order.subtotal).toLocaleString('es-CO')} COP</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888888;">Flete de Envío:</td>
          <td style="padding: 8px 0; color: #FFFFFF; text-align: right; font-weight: 600;">$${Number(order.shipping_cost).toLocaleString('es-CO')} COP</td>
        </tr>
        <tr style="border-top: 2px solid #2E2E2E;">
          <td style="padding: 14px 0; color: #FFFFFF; font-size: 16px; font-weight: 700;">TOTAL DE LA ORDEN:</td>
          <td style="padding: 14px 0; color: #FF5A1F; font-size: 20px; font-weight: 900; text-align: right;">$${Number(order.total).toLocaleString('es-CO')} COP</td>
        </tr>
      </table>
    </div>

    <!-- PIE DEL CORREO -->
    <div style="background-color: #0A0A0A; padding: 24px; text-align: center; border-top: 1px solid #1E1E1E; font-size: 12px; color: #666666; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">
        URBAN STYLE S.A.S. | Moda Urbana Contemporánea | Bogotá D.C. & Medellín, Colombia
      </p>
      <p style="margin: 0;">
        ¿Dudas con tu compra? Escríbenos a <a href="mailto:despachos@urbanstyle.com.co" style="color: #FF5A1F; text-decoration: none;">despachos@urbanstyle.com.co</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * EMAIL 2: Plantilla de Despacho y Guía de Transporte
 */
export function generateShippingDispatchedEmailHtml({ order, shipment, items = [] }) {
  const isCOD = order.payment_method === 'COD';
  const baseUrl = process.env.PUBLIC_URL || process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 4000}`;
  const guideUrl = shipment.pdf_guide_url?.startsWith('http')
    ? shipment.pdf_guide_url
    : `${baseUrl}${shipment.pdf_guide_url || `/api/shipping/guide/${shipment.guide_number}`}`;
  const trackingUrl = shipment.tracking_url || `https://mipaquete.com/seguimiento?guia=${shipment.guide_number}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Guía de Envío ${shipment.guide_number} - URBAN STYLE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0B0B; font-family: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #EEEEEE;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111111; border: 1px solid #222222;">
    
    <!-- CABECERA -->
    <div style="background-color: #111111; padding: 32px 24px; text-align: center; border-bottom: 2px solid #FF5A1F;">
      <h1 style="margin: 0; font-size: 26px; letter-spacing: 2px; color: #FFFFFF; text-transform: uppercase; font-weight: 900;">
        URBAN STYLE<span style="color: #FF5A1F;">.</span>
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 12px; color: #888888; letter-spacing: 1.5px; text-transform: uppercase;">
        Logística & Envíos Nacionales Mi Paquete
      </p>
    </div>

    <!-- BANNER DE DESPACHO -->
    <div style="padding: 28px 24px; background: linear-gradient(180deg, #181818 0%, #111111 100%); text-align: center;">
      <div style="display: inline-block; background-color: rgba(255, 90, 31, 0.15); border: 1px solid #FF5A1F; border-radius: 50px; padding: 6px 18px; margin-bottom: 12px;">
        <span style="color: #FF5A1F; font-size: 13px; font-weight: 700; letter-spacing: 1px;">PAQUETE EN TRÁNSITO</span>
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #FFFFFF;">¡Tu pedido #${order.order_number} ya tiene guía de envío!</h2>
      <p style="margin: 0; font-size: 14px; color: #AAAAAA; line-height: 1.5;">
        Hola <strong style="color: #FFFFFF;">${order.customer_name}</strong>, hemos asignado tu despacho con la transportadora <strong style="color: #FF5A1F;">${shipment.carrier_name}</strong>.
      </p>
    </div>

    <!-- CAJA DE GUÍA DE TRANSPORTE DESTACADA -->
    <div style="margin: 0 24px 24px 24px; background-color: #1A1A1A; border: 1px solid #2E2E2E; border-radius: 6px; padding: 20px;">
      <div style="border-bottom: 1px solid #2A2A2A; padding-bottom: 12px; margin-bottom: 14px;">
        <span style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Detalles de la Transportadora</span>
        <h3 style="margin: 4px 0 0 0; font-size: 18px; color: #FFFFFF;">
          ${shipment.carrier_name}
        </h3>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Roboto', 'Inter', -apple-system, sans-serif;">
        <tr>
          <td style="padding: 8px 0; color: #888888;">Número de Guía:</td>
          <td style="padding: 8px 0; color: #FFFFFF; font-weight: 700; text-align: right; font-family: monospace; font-size: 16px; letter-spacing: 1px;">
            ${shipment.guide_number}
          </td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888888;">Código Mi Paquete:</td>
          <td style="padding: 6px 0; color: #AAAAAA; text-align: right;">${shipment.mp_code || 'MP-2026'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888888;">Estado Actual:</td>
          <td style="padding: 6px 0; color: #48BB78; font-weight: 600; text-align: right;">${shipment.tracking_status || 'Recolección programada'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888888;">Destino de Entrega:</td>
          <td style="padding: 6px 0; color: #FFFFFF; text-align: right;">${order.delivery_city}, ${order.delivery_department}</td>
        </tr>
        ${isCOD ? `
        <tr style="border-top: 1px solid #2A2A2A;">
          <td style="padding: 10px 0; color: #FF5A1F; font-weight: bold; font-size: 14px;">Valor a pagar contra entrega:</td>
          <td style="padding: 10px 0; color: #FF5A1F; font-weight: 900; font-size: 18px; text-align: right;">$${Number(order.total).toLocaleString('es-CO')} COP</td>
        </tr>
        ` : ''}
      </table>

      <!-- BOTONES DE ACCIÓN -->
      <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #2A2A2A; display: flex; flex-direction: column; gap: 10px;">
        <a href="${trackingUrl}" target="_blank" style="display: block; background-color: #FF5A1F; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 20px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          🔍 Rastrear Envío en Tiempo Real
        </a>
        <a href="${guideUrl}" target="_blank" style="display: block; background-color: #2A2A2A; color: #EEEEEE; text-decoration: none; font-size: 12px; font-weight: 600; padding: 10px 20px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
          🖨️ Ver / Imprimir Guía Oficial (PDF)
        </a>
      </div>
    </div>

    <!-- DATOS DE DESTINATARIO -->
    <div style="padding: 0 24px 20px 24px;">
      <div style="background-color: #161616; padding: 16px; border-radius: 4px; border: 1px solid #222222; font-size: 13px;">
        <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Dirección de Entrega Registrada</strong>
        <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.5;">
          <strong>${order.customer_name} ${order.customer_surname || ''}</strong> (Doc: ${order.customer_doc})<br>
          ${order.delivery_address}<br>
          ${order.delivery_neighborhood ? `Barrio: ${order.delivery_neighborhood}<br>` : ''}
          ${order.delivery_city}, ${order.delivery_department} (DANE: ${order.delivery_dane_code})<br>
          Teléfono: <strong>${order.customer_phone}</strong>
        </p>
      </div>
    </div>

    <!-- PIE DEL CORREO -->
    <div style="background-color: #0A0A0A; padding: 24px; text-align: center; border-top: 1px solid #1E1E1E; font-size: 12px; color: #666666; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">
        URBAN STYLE S.A.S. | Despachos Automatizados con Mi Paquete
      </p>
      <p style="margin: 0;">
        ¿Dudas con tu entrega? Contáctanos a <a href="mailto:despachos@urbanstyle.com.co" style="color: #FF5A1F; text-decoration: none;">despachos@urbanstyle.com.co</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * EMAIL 1: Envía el correo de Confirmación de Pedido (Inmediato)
 */
export async function sendOrderPlacedEmail({ order, items = [], force = false }) {
  const emailType = 'ORDER_CONFIRMATION';

  // 1. Protección de Idempotencia
  if (!force) {
    const recent = await wasEmailRecentlySent(order.id, order.order_number, emailType, 120);
    if (recent) {
      console.log(`[Mailer Idempotency] Email de confirmación ya enviado recientemente para #${order.order_number}. Omitiendo.`);
      return {
        success: true,
        status: 'IDEMPOTENT_SKIPPED',
        messageId: recent.message_id,
        emailType,
        previewUrl: recent.preview_url || `/api/orders/${order.order_number}/email-preview?type=placed`,
        notice: 'Notificación ya enviada recientemente (protección contra duplicados).'
      };
    }
  }

  const htmlContent = generateOrderPlacedEmailHtml({ order, items });
  const from = process.env.MAIL_FROM || '"URBAN STYLE Pedidos" <pedidos@urbanstyle.com.co>';
  const subject = `¡Tu pedido #${order.order_number} en URBAN STYLE está confirmado!`;

  // Guardar archivo HTML en disco para inspección o vista previa
  const logFilePath = path.join(EMAIL_LOGS_DIR, `order-placed-${order.order_number}.html`);
  try {
    fs.writeFileSync(logFilePath, htmlContent, 'utf8');
  } catch (e) {}

  const providerInfo = await getTransporterInfo();

  if (providerInfo.transporter) {
    try {
      const info = await providerInfo.transporter.sendMail({
        from,
        to: order.customer_email,
        subject,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || `/api/orders/${order.order_number}/email-preview?type=placed`;

      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType,
        status: 'ACCEPTED',
        messageId: info.messageId,
        providerName: providerInfo.providerName,
        providerResponse: info.response || '250 OK: queued for delivery',
        attemptCount: force ? 2 : 1,
        previewUrl,
        errorMessage: null,
        htmlFilePath: logFilePath
      });

      return {
        success: true,
        status: 'ACCEPTED',
        messageId: info.messageId,
        providerName: providerInfo.providerName,
        providerResponse: info.response || '250 OK',
        emailType,
        previewUrl
      };
    } catch (err) {
      console.error(`[Mailer Error] Fallo al enviar Email 1: ${err.message}`);
      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType,
        status: 'FAILED',
        messageId: null,
        providerName: providerInfo.providerName,
        providerResponse: null,
        attemptCount: force ? 2 : 1,
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`,
        errorMessage: err.message,
        htmlFilePath: logFilePath
      });

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        emailType,
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`
      };
    }
  } else {
    // Modo local / Fallback (Credenciales SMTP pendientes)
    const notice = providerInfo.reason || 'Credenciales SMTP pendientes en variables de entorno Vercel.';
    await logEmailRecord({
      orderId: order.id,
      orderNumber: order.order_number,
      recipientEmail: order.customer_email,
      subject,
      emailType,
      status: 'PENDING_CONFIG',
      messageId: null,
      providerName: providerInfo.providerName,
      providerResponse: null,
      attemptCount: 1,
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`,
      errorMessage: notice,
      htmlFilePath: logFilePath
    });

    return {
      success: true,
      status: 'PENDING_CONFIG',
      simulated: true,
      notice,
      emailType,
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`
    };
  }
}

/**
 * EMAIL 2: Envía el correo de Despacho y Guía de Envío
 */
export async function sendShippingConfirmationEmail({ order, shipment, items = [], force = false }) {
  const emailType = 'SHIPPING_NOTIFICATION';

  // 1. Protección de Idempotencia
  if (!force) {
    const recent = await wasEmailRecentlySent(order.id, order.order_number, emailType, 120);
    if (recent) {
      console.log(`[Mailer Idempotency] Email de despacho ya enviado recientemente para #${order.order_number}. Omitiendo.`);
      return {
        success: true,
        status: 'IDEMPOTENT_SKIPPED',
        messageId: recent.message_id,
        emailType,
        previewUrl: recent.preview_url || `/api/orders/${order.order_number}/email-preview?type=shipping`,
        notice: 'Notificación de guía ya enviada recientemente (protección contra duplicados).'
      };
    }
  }

  const htmlContent = generateShippingDispatchedEmailHtml({ order, shipment, items });
  const from = process.env.MAIL_FROM || '"URBAN STYLE Despachos" <despachos@urbanstyle.com.co>';
  const subject = `¡Tu guía de envío #${shipment.guide_number} está lista! - Pedido #${order.order_number}`;

  // Guardar archivo HTML en disco
  const logFilePath = path.join(EMAIL_LOGS_DIR, `shipping-guide-${order.order_number}.html`);
  try {
    fs.writeFileSync(logFilePath, htmlContent, 'utf8');
  } catch (e) {}

  // Preparar adjunto de la guía imprimible
  const guidePrintHtml = renderPrintableGuideHtml({ order, shipment, items });
  const attachments = [
    {
      filename: `Guia_Transporte_${shipment.guide_number}.html`,
      content: guidePrintHtml,
      contentType: 'text/html'
    }
  ];

  const providerInfo = await getTransporterInfo();

  if (providerInfo.transporter) {
    try {
      const info = await providerInfo.transporter.sendMail({
        from,
        to: order.customer_email,
        subject,
        html: htmlContent,
        attachments
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || `/api/orders/${order.order_number}/email-preview?type=shipping`;

      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType,
        status: 'ACCEPTED',
        messageId: info.messageId,
        providerName: providerInfo.providerName,
        providerResponse: info.response || '250 OK: queued for delivery',
        attemptCount: force ? 2 : 1,
        previewUrl,
        errorMessage: null,
        htmlFilePath: logFilePath
      });

      return {
        success: true,
        status: 'ACCEPTED',
        messageId: info.messageId,
        providerName: providerInfo.providerName,
        providerResponse: info.response || '250 OK',
        emailType,
        previewUrl
      };
    } catch (err) {
      console.error(`[Mailer Error] Fallo al enviar Email 2: ${err.message}`);
      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType,
        status: 'FAILED',
        messageId: null,
        providerName: providerInfo.providerName,
        providerResponse: null,
        attemptCount: force ? 2 : 1,
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`,
        errorMessage: err.message,
        htmlFilePath: logFilePath
      });

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        emailType,
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`
      };
    }
  } else {
    const notice = providerInfo.reason || 'Credenciales SMTP pendientes en variables de entorno Vercel.';
    await logEmailRecord({
      orderId: order.id,
      orderNumber: order.order_number,
      recipientEmail: order.customer_email,
      subject,
      emailType,
      status: 'PENDING_CONFIG',
      messageId: null,
      providerName: providerInfo.providerName,
      providerResponse: null,
      attemptCount: 1,
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`,
      errorMessage: notice,
      htmlFilePath: logFilePath
    });

    return {
      success: true,
      status: 'PENDING_CONFIG',
      simulated: true,
      notice,
      emailType,
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`
    };
  }
}

/**
 * Función compatible con código anterior (envía confirmación combinada o Email 2)
 */
export async function sendOrderConfirmationEmail({ order, shipment, items = [], force = false }) {
  if (shipment && shipment.guide_number) {
    return await sendShippingConfirmationEmail({ order, shipment, items, force });
  } else {
    return await sendOrderPlacedEmail({ order, items, force });
  }
}

/**
 * Reintento controlado de envío de correo por el administrador
 */
export async function retryOrderEmail(orderIdentifier, emailType = 'ALL', force = true) {
  let order = null;
  let items = [];
  let shipment = null;

  // 1. Si se pasa un objeto pre-cargado desde getAdminOrderDetails
  if (typeof orderIdentifier === 'object' && orderIdentifier !== null && orderIdentifier.order) {
    order = orderIdentifier.order;
    shipment = orderIdentifier.shipment || null;
    items = orderIdentifier.items || [];
    if (orderIdentifier.emailType) emailType = orderIdentifier.emailType;
    if (orderIdentifier.force !== undefined) force = orderIdentifier.force;
  } else {
    // 2. Buscar orden en Neon PostgreSQL o SQLite por order_number o id
    const orderNumOrId = String(orderIdentifier || '').trim();
    if (!orderNumOrId) throw new Error('Identificador de pedido no proporcionado.');

    try {
      const res = await query(
        'SELECT * FROM orders WHERE order_number = $1 OR id::text = $1 LIMIT 1',
        [orderNumOrId]
      );
      if (res.rows && res.rows[0]) {
        order = res.rows[0];
        const itRes = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [order.id]);
        items = itRes.rows || [];
        const shRes = await query('SELECT * FROM shipments WHERE order_id = $1 LIMIT 1', [order.id]);
        shipment = shRes.rows[0] || null;
      }
    } catch (e) {
      console.warn('[retryOrderEmail Neon Fallback]', e.message);
    }

    if (!order) {
      order = db.prepare('SELECT * FROM orders WHERE order_number = ? OR id = ?').get(orderNumOrId, orderNumOrId);
      if (!order) throw new Error(`Pedido «${orderNumOrId}» no encontrado en Neon ni en SQLite.`);
      items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id) || [];
      shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id) || null;
    }
  }

  const results = [];

  // Enviar Email 1 (Confirmación de compra) si aplica
  if (emailType === 'ALL' || emailType === 'placed' || emailType === 'ORDER_CONFIRMATION') {
    const placedRes = await sendOrderPlacedEmail({ order, items, force });
    results.push(placedRes);
  }

  // Enviar Email 2 (Despacho y Guía de envío) si aplica
  if (emailType === 'ALL' || emailType === 'shipping' || emailType === 'SHIPPING_NOTIFICATION') {
    if (shipment && shipment.guide_number) {
      const shipRes = await sendShippingConfirmationEmail({ order, shipment, items, force });
      results.push(shipRes);
    } else if (emailType === 'shipping' || emailType === 'SHIPPING_NOTIFICATION') {
      throw new Error(`El pedido #${order.order_number} no tiene guía de transporte asociada. Genere la guía antes de enviar la notificación.`);
    }
  }

  return {
    success: true,
    orderNumber: order.order_number,
    recipient: order.customer_email,
    results
  };
}
