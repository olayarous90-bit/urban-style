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

/**
 * Crea el transportador de correo con fallback seguro
 */
export function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  return null;
}

/**
 * Registra un envío de correo en Neon PostgreSQL y SQLite
 */
async function logEmailRecord({
  orderId,
  orderNumber,
  recipientEmail,
  subject,
  emailType,
  status,
  errorMessage = null,
  htmlFilePath = null
}) {
  const now = new Date().toISOString();

  // 1. Neon PostgreSQL
  try {
    await query(
      `INSERT INTO email_logs (
        order_id, order_number, recipient_email, subject, email_type,
        status, error_message, content_preview, html_file_path, sent_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        orderId || null,
        orderNumber,
        recipientEmail,
        subject,
        emailType,
        status,
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
        order_id, order_number, recipient_email, subject, status,
        error_message, html_file_path, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId || null,
      orderNumber,
      recipientEmail,
      subject,
      status,
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
        <td style="padding: 12px 8px; border-bottom: 1px solid #222222; color: #FFFFFF; font-size: 14px;">
          <strong>${item.product_name || item.name}</strong><br>
          <span style="font-size: 12px; color: #888888;">Talla: ${item.size || 'Única'} | Cantidad: ${item.quantity}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #222222; color: #FFFFFF; text-align: right; font-size: 14px; font-weight: 600;">
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
<body style="margin: 0; padding: 0; background-color: #0B0B0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #EEEEEE;">
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
        Hemos recibido tu pedido con el identificador oficial <strong style="color: #FFFFFF;">#${order.order_number}</strong>.
        Nuestro equipo ya está preparando tus prendas en bodega.
      </p>
    </div>

    <!-- AVISO DE DESPACHO INMINENTE -->
    <div style="margin: 0 24px 20px 24px; background-color: #1A1A1A; border-left: 4px solid #FF5A1F; padding: 14px 18px; border-radius: 4px;">
      <strong style="color: #FF5A1F; font-size: 13px; text-transform: uppercase;">Próximo paso: Generación de Guía de Transporte</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #CCCCCC; line-height: 1.4;">
        En un momento recibirás un segundo correo con el número de guía de Mi Paquete, la transportadora asignada y el enlace de seguimiento en tiempo real.
      </p>
    </div>

    <!-- DESTINO Y PAGO -->
    <div style="padding: 0 24px 20px 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <div style="background-color: #161616; padding: 14px; border-radius: 4px; border: 1px solid #222222; min-height: 120px;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Datos del Destinatario</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.4;">
                ${order.customer_name} ${order.customer_surname || ''}<br>
                ${order.delivery_address}<br>
                ${order.delivery_neighborhood ? `Barrio: ${order.delivery_neighborhood}<br>` : ''}
                ${order.delivery_city}, ${order.delivery_department}<br>
                Teléfono: ${order.customer_phone}
              </p>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 10px;">
            <div style="background-color: #161616; padding: 14px; border-radius: 4px; border: 1px solid #222222; min-height: 120px;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Método de Pago</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.4;">
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
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #888888;">Subtotal de Productos:</td>
          <td style="padding: 6px 0; color: #FFFFFF; text-align: right;">$${Number(order.subtotal).toLocaleString('es-CO')} COP</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888888;">Flete de Envío:</td>
          <td style="padding: 6px 0; color: #FFFFFF; text-align: right;">$${Number(order.shipping_cost).toLocaleString('es-CO')} COP</td>
        </tr>
        <tr style="border-top: 2px solid #2E2E2E;">
          <td style="padding: 12px 0; color: #FFFFFF; font-size: 16px; font-weight: 700;">TOTAL DE LA ORDEN:</td>
          <td style="padding: 12px 0; color: #FF5A1F; font-size: 18px; font-weight: 900; text-align: right;">$${Number(order.total).toLocaleString('es-CO')} COP</td>
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
  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
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
<body style="margin: 0; padding: 0; background-color: #0B0B0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #EEEEEE;">
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
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #888888;">Número de Guía:</td>
          <td style="padding: 6px 0; color: #FFFFFF; font-weight: 700; text-align: right; font-family: monospace; font-size: 15px; letter-spacing: 1px;">
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
          <td style="padding: 8px 0; color: #FF5A1F; font-weight: bold;">Valor a pagar contra entrega:</td>
          <td style="padding: 8px 0; color: #FF5A1F; font-weight: 900; font-size: 16px; text-align: right;">$${Number(order.total).toLocaleString('es-CO')} COP</td>
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
          Teléfono: ${order.customer_phone}
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
export async function sendOrderPlacedEmail({ order, items = [] }) {
  const htmlContent = generateOrderPlacedEmailHtml({ order, items });
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM || '"URBAN STYLE Pedidos" <pedidos@urbanstyle.com.co>';
  const subject = `¡Tu pedido #${order.order_number} en URBAN STYLE está confirmado!`;

  // Guardar archivo HTML en disco para inspección o vista previa
  const logFilePath = path.join(EMAIL_LOGS_DIR, `order-placed-${order.order_number}.html`);
  try {
    fs.writeFileSync(logFilePath, htmlContent, 'utf8');
  } catch (e) {}

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: order.customer_email,
        subject,
        html: htmlContent
      });

      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType: 'ORDER_CONFIRMATION',
        status: 'SENT',
        errorMessage: null,
        htmlFilePath: logFilePath
      });

      return {
        success: true,
        status: 'SENT',
        messageId: info.messageId,
        emailType: 'ORDER_CONFIRMATION',
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`
      };
    } catch (err) {
      console.error(`[Mailer Error] Fallo al enviar Email 1: ${err.message}`);
      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType: 'ORDER_CONFIRMATION',
        status: 'FAILED',
        errorMessage: err.message,
        htmlFilePath: logFilePath
      });

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        emailType: 'ORDER_CONFIRMATION',
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`
      };
    }
  } else {
    // Modo local / Fallback (Credenciales SMTP pendientes)
    const notice = 'Credenciales SMTP pendientes en .env. Correo de confirmación generado y respaldado en disco y base de datos.';
    await logEmailRecord({
      orderId: order.id,
      orderNumber: order.order_number,
      recipientEmail: order.customer_email,
      subject,
      emailType: 'ORDER_CONFIRMATION',
      status: 'PENDING_SMTP_CONFIG',
      errorMessage: notice,
      htmlFilePath: logFilePath
    });

    return {
      success: true,
      status: 'PENDING_SMTP_CONFIG',
      simulated: true,
      notice,
      emailType: 'ORDER_CONFIRMATION',
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=placed`
    };
  }
}

/**
 * EMAIL 2: Envía el correo de Despacho y Guía de Envío
 */
export async function sendShippingConfirmationEmail({ order, shipment, items = [] }) {
  const htmlContent = generateShippingDispatchedEmailHtml({ order, shipment, items });
  const transporter = createTransporter();
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

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: order.customer_email,
        subject,
        html: htmlContent,
        attachments
      });

      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType: 'SHIPPING_NOTIFICATION',
        status: 'SENT',
        errorMessage: null,
        htmlFilePath: logFilePath
      });

      return {
        success: true,
        status: 'SENT',
        messageId: info.messageId,
        emailType: 'SHIPPING_NOTIFICATION',
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`
      };
    } catch (err) {
      console.error(`[Mailer Error] Fallo al enviar Email 2: ${err.message}`);
      await logEmailRecord({
        orderId: order.id,
        orderNumber: order.order_number,
        recipientEmail: order.customer_email,
        subject,
        emailType: 'SHIPPING_NOTIFICATION',
        status: 'FAILED',
        errorMessage: err.message,
        htmlFilePath: logFilePath
      });

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        emailType: 'SHIPPING_NOTIFICATION',
        previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`
      };
    }
  } else {
    const notice = 'Credenciales SMTP pendientes en .env. Correo de guía generado y respaldado en disco y base de datos.';
    await logEmailRecord({
      orderId: order.id,
      orderNumber: order.order_number,
      recipientEmail: order.customer_email,
      subject,
      emailType: 'SHIPPING_NOTIFICATION',
      status: 'PENDING_SMTP_CONFIG',
      errorMessage: notice,
      htmlFilePath: logFilePath
    });

    return {
      success: true,
      status: 'PENDING_SMTP_CONFIG',
      simulated: true,
      notice,
      emailType: 'SHIPPING_NOTIFICATION',
      previewUrl: `/api/orders/${order.order_number}/email-preview?type=shipping`
    };
  }
}

/**
 * Función compatible con código anterior (envía confirmación combinada o Email 2)
 */
export async function sendOrderConfirmationEmail({ order, shipment, items = [] }) {
  if (shipment && shipment.guide_number) {
    return await sendShippingConfirmationEmail({ order, shipment, items });
  } else {
    return await sendOrderPlacedEmail({ order, items });
  }
}

/**
 * Reintento controlado de envío de correo por el administrador
 */
export async function retryOrderEmail(orderId) {
  // Buscar orden en Neon o SQLite
  let order = null;
  let items = [];
  let shipment = null;

  try {
    const res = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (res.rows[0]) {
      order = res.rows[0];
      const itRes = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
      items = itRes.rows;
      const shRes = await query('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
      shipment = shRes.rows[0] || null;
    }
  } catch (e) {}

  if (!order) {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('Pedido no encontrado en Neon ni en SQLite');
    items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
  }

  const results = [];
  const placedRes = await sendOrderPlacedEmail({ order, items });
  results.push(placedRes);

  if (shipment) {
    const shipRes = await sendShippingConfirmationEmail({ order, shipment, items });
    results.push(shipRes);
  }

  return {
    success: true,
    orderNumber: order.order_number,
    results
  };
}
