/**
 * Generador de Guía Oficial de Transporte Imprimible (Formato Estándar Nacional)
 * Compatible con visualización directa en navegador e impresión a PDF.
 */

export function renderPrintableGuideHtml({ order, shipment, items = [] }) {
  const isCOD = order.payment_method === 'COD';
  const recaudoText = isCOD ? `$${order.total.toLocaleString('es-CO')} COP` : '$0 COP (PAGADO)';

  const itemNames = items.map((i) => `${i.quantity}x ${i.product_name} (${i.size})`).join(', ');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Guía de Despacho ${shipment.guide_number} - ${shipment.carrier_name}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f7f7f7;
      color: #111;
    }
    .guide-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #000;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0;
    }
    .carrier-box {
      text-align: right;
    }
    .carrier-name {
      font-size: 20px;
      font-weight: 900;
      color: #FF5A1F;
      margin: 0;
    }
    .guide-num {
      font-size: 18px;
      font-weight: bold;
      font-family: monospace;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    .barcode-box {
      background: #eee;
      padding: 12px;
      text-align: center;
      border: 1px dashed #999;
      margin: 16px 0;
      font-family: monospace;
      font-size: 16px;
      letter-spacing: 4px;
      font-weight: bold;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .card {
      border: 1px solid #ccc;
      padding: 12px;
      border-radius: 4px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #555;
      margin-bottom: 8px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }
    .card p {
      margin: 4px 0;
      font-size: 13px;
      line-height: 1.4;
    }
    .recaudo-box {
      background: ${isCOD ? '#FFF5F0' : '#F0FFF4'};
      border: 2px solid ${isCOD ? '#FF5A1F' : '#38A169'};
      padding: 16px;
      text-align: center;
      margin-bottom: 16px;
    }
    .recaudo-val {
      font-size: 24px;
      font-weight: 900;
      color: ${isCOD ? '#FF5A1F' : '#276749'};
      margin-top: 4px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    .items-table th, .items-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .items-table th {
      background-color: #f2f2f2;
    }
    .btn-print {
      display: inline-block;
      background: #111;
      color: #fff;
      padding: 10px 24px;
      text-decoration: none;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 16px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .guide-container { box-shadow: none; border: 1px solid #000; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 12px auto; text-align: right;">
    <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR / GUARDAR EN PDF</button>
  </div>

  <div class="guide-container">
    <div class="header">
      <div>
        <h1 class="brand-title">URBAN STYLE</h1>
        <span style="font-size: 12px; color: #666;">DESPACHO OFICIAL DE E-COMMERCE | MI PAQUETE</span>
      </div>
      <div class="carrier-box">
        <h2 class="carrier-name">${shipment.carrier_name}</h2>
        <div class="guide-num">GUÍA: ${shipment.guide_number}</div>
        <div style="font-size: 12px; color: #666;">MP CODE: ${shipment.mp_code || '254562'}</div>
      </div>
    </div>

    <div class="barcode-box">
      |||||| |||| |||||||| |||||||||| |||||||| |||| ||||||<br>
      *${shipment.guide_number}*
    </div>

    <div class="grid">
      <!-- REMITENTE -->
      <div class="card">
        <div class="card-title">1. REMITENTE (ORIGEN)</div>
        <p><strong>URBAN STYLE S.A.S.</strong> (NIT: 901654321-1)</p>
        <p>Dirección: Calle 85 # 13-45, Zona Rosa</p>
        <p>Ciudad: Bogotá D.C. (DANE: 11001000)</p>
        <p>Teléfono: 3102345678</p>
        <p>Email: despachos@urbanstyle.com.co</p>
      </div>

      <!-- DESTINATARIO -->
      <div class="card">
        <div class="card-title">2. DESTINATARIO (ENTREGA)</div>
        <p><strong>${order.customer_name} ${order.customer_surname}</strong> (C.C. ${order.customer_doc})</p>
        <p>Dirección: <strong>${order.delivery_address}</strong></p>
        ${order.delivery_neighborhood ? `<p>Barrio: ${order.delivery_neighborhood}</p>` : ''}
        <p>Ciudad: <strong>${order.delivery_city}</strong> - ${order.delivery_department}</p>
        <p>DANE Destino: ${order.delivery_dane_code}</p>
        <p>Teléfono: <strong>${order.customer_phone}</strong></p>
      </div>
    </div>

    <!-- RECAUDO CONTRAENTREGA -->
    <div class="recaudo-box">
      <div style="font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
        ${isCOD ? '⚠️ VALOR A COBRAR EN DESTINO (PAGO CONTRA ENTREGA)' : '✅ ENVÍO PAGADO PREVIAMENTE'}
      </div>
      <div class="recaudo-val">${recaudoText}</div>
      <div style="font-size: 12px; color: #555; margin-top: 4px;">
        ${isCOD ? 'La transportadora debe recaudar este valor antes de entregar el paquete al cliente.' : 'No cobrar flete ni mercancía al destinatario.'}
      </div>
    </div>

    <!-- DETALLES DEL PAQUETE Y CONTENIDO -->
    <div class="card" style="margin-bottom: 16px;">
      <div class="card-title">3. CONTENIDO DEL ENVÍO (PEDIDO #${order.order_number})</div>
      <p><strong>Prendas:</strong> ${itemNames}</p>
      <p><strong>Notas de Entrega:</strong> ${order.delivery_notes || 'Ninguna especificada por el cliente'}</p>
      <div style="display: flex; gap: 24px; margin-top: 8px; font-size: 12px; color: #666;">
        <span>Peso Estimado: 1.2 kg</span>
        <span>Dimensiones: 30x25x10 cm</span>
        <span>Tipo de Envío: Terrestre Express</span>
        <span>Fecha: ${new Date(order.created_at).toLocaleDateString('es-CO')}</span>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 24px; border-top: 1px solid #ddd; font-size: 12px; color: #777;">
      <div>
        URBAN STYLE E-COMMERCE LOGISTICS | Integrado con Plataforma Mi Paquete v2<br>
        Seguimiento en línea: https://mipaquete.com/seguimiento
      </div>
      <div style="border-top: 1px solid #333; width: 220px; text-align: center; padding-top: 4px;">
        Firma y Cédula de Recibido
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
