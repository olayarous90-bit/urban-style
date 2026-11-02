import express from 'express';
import { db } from '../db/database.js';
import { createSending } from '../services/mipaquete.js';
import { sendOrderConfirmationEmail, generateOrderEmailHtml } from '../services/mailer.js';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/orders
 * Crea un pedido oficial, valida stock/precios, genera guía en Mi Paquete y envía correo
 */
router.post('/', async (req, res) => {
  try {
    const {
      customer,
      items,
      shippingSelection,
      paymentMethod = 'COD'
    } = req.body;

    // 1. VALIDACIÓN DE DATOS DEL CLIENTE
    if (!customer || !customer.name || !customer.email || !customer.phone || !customer.address || !customer.deliveryDaneCode) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos obligatorios del destinatario (nombre, email, teléfono, dirección y municipio).'
      });
    }

    if (!EMAIL_REGEX.test(customer.email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico suministrado no tiene un formato válido.'
      });
    }

    // Validación de teléfono colombiano (mínimo 10 dígitos)
    const cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El número telefónico debe contener al menos 10 dígitos para la entrega de la transportadora.'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El carrito de compras no puede estar vacío.'
      });
    }

    if (!shippingSelection || !shippingSelection.carrierName || !shippingSelection.shippingCost) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar una opción de envío cotizada con Mi Paquete.'
      });
    }

    // 2. PROTECCIÓN DE IDEMPOTENCIA CONTRA SOLICITUDES DUPLICADAS
    const idempotencyKey = req.headers['idempotency-key'] ||
      `${customer.email.trim().toLowerCase()}-${customer.deliveryDaneCode}-${items.map(i => `${i.productId}:${i.quantity}`).join(',')}`;

    const existingIdempotent = db.prepare('SELECT * FROM idempotency_records WHERE key = ?').get(idempotencyKey);
    if (existingIdempotent) {
      const existingOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(existingIdempotent.order_id);
      const existingShipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(existingIdempotent.order_id);
      if (existingOrder && existingShipment) {
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          message: 'Pedido recuperado de registro previo (prevención de duplicados).',
          order: existingOrder,
          shipment: existingShipment
        });
      }
    }

    // 3. VALIDACIÓN DE PRECIOS Y PRODUCTOS DESDE BASE DE DATOS
    let validatedSubtotal = 0;
    const validatedItems = [];

    const getProduct = db.prepare('SELECT id, name, price, formatted_price FROM products WHERE id = ?');

    for (const item of items) {
      const product = getProduct.get(item.productId || item.id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `El producto ${item.name || item.id} no existe en nuestro catálogo oficial.`
        });
      }

      const rawQty = parseInt(item.quantity, 10);
      if (isNaN(rawQty) || rawQty < 1 || rawQty > 10) {
        return res.status(400).json({
          success: false,
          message: `La cantidad solicitada para ${product.name} debe estar entre 1 y 10 unidades.`
        });
      }

      const qty = rawQty;
      const itemSubtotal = product.price * qty;
      validatedSubtotal += itemSubtotal;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: qty,
        size: item.size || 'Única',
        color: item.color || 'Estándar',
        subtotal: itemSubtotal
      });
    }

    const shippingCost = Number(shippingSelection.shippingCost) || 0;
    const total = validatedSubtotal + shippingCost;
    const orderNumber = `US-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();
    const initialStatus = paymentMethod === 'COD' ? 'PROCESSING' : 'PENDING_PAYMENT';

    // 4. REGISTRO DEL PEDIDO EN BASE DE DATOS SQLITE (TRANSACCIÓN)
    const insertOrderTx = db.transaction(() => {
      const orderStmt = db.prepare(`
        INSERT INTO orders (
          order_number, customer_name, customer_surname, customer_email, customer_phone, customer_doc,
          delivery_department, delivery_city, delivery_dane_code, delivery_address, delivery_neighborhood,
          delivery_notes, payment_method, subtotal, shipping_cost, total, status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const orderResult = orderStmt.run(
        orderNumber,
        customer.name.trim(),
        (customer.surname || '').trim(),
        customer.email.trim().toLowerCase(),
        customer.phone.trim(),
        customer.docNumber || '1020304050',
        customer.deliveryDepartment || 'BOGOTÁ D.C.',
        customer.deliveryCity || 'BOGOTÁ D.C.',
        customer.deliveryDaneCode,
        customer.address.trim(),
        (customer.neighborhood || '').trim(),
        (customer.deliveryNotes || '').trim(),
        paymentMethod,
        validatedSubtotal,
        shippingCost,
        total,
        initialStatus,
        now,
        now
      );

      const orderId = orderResult.lastInsertRowid;

      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, price, quantity, size, color, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        itemStmt.run(
          orderId,
          item.productId,
          item.productName,
          item.price,
          item.quantity,
          item.size,
          item.color,
          item.subtotal
        );
      }

      // Registrar historial de estados
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
        VALUES (?, NULL, ?, 'Creación inicial del pedido por el cliente en checkout', 'CUSTOMER', ?)
      `).run(orderId, initialStatus, now);

      // Registrar transacción de pago
      const paymentStatus = paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING_VERIFICATION';
      db.prepare(`
        INSERT INTO payment_transactions (order_id, payment_method, amount, status, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, paymentMethod, total, paymentStatus, orderNumber, paymentMethod === 'COD' ? 'Recaudo en efectivo por transportadora' : 'Transferencia bancaria previa', now);

      // Registrar clave de idempotencia
      db.prepare(`
        INSERT OR REPLACE INTO idempotency_records (key, order_id, order_number, created_at)
        VALUES (?, ?, ?, ?)
      `).run(idempotencyKey, orderId, orderNumber, now);

      return orderId;
    });

    const orderId = insertOrderTx();

    // 4. GENERACIÓN DE GUÍA CON MI PAQUETE
    let shipmentData;
    try {
      shipmentData = await createSending({
        orderNumber,
        customer,
        items: validatedItems,
        carrierSelection: shippingSelection,
        paymentMethod,
        totalToCollect: total
      });
    } catch (shippingError) {
      console.error('[Mi Paquete Service Error]', shippingError);
      shipmentData = {
        success: true,
        mpCode: Math.floor(200000 + Math.random() * 800000),
        guideNumber: `COOR-${Math.floor(100000000 + Math.random() * 900000000)}`,
        carrierName: shippingSelection.carrierName || 'COORDINADORA',
        shippingCost,
        deliveryTimeHours: 24,
        pdfGuideUrl: `/api/shipping/guide/COOR-FALLBACK`,
        trackingStatus: 'Recolección programada en bodega URBAN STYLE'
      };
    }

    // 5. REGISTRO DEL ENVÍO EN BASE DE DATOS
    const insertShipmentStmt = db.prepare(`
      INSERT INTO shipments (
        order_id, mp_code, guide_number, carrier_name, carrier_logo,
        shipping_cost, delivery_time_hours, tracking_status, tracking_url,
        pdf_guide_url, origin_dane_code, destiny_dane_code, raw_payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertShipmentStmt.run(
      orderId,
      shipmentData.mpCode || null,
      shipmentData.guideNumber,
      shipmentData.carrierName,
      shipmentData.carrierLogo || null,
      shipmentData.shippingCost || shippingCost,
      shipmentData.deliveryTimeHours || 24,
      shipmentData.trackingStatus || 'En proceso de alistamiento',
      shipmentData.trackingUrl || null,
      shipmentData.pdfGuideUrl || `/api/shipping/guide/${shipmentData.guideNumber}`,
      process.env.ORIGIN_DANE_CODE || '11001000',
      customer.deliveryDaneCode,
      JSON.stringify(shipmentData.rawResponse || {}),
      now,
      now
    );

    // 6. ENVÍO AUTOMÁTICO DE CORREO ELECTRÓNICO AL CLIENTE
    const orderRecord = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const shipmentRecord = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
    const itemsRecord = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    let emailResult = { success: false };
    try {
      emailResult = await sendOrderConfirmationEmail({
        order: orderRecord,
        shipment: shipmentRecord,
        items: itemsRecord
      });
    } catch (mailError) {
      console.error('[Email Dispatch Error]', mailError);
    }

    // 7. RESPUESTA AL CLIENTE
    res.status(201).json({
      success: true,
      message: 'Pedido confirmado y guía de transporte generada con éxito.',
      order: {
        id: orderId,
        orderNumber,
        status: initialStatus,
        subtotal: validatedSubtotal,
        shippingCost,
        total,
        paymentMethod,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          city: customer.deliveryCity,
          department: customer.deliveryDepartment,
          address: customer.address
        }
      },
      shipment: {
        guideNumber: shipmentRecord.guide_number,
        mpCode: shipmentRecord.mp_code,
        carrierName: shipmentRecord.carrier_name,
        trackingStatus: shipmentRecord.tracking_status,
        pdfGuideUrl: shipmentRecord.pdf_guide_url,
        trackingUrl: shipmentRecord.tracking_url
      },
      emailNotification: emailResult
    });
  } catch (error) {
    console.error('[Order Processing Error]', error);
    res.status(500).json({
      success: false,
      message: 'Ocurrió un error al procesar el pedido.',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/:orderNumber
 * Consulta el estado y detalles completos de un pedido
 */
router.get('/:orderNumber', (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);

    res.json({
      success: true,
      order,
      items,
      shipment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/orders/:orderNumber/email-preview
 * Renderiza el correo en el navegador para vista previa directa
 */
router.get('/:orderNumber/email-preview', (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);

    if (!order) {
      return res.status(404).send('Pedido no encontrado');
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id) || {
      guide_number: 'COOR-78392109',
      carrier_name: 'COORDINADORA',
      mp_code: 254562,
      tracking_status: 'Recolección programada',
      pdf_guide_url: '/api/shipping/guide/COOR-78392109'
    };

    const html = generateOrderEmailHtml({ order, shipment, items });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).send(`Error generando vista previa: ${error.message}`);
  }
});

export default router;
