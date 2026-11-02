import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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
function createTransporter() {
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
 * Genera la plantilla HTML responsive con el diseño de URBAN STYLE
 */
export function generateOrderEmailHtml({ order, shipment, items = [] }) {
  const isCOD = order.payment_method === 'COD';
  const paymentLabel = isCOD
    ? 'Pago Contra Entrega (Pagas en efectivo o transferencia al recibir tu paquete)'
    : 'Pago Anticipado / Transferencia';

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #222222; color: #FFFFFF; font-size: 14px;">
          <strong>${item.product_name}</strong><br>
          <span style="font-size: 12px; color: #888888;">Talla: ${item.size || 'Única'} | Cantidad: ${item.quantity}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #222222; color: #FFFFFF; text-align: right; font-size: 14px; font-weight: 600;">
          $${(item.subtotal || item.price * item.quantity).toLocaleString('es-CO')} COP
        </td>
      </tr>
    `
    )
    .join('');

  const guideUrl = shipment.pdf_guide_url?.startsWith('http')
    ? shipment.pdf_guide_url
    : `http://localhost:${process.env.PORT || 4000}${shipment.pdf_guide_url}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmación de Pedido - URBAN STYLE</title>
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
      <div style="display: inline-block; background-color: rgba(255, 90, 31, 0.15); border: 1px solid #FF5A1F; border-radius: 50px; padding: 6px 18px; margin-bottom: 12px;">
        <span style="color: #FF5A1F; font-size: 13px; font-weight: 700; letter-spacing: 1px;">PEDIDO CONFIRMADO</span>
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #FFFFFF;">¡Gracias por tu compra, ${order.customer_name}!</h2>
      <p style="margin: 0; font-size: 14px; color: #AAAAAA; line-height: 1.5;">
        Hemos registrado tu pedido <strong style="color: #FFFFFF;">#${order.order_number}</strong> y preparado tu guía de despacho con Mi Paquete.
      </p>
    </div>

    <!-- CAJA DE GUÍA DE TRANSPORTE DESTACADA -->
    <div style="margin: 0 24px 24px 24px; background-color: #1A1A1A; border: 1px solid #2E2E2E; border-radius: 6px; padding: 20px;">
      <div style="border-bottom: 1px solid #2A2A2A; padding-bottom: 12px; margin-bottom: 14px;">
        <span style="font-size: 11px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Información de Envío</span>
        <h3 style="margin: 4px 0 0 0; font-size: 16px; color: #FFFFFF; display: flex; align-items: center; justify-content: space-between;">
          <span>Transportadora: <span style="color: #FF5A1F;">${shipment.carrier_name}</span></span>
        </h3>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; color: #888888;">Número de Guía:</td>
          <td style="padding: 4px 0; color: #FFFFFF; font-weight: 700; text-align: right; font-family: monospace; font-size: 14px;">
            ${shipment.guide_number}
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">Código Mi Paquete:</td>
          <td style="padding: 4px 0; color: #AAAAAA; text-align: right;">${shipment.mp_code || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #888888;">Estado de Despacho:</td>
          <td style="padding: 4px 0; color: #48BB78; font-weight: 600; text-align: right;">${shipment.tracking_status}</td>
        </tr>
      </table>

      <!-- BOTÓN DE DESCARGA DE GUÍA PDF -->
      <div style="text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid #2A2A2A;">
        <a href="${guideUrl}" target="_blank" style="display: inline-block; background-color: #FF5A1F; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">
          Descargar Guía de Transporte (PDF)
        </a>
      </div>
    </div>

    <!-- DIRECCIÓN DE ENTREGA Y MÉTODO DE PAGO -->
    <div style="padding: 0 24px 20px 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 12px;">
            <div style="background-color: #161616; padding: 14px; border-radius: 4px; border: 1px solid #222222; height: 100%;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Destino de Entrega</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.4;">
                ${order.delivery_address}<br>
                ${order.delivery_neighborhood ? `Barrio: ${order.delivery_neighborhood}<br>` : ''}
                ${order.delivery_city}, ${order.delivery_department}<br>
                Tel: ${order.customer_phone}
              </p>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 12px;">
            <div style="background-color: #161616; padding: 14px; border-radius: 4px; border: 1px solid #222222; height: 100%;">
              <strong style="color: #FF5A1F; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Método de Pago</strong>
              <p style="margin: 8px 0 0 0; color: #FFFFFF; line-height: 1.4;">
                ${paymentLabel}
              </p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- RESUMEN DE PRODUCTOS -->
    <div style="padding: 0 24px 24px 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;">
        Resumen de Prendas
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>

      <!-- TOTALES -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #888888;">Subtotal de Productos:</td>
          <td style="padding: 6px 0; color: #FFFFFF; text-align: right;">$${order.subtotal.toLocaleString('es-CO')} COP</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888888;">Flete de Envío (${shipment.carrier_name}):</td>
          <td style="padding: 6px 0; color: #FFFFFF; text-align: right;">$${order.shipping_cost.toLocaleString('es-CO')} COP</td>
        </tr>
        <tr style="border-top: 2px solid #2E2E2E;">
          <td style="padding: 12px 0; color: #FFFFFF; font-size: 16px; font-weight: 700;">TOTAL A PAGAR:</td>
          <td style="padding: 12px 0; color: #FF5A1F; font-size: 18px; font-weight: 900; text-align: right;">$${order.total.toLocaleString('es-CO')} COP</td>
        </tr>
      </table>
    </div>

    <!-- PIE DEL CORREO -->
    <div style="background-color: #0A0A0A; padding: 24px; text-align: center; border-top: 1px solid #1E1E1E; font-size: 12px; color: #666666; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;">
        URBAN STYLE S.A.S. | Moda Urbana Contemporánea | Bogotá D.C. & Medellín, Colombia
      </p>
      <p style="margin: 0;">
        ¿Tienes preguntas con tu despacho? Escríbenos a <a href="mailto:despachos@urbanstyle.com.co" style="color: #FF5A1F; text-decoration: none;">despachos@urbanstyle.com.co</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

import { db } from '../db/database.js';
import { renderPrintableGuideHtml } from './guideGenerator.js';

/**
 * Envía el correo automático con la guía o lo almacena para inspección
 */
export async function sendOrderConfirmationEmail({ order, shipment, items = [] }) {
  const htmlContent = generateOrderEmailHtml({ order, shipment, items });
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM || '"URBAN STYLE Despachos" <despachos@urbanstyle.com.co>';
  const subject = `Tu pedido #${order.order_number} ha sido confirmado - Guía de envío ${shipment.guide_number}`;

  // Guardar siempre una copia local del correo generado en server/logs/emails/
  const logFilePath = path.join(EMAIL_LOGS_DIR, `order-${order.order_number}.html`);
  fs.writeFileSync(logFilePath, htmlContent, 'utf8');

  // Preparar documento imprimible adjunto
  const guideHtml = renderPrintableGuideHtml({ order, shipment, items });
  const attachments = [
    {
      filename: `Guia_Transporte_${shipment.guide_number}.html`,
      content: guideHtml,
      contentType: 'text/html'
    }
  ];

  const now = new Date().toISOString();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to: order.customer_email,
        subject,
        html: htmlContent,
        attachments
      });

      console.log(`[Email Service] Correo enviado a ${order.customer_email}: MessageID ${info.messageId}`);

      // Registrar en email_logs
      db.prepare(`
        INSERT INTO email_logs (order_id, order_number, recipient_email, subject, status, error_message, html_file_path, sent_at)
        VALUES (?, ?, ?, ?, 'SENT', NULL, ?, ?)
      `).run(order.id, order.order_number, order.customer_email, subject, logFilePath, now);

      return {
        success: true,
        status: 'SENT',
        messageId: info.messageId,
        savedLocally: logFilePath,
        previewUrl: `/api/orders/${order.order_number}/email-preview`
      };
    } catch (err) {
      console.error(`[Email Service] Error enviando correo vía SMTP: ${err.message}`);

      // Registrar fallo en email_logs
      db.prepare(`
        INSERT INTO email_logs (order_id, order_number, recipient_email, subject, status, error_message, html_file_path, sent_at)
        VALUES (?, ?, ?, ?, 'FAILED', ?, ?, ?)
      `).run(order.id, order.order_number, order.customer_email, subject, err.message, logFilePath, now);

      return {
        success: false,
        status: 'FAILED',
        error: err.message,
        savedLocally: logFilePath,
        previewUrl: `/api/orders/${order.order_number}/email-preview`
      };
    }
  } else {
    const notice = 'Credenciales SMTP no configuradas en .env. Correo generado y respaldado en disco local para inspección.';
    console.log(`[Email Service] Modo Local: Correo para ${order.customer_email} registrado en ${logFilePath}`);

    // Registrar en email_logs como pendiente de configuración SMTP
    db.prepare(`
      INSERT INTO email_logs (order_id, order_number, recipient_email, subject, status, error_message, html_file_path, sent_at)
      VALUES (?, ?, ?, ?, 'PENDING_SMTP_CREDENTIALS', ?, ?, ?)
    `).run(order.id, order.order_number, order.customer_email, subject, notice, logFilePath, now);

    return {
      success: true,
      status: 'PENDING_SMTP_CREDENTIALS',
      simulated: true,
      notice,
      savedLocally: logFilePath,
      previewUrl: `/api/orders/${order.order_number}/email-preview`
    };
  }
}

/**
 * Reintento controlado de envío de correo por el administrador
 */
export async function retryOrderEmail(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Pedido no encontrado');

  const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
  if (!shipment) throw new Error('Despacho no encontrado para este pedido');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  return await sendOrderConfirmationEmail({ order, shipment, items });
}
