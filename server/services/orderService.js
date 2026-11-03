import { query, getNeonPool } from '../db/neon.js';
import { db } from '../db/database.js';

/**
 * Servicio Centralizado de Pedidos, Envíos y Trazabilidad (URBAN STYLE)
 * Garantiza persistencia autoritativa en Neon PostgreSQL (Nube)
 * con sincronización bidireccional y fallback en SQLite (Local).
 */

/**
 * Sincroniza pedidos existentes de SQLite local a Neon PostgreSQL si Neon está vacío
 */
export async function syncLocalOrdersToNeonIfEmpty() {
  const pool = getNeonPool();
  if (!pool) return;

  try {
    const neonCheck = await query('SELECT count(*) as count FROM orders');
    const neonCount = parseInt(neonCheck.rows[0]?.count || 0, 10);

    if (neonCount === 0) {
      const localOrders = db.prepare('SELECT * FROM orders ORDER BY id ASC').all();
      if (localOrders.length === 0) return;

      console.log(`[Order Sync] Sincronizando ${localOrders.length} pedidos de SQLite a Neon PostgreSQL...`);

      for (const ord of localOrders) {
        // 1. Insertar orden en Neon
        const insertOrderSql = `
          INSERT INTO orders (
            order_number, customer_name, customer_surname, customer_email, customer_phone, customer_doc,
            delivery_department, delivery_city, delivery_dane_code, delivery_address, delivery_neighborhood,
            delivery_notes, payment_method, subtotal, shipping_cost, total, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (order_number) DO NOTHING
          RETURNING id;
        `;
        const res = await query(insertOrderSql, [
          ord.order_number,
          ord.customer_name,
          ord.customer_surname || '',
          ord.customer_email,
          ord.customer_phone,
          ord.customer_doc,
          ord.delivery_department,
          ord.delivery_city,
          ord.delivery_dane_code,
          ord.delivery_address,
          ord.delivery_neighborhood || '',
          ord.delivery_notes || '',
          ord.payment_method,
          ord.subtotal,
          ord.shipping_cost,
          ord.total,
          ord.status,
          ord.created_at,
          ord.updated_at || ord.created_at
        ]);

        const neonOrderId = res.rows[0]?.id;
        if (!neonOrderId) continue;

        // 2. Insertar items
        const localItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(ord.id);
        for (const it of localItems) {
          await query(
            `INSERT INTO order_items (order_id, product_id, product_name, size, color, quantity, unit_price, price, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              neonOrderId,
              it.product_id,
              it.product_name,
              it.size || 'Única',
              it.color || 'Estándar',
              it.quantity,
              it.price || it.unit_price || 0,
              it.price || it.unit_price || 0,
              it.subtotal
            ]
          );
        }

        // 3. Insertar shipment
        const localShipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(ord.id);
        if (localShipment) {
          await query(
            `INSERT INTO shipments (
              order_id, mp_code, guide_number, carrier_name, carrier_logo,
              shipping_cost, delivery_time_hours, tracking_status, tracking_url,
              pdf_guide_url, origin_city, origin_dane_code, destiny_city, destiny_dane_code,
              raw_payload, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (guide_number) DO NOTHING`,
            [
              neonOrderId,
              localShipment.mp_code,
              localShipment.guide_number,
              localShipment.carrier_name,
              localShipment.carrier_logo,
              localShipment.shipping_cost,
              localShipment.delivery_time_hours || 24,
              localShipment.tracking_status || 'En preparación',
              localShipment.tracking_url,
              localShipment.pdf_guide_url,
              'BOGOTÁ D.C.',
              localShipment.origin_dane_code || '11001000',
              ord.delivery_city,
              ord.delivery_dane_code,
              localShipment.raw_payload ? JSON.stringify(localShipment.raw_payload) : '{}',
              localShipment.created_at,
              localShipment.updated_at || localShipment.created_at
            ]
          );
        }
      }
      console.log(`[Order Sync] Sincronización a Neon PostgreSQL completada exitosamente.`);
    }
  } catch (err) {
    console.warn(`[Order Sync Warning] No se pudo sincronizar SQLite a Neon:`, err.message);
  }
}

/**
 * Comprueba idempotencia antes de crear una orden
 */
export async function checkIdempotency(key) {
  if (!key) return null;

  // 1. Comprobar en Neon
  try {
    const res = await query(
      'SELECT r.*, o.order_number, o.id as db_order_id FROM idempotency_records r JOIN orders o ON r.order_id = o.id WHERE r.key = $1 OR r.idempotency_key = $1 LIMIT 1',
      [key]
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return await getAdminOrderDetails(row.order_number);
    }
  } catch (neonErr) {
    console.warn('[Idempotency Neon Check Error]', neonErr.message);
  }

  // 2. Fallback SQLite
  try {
    const local = db.prepare('SELECT * FROM idempotency_records WHERE key = ?').get(key);
    if (local && local.order_number) {
      return await getAdminOrderDetails(local.order_number);
    }
  } catch (localErr) {
    // ignorar
  }

  return null;
}

/**
 * Crea una orden completa y sus items en Neon PostgreSQL (y espejo SQLite)
 */
export async function createOrder({
  orderNumber,
  customer,
  items,
  shippingSelection,
  paymentMethod = 'COD',
  validatedSubtotal,
  shippingCost,
  total,
  initialStatus = 'PROCESSING',
  idempotencyKey = null
}) {
  const now = new Date().toISOString();
  let neonOrderId = null;
  let sqliteOrderId = null;

  // 1. Guardar en Neon PostgreSQL (Autoritativo para Vercel Serverless)
  try {
    const insertOrderSql = `
      INSERT INTO orders (
        order_number, customer_name, customer_surname, customer_email, customer_phone, customer_doc,
        delivery_department, delivery_city, delivery_dane_code, delivery_address, delivery_neighborhood,
        delivery_notes, payment_method, subtotal, shipping_cost, total, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *;
    `;

    const res = await query(insertOrderSql, [
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
    ]);

    const createdOrder = res.rows[0];
    neonOrderId = createdOrder.id;

    // Insertar items en Neon
    for (const item of items) {
      await query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, size, color, quantity, unit_price, price, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          neonOrderId,
          item.productId || item.id,
          item.productName || item.name,
          item.size || 'Única',
          item.color || 'Estándar',
          item.quantity,
          item.price,
          item.price,
          item.subtotal || item.price * item.quantity
        ]
      );
    }

    // Registrar historial de estado en Neon
    await query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
       VALUES ($1, NULL, $2, 'Creación oficial del pedido en checkout', 'CUSTOMER', $3)`,
      [neonOrderId, initialStatus, now]
    );

    // Registrar pago preliminar en Neon
    const paymentStatus = paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING_VERIFICATION';
    await query(
      `INSERT INTO payment_transactions (order_id, payment_method, amount, status, reference, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        neonOrderId,
        paymentMethod,
        total,
        paymentStatus,
        orderNumber,
        paymentMethod === 'COD' ? 'Recaudo en efectivo por transportadora' : 'Transferencia bancaria previa',
        now
      ]
    );

    // Registrar idempotencia en Neon
    if (idempotencyKey) {
      await query(
        `INSERT INTO idempotency_records (idempotency_key, key, order_id, order_number, created_at)
         VALUES ($1, $1, $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [idempotencyKey, neonOrderId, orderNumber, now]
      );
    }
  } catch (neonError) {
    console.error('[OrderService Neon Write Error]', neonError);
    // Si falla Neon y estamos en local, SQLite nos respalda
  }

  // 2. Espejo en SQLite (Local dev cache y redundancia)
  try {
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        order_number, customer_name, customer_surname, customer_email, customer_phone, customer_doc,
        delivery_department, delivery_city, delivery_dane_code, delivery_address, delivery_neighborhood,
        delivery_notes, payment_method, subtotal, shipping_cost, total, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const localRes = orderStmt.run(
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

    sqliteOrderId = localRes.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, price, quantity, size, color, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      itemStmt.run(
        sqliteOrderId,
        item.productId || item.id,
        item.productName || item.name,
        item.price,
        item.quantity,
        item.size || 'Única',
        item.color || 'Estándar',
        item.subtotal || item.price * item.quantity
      );
    }

    db.prepare(`
      INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
      VALUES (?, NULL, ?, 'Creación inicial del pedido por el cliente en checkout', 'CUSTOMER', ?)
    `).run(sqliteOrderId, initialStatus, now);

    const paymentStatus = paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING_VERIFICATION';
    db.prepare(`
      INSERT INTO payment_transactions (order_id, payment_method, amount, status, reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sqliteOrderId, paymentMethod, total, paymentStatus, orderNumber, paymentMethod === 'COD' ? 'Recaudo en efectivo por transportadora' : 'Transferencia bancaria previa', now);

    if (idempotencyKey) {
      db.prepare(`
        INSERT OR REPLACE INTO idempotency_records (key, order_id, order_number, created_at)
        VALUES (?, ?, ?, ?)
      `).run(idempotencyKey, sqliteOrderId, orderNumber, now);
    }
  } catch (sqliteErr) {
    console.warn('[OrderService SQLite Write Warning]', sqliteErr.message);
  }

  return {
    neonOrderId,
    sqliteOrderId,
    orderNumber,
    customer,
    items,
    total,
    status: initialStatus,
    createdAt: now
  };
}

/**
 * Guarda o actualiza el despacho / guía de transporte en Neon PostgreSQL (y SQLite)
 */
export async function saveShipment({
  orderNumber,
  neonOrderId,
  sqliteOrderId,
  shipmentData,
  shippingCost = 0,
  customer
}) {
  const now = new Date().toISOString();
  let resolvedNeonOrderId = neonOrderId;
  let resolvedSqliteOrderId = sqliteOrderId;

  // Si no tenemos los IDs directos, buscarlos por orderNumber
  if (!resolvedNeonOrderId) {
    try {
      const res = await query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
      if (res.rows[0]) resolvedNeonOrderId = res.rows[0].id;
    } catch (e) {}
  }
  if (!resolvedSqliteOrderId) {
    try {
      const local = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);
      if (local) resolvedSqliteOrderId = local.id;
    } catch (e) {}
  }

  // 1. Guardar en Neon PostgreSQL
  if (resolvedNeonOrderId) {
    try {
      const sql = `
        INSERT INTO shipments (
          order_id, mp_code, guide_number, carrier_name, carrier_logo,
          shipping_cost, delivery_time_hours, tracking_status, tracking_url,
          pdf_guide_url, origin_city, origin_dane_code, destiny_city, destiny_dane_code,
          raw_payload, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (guide_number) DO UPDATE SET
          tracking_status = EXCLUDED.tracking_status,
          tracking_url = EXCLUDED.tracking_url,
          pdf_guide_url = EXCLUDED.pdf_guide_url,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;

      await query(sql, [
        resolvedNeonOrderId,
        shipmentData.mpCode || null,
        shipmentData.guideNumber,
        shipmentData.carrierName || 'COORDINADORA',
        shipmentData.carrierLogo || null,
        shipmentData.shippingCost || shippingCost,
        shipmentData.deliveryTimeHours || 24,
        shipmentData.trackingStatus || 'Recolección programada en bodega URBAN STYLE',
        shipmentData.trackingUrl || `https://mipaquete.com/seguimiento?guia=${shipmentData.guideNumber}`,
        shipmentData.pdfGuideUrl || `/api/shipping/guide/${shipmentData.guideNumber}`,
        process.env.ORIGIN_CITY || 'BOGOTÁ D.C.',
        process.env.ORIGIN_DANE_CODE || '11001000',
        customer?.deliveryCity || 'BOGOTÁ D.C.',
        customer?.deliveryDaneCode || '11001000',
        JSON.stringify(shipmentData.rawResponse || {}),
        now,
        now
      ]);
    } catch (neonErr) {
      console.error('[OrderService Neon Shipment Error]', neonErr);
    }
  }

  // 2. Guardar en SQLite
  if (resolvedSqliteOrderId) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO shipments (
          order_id, mp_code, guide_number, carrier_name, carrier_logo,
          shipping_cost, delivery_time_hours, tracking_status, tracking_url,
          pdf_guide_url, origin_dane_code, destiny_dane_code, raw_payload, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        resolvedSqliteOrderId,
        shipmentData.mpCode || null,
        shipmentData.guideNumber,
        shipmentData.carrierName,
        shipmentData.carrierLogo || null,
        shipmentData.shippingCost || shippingCost,
        shipmentData.deliveryTimeHours || 24,
        shipmentData.trackingStatus || 'Recolección programada en bodega URBAN STYLE',
        shipmentData.trackingUrl || `https://mipaquete.com/seguimiento?guia=${shipmentData.guideNumber}`,
        shipmentData.pdfGuideUrl || `/api/shipping/guide/${shipmentData.guideNumber}`,
        process.env.ORIGIN_DANE_CODE || '11001000',
        customer?.deliveryDaneCode || '11001000',
        JSON.stringify(shipmentData.rawResponse || {}),
        now,
        now
      );
    } catch (sqliteErr) {
      console.warn('[OrderService SQLite Shipment Warning]', sqliteErr.message);
    }
  }

  return {
    guideNumber: shipmentData.guideNumber,
    carrierName: shipmentData.carrierName,
    carrierLogo: shipmentData.carrierLogo,
    trackingStatus: shipmentData.trackingStatus || 'Recolección programada en bodega URBAN STYLE',
    trackingUrl: shipmentData.trackingUrl || `https://mipaquete.com/seguimiento?guia=${shipmentData.guideNumber}`,
    pdfGuideUrl: shipmentData.pdfGuideUrl || `/api/shipping/guide/${shipmentData.guideNumber}`
  };
}

/**
 * Consulta de pedidos para el Panel Administrativo (Neon PostgreSQL + fallback SQLite)
 */
export async function getAdminOrdersList({ status, search }) {
  // 1. Intentar consultar Neon PostgreSQL
  try {
    let sql = `
      SELECT o.*,
             s.guide_number, s.carrier_name, s.tracking_status, s.pdf_guide_url, s.tracking_url, s.mp_code,
             s.shipping_cost as shipment_shipping_cost
      FROM orders o
      LEFT JOIN shipments s ON o.id = s.order_id
    `;
    const params = [];
    const conditions = [];

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      params.push(term);
      const idx = params.length;
      conditions.push(`(
        o.order_number ILIKE $${idx} OR
        o.customer_name ILIKE $${idx} OR
        o.customer_surname ILIKE $${idx} OR
        o.customer_email ILIKE $${idx} OR
        s.guide_number ILIKE $${idx} OR
        o.customer_phone ILIKE $${idx} OR
        o.customer_doc ILIKE $${idx}
      )`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY o.id DESC';

    const res = await query(sql, params);
    const orders = res.rows;

    if (orders.length > 0) {
      // Cargar items en masa para todas las órdenes devueltas
      const orderIds = orders.map((o) => o.id);
      const itemsRes = await query(
        `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id ASC`,
        [orderIds]
      );

      const itemsByOrderId = {};
      itemsRes.rows.forEach((it) => {
        if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
        itemsByOrderId[it.order_id].push({
          ...it,
          price: it.price || it.unit_price || 0
        });
      });

      // Cargar correos en masa
      let emailsByOrderId = {};
      try {
        const emailsRes = await query(
          `SELECT * FROM email_logs WHERE order_id = ANY($1) ORDER BY id DESC`,
          [orderIds]
        );
        emailsRes.rows.forEach((em) => {
          if (!emailsByOrderId[em.order_id]) emailsByOrderId[em.order_id] = [];
          emailsByOrderId[em.order_id].push(em);
        });
      } catch (e) {}

      return orders.map((o) => {
        const orderEmails = emailsByOrderId[o.id] || [];
        const placedEmail = orderEmails.find((e) => e.email_type === 'ORDER_CONFIRMATION');
        const shippingEmail = orderEmails.find((e) => e.email_type === 'SHIPPING_NOTIFICATION');

        return {
          ...o,
          items: itemsByOrderId[o.id] || [],
          email_recipient: o.customer_email,
          order_placed_email_status: placedEmail ? placedEmail.status : 'PENDING_CONFIG',
          order_placed_email_sent_at: placedEmail ? placedEmail.sent_at : null,
          order_placed_email_error: placedEmail ? placedEmail.error_message : null,
          order_placed_email_message_id: placedEmail ? placedEmail.message_id : null,
          order_placed_email_preview_url: placedEmail ? placedEmail.preview_url : null,
          shipping_email_status: shippingEmail ? shippingEmail.status : (o.guide_number ? 'PENDING_CONFIG' : 'NOT_DISPATCHED'),
          shipping_email_sent_at: shippingEmail ? shippingEmail.sent_at : null,
          shipping_email_error: shippingEmail ? shippingEmail.error_message : null,
          shipping_email_message_id: shippingEmail ? shippingEmail.message_id : null,
          shipping_email_preview_url: shippingEmail ? shippingEmail.preview_url : null,
          email_last_sent: (placedEmail || shippingEmail) ? (shippingEmail?.sent_at || placedEmail?.sent_at) : null
        };
      });
    }

    // Si Neon retornó 0 órdenes, verificar si en SQLite hay órdenes para sincronizar
    const localCount = db.prepare('SELECT count(*) as count FROM orders').get().count;
    if (localCount > 0) {
      console.log(`[OrderService] Neon tiene 0 órdenes pero SQLite tiene ${localCount}. Iniciando sincronización...`);
      await syncLocalOrdersToNeonIfEmpty();
      // Reintentar consulta Neon una vez más
      const retryRes = await query(sql, params);
      if (retryRes.rows.length > 0) {
        const retryOrders = retryRes.rows;
        const orderIds = retryOrders.map((o) => o.id);
        const itemsRes = await query(
          `SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id ASC`,
          [orderIds]
        );
        const itemsByOrderId = {};
        itemsRes.rows.forEach((it) => {
          if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
          itemsByOrderId[it.order_id].push({ ...it, price: it.price || it.unit_price || 0 });
        });
        return retryOrders.map((o) => ({
          ...o,
          items: itemsByOrderId[o.id] || []
        }));
      }
    }

    return [];
  } catch (neonErr) {
    console.warn('[OrderService Neon Query Fallback to SQLite]', neonErr.message);
  }

  // 2. Fallback SQLite
  try {
    let sql = `
      SELECT o.*, s.guide_number, s.carrier_name, s.tracking_status, s.pdf_guide_url, s.tracking_url
      FROM orders o
      LEFT JOIN shipments s ON o.id = s.order_id
    `;
    const params = [];
    const conditions = [];

    if (status && status !== 'ALL') {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (search && search.trim()) {
      conditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR s.guide_number LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY o.id DESC';

    const orders = db.prepare(sql).all(...params);
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const getEmails = db.prepare('SELECT * FROM email_logs WHERE order_id = ? ORDER BY id DESC');

    return orders.map((ord) => {
      const orderEmails = getEmails.all(ord.id) || [];
      const placedEmail = orderEmails.find((e) => e.email_type === 'ORDER_CONFIRMATION');
      const shippingEmail = orderEmails.find((e) => e.email_type === 'SHIPPING_NOTIFICATION');

      return {
        ...ord,
        items: getItems.all(ord.id),
        email_recipient: ord.customer_email,
        order_placed_email_status: placedEmail ? placedEmail.status : 'PENDING_CONFIG',
        order_placed_email_sent_at: placedEmail ? placedEmail.sent_at : null,
        order_placed_email_error: placedEmail ? placedEmail.error_message : null,
        order_placed_email_message_id: placedEmail ? placedEmail.message_id : null,
        order_placed_email_preview_url: placedEmail ? placedEmail.preview_url : null,
        shipping_email_status: shippingEmail ? shippingEmail.status : (ord.guide_number ? 'PENDING_CONFIG' : 'NOT_DISPATCHED'),
        shipping_email_sent_at: shippingEmail ? shippingEmail.sent_at : null,
        shipping_email_error: shippingEmail ? shippingEmail.error_message : null,
        shipping_email_message_id: shippingEmail ? shippingEmail.message_id : null,
        shipping_email_preview_url: shippingEmail ? shippingEmail.preview_url : null,
        email_last_sent: (placedEmail || shippingEmail) ? (shippingEmail?.sent_at || placedEmail?.sent_at) : null
      };
    });
  } catch (sqliteErr) {
    console.error('[OrderService SQLite Query Error]', sqliteErr);
    return [];
  }
}

/**
 * Consulta detallada de una orden por orderNumber (Neon PostgreSQL + SQLite fallback)
 */
export async function getAdminOrderDetails(orderNumber) {
  // 1. Intentar en Neon
  try {
    const orderRes = await query('SELECT * FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRes.rows.length > 0) {
      const order = orderRes.rows[0];
      const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [order.id]);
      const shipmentRes = await query('SELECT * FROM shipments WHERE order_id = $1 LIMIT 1', [order.id]);
      const historyRes = await query('SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY id ASC', [order.id]);
      const paymentsRes = await query('SELECT * FROM payment_transactions WHERE order_id = $1 ORDER BY id ASC', [order.id]);
      const emailsRes = await query('SELECT * FROM email_logs WHERE order_id = $1 OR order_number = $2 ORDER BY id DESC', [order.id, orderNumber]);

      return {
        order,
        items: itemsRes.rows.map((i) => ({ ...i, price: i.price || i.unit_price || 0 })),
        shipment: shipmentRes.rows[0] || null,
        history: historyRes.rows,
        payments: paymentsRes.rows,
        emails: emailsRes.rows
      };
    }
  } catch (neonErr) {
    console.warn('[OrderService Neon Details Fallback]', neonErr.message);
  }

  // 2. Fallback SQLite
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    if (!order) return null;

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id);
    const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC').all(order.id);
    const payments = db.prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY id ASC').all(order.id);
    const emails = db.prepare('SELECT * FROM email_logs WHERE order_id = ? OR order_number = ? ORDER BY id DESC').all(order.id, orderNumber);

    return {
      order,
      items,
      shipment: shipment || null,
      history,
      payments,
      emails
    };
  } catch (sqliteErr) {
    console.error('[OrderService SQLite Details Error]', sqliteErr);
    return null;
  }
}

/**
 * Actualiza el estado de una orden
 */
export async function updateOrderStatus(orderNumber, newStatus, comment = '', changedBy = 'ADMIN') {
  const now = new Date().toISOString();

  // 1. Neon PostgreSQL
  try {
    const orderRes = await query('SELECT * FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRes.rows.length > 0) {
      const order = orderRes.rows[0];
      await query('UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3', [newStatus, now, order.id]);

      await query(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, order.status, newStatus, comment || `Estado cambiado a ${newStatus} por ${changedBy}`, changedBy, now]
      );

      if (newStatus === 'SHIPPED') {
        await query('UPDATE shipments SET tracking_status = $1, updated_at = $2 WHERE order_id = $3', [
          'Despachado y en tránsito con transportadora',
          now,
          order.id
        ]);
      } else if (newStatus === 'CANCELLED') {
        await query('UPDATE shipments SET tracking_status = $1, updated_at = $2 WHERE order_id = $3', [
          'Envío cancelado',
          now,
          order.id
        ]);
      }
    }
  } catch (neonErr) {
    console.warn('[OrderService Neon Status Update Error]', neonErr.message);
  }

  // 2. SQLite
  try {
    const localOrder = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
    if (localOrder) {
      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, localOrder.id);
      db.prepare(`
        INSERT INTO order_status_history (order_id, previous_status, new_status, comment, changed_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(localOrder.id, localOrder.status, newStatus, comment || `Estado cambiado a ${newStatus} por ${changedBy}`, changedBy, now);

      if (newStatus === 'SHIPPED') {
        db.prepare('UPDATE shipments SET tracking_status = ?, updated_at = ? WHERE order_id = ?')
          .run('Despachado y en tránsito con transportadora', now, localOrder.id);
      } else if (newStatus === 'CANCELLED') {
        db.prepare('UPDATE shipments SET tracking_status = ?, updated_at = ? WHERE order_id = ?')
          .run('Envío cancelado', now, localOrder.id);
      }
    }
  } catch (sqliteErr) {
    console.warn('[OrderService SQLite Status Update Warning]', sqliteErr.message);
  }

  return true;
}

/**
 * Obtiene métricas y estadísticas comerciales (Neon PostgreSQL + fallback SQLite)
 */
export async function getAdminStatsData() {
  // 1. Neon PostgreSQL
  try {
    const ordersRes = await query('SELECT count(*) as count FROM orders');
    const totalOrders = parseInt(ordersRes.rows[0]?.count || 0, 10);

    const revRes = await query("SELECT coalesce(sum(total), 0) as total FROM orders WHERE status != 'CANCELLED'");
    const revenue = parseInt(revRes.rows[0]?.total || 0, 10);

    const pendRes = await query("SELECT count(*) as count FROM orders WHERE status IN ('PENDING_PAYMENT', 'PROCESSING')");
    const pendingOrders = parseInt(pendRes.rows[0]?.count || 0, 10);

    const shipRes = await query("SELECT count(*) as count FROM orders WHERE status = 'SHIPPED'");
    const shippedOrders = parseInt(shipRes.rows[0]?.count || 0, 10);

    const itemsRes = await query('SELECT coalesce(sum(quantity), 0) as count FROM order_items');
    const totalItems = parseInt(itemsRes.rows[0]?.count || 0, 10);

    const emailRes = await query('SELECT count(*) as count FROM email_logs');
    const emailLogsCount = parseInt(emailRes.rows[0]?.count || 0, 10);

    return {
      totalOrders,
      revenue,
      formattedRevenue: `$${revenue.toLocaleString('es-CO')} COP`,
      pendingOrders,
      shippedOrders,
      totalItems,
      emailLogsCount,
      source: 'NEON_POSTGRESQL'
    };
  } catch (neonErr) {
    console.warn('[OrderService Neon Stats Fallback]', neonErr.message);
  }

  // 2. SQLite Fallback
  try {
    const totalOrders = db.prepare('SELECT count(*) as count FROM orders').get().count;
    const revenue = db.prepare("SELECT coalesce(sum(total), 0) as total FROM orders WHERE status != 'CANCELLED'").get().total;
    const pendingOrders = db.prepare("SELECT count(*) as count FROM orders WHERE status IN ('PENDING_PAYMENT', 'PROCESSING')").get().count;
    const shippedOrders = db.prepare("SELECT count(*) as count FROM orders WHERE status = 'SHIPPED'").get().count;
    const totalItems = db.prepare('SELECT coalesce(sum(quantity), 0) as count FROM order_items').get().count;
    const emailLogsCount = db.prepare('SELECT count(*) as count FROM email_logs').get().count;

    return {
      totalOrders,
      revenue,
      formattedRevenue: `$${revenue.toLocaleString('es-CO')} COP`,
      pendingOrders,
      shippedOrders,
      totalItems,
      emailLogsCount,
      source: 'SQLITE_LOCAL'
    };
  } catch (sqliteErr) {
    return {
      totalOrders: 0,
      revenue: 0,
      formattedRevenue: '$0 COP',
      pendingOrders: 0,
      shippedOrders: 0,
      totalItems: 0,
      emailLogsCount: 0
    };
  }
}

/**
 * Consulta el envío y su pedido asociado por número de guía (Neon PostgreSQL + SQLite)
 */
export async function getShipmentByGuide(guideNumber) {
  if (!guideNumber) return null;

  // 1. Neon PostgreSQL
  try {
    const shipmentRes = await query('SELECT * FROM shipments WHERE guide_number = $1', [guideNumber]);
    if (shipmentRes.rows.length > 0) {
      const shipment = shipmentRes.rows[0];
      const orderRes = await query('SELECT * FROM orders WHERE id = $1', [shipment.order_id]);
      if (orderRes.rows.length > 0) {
        const order = orderRes.rows[0];
        const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
        return {
          shipment,
          order,
          items: itemsRes.rows.map((i) => ({ ...i, price: i.price || i.unit_price || 0 }))
        };
      }
    }
  } catch (neonErr) {
    console.warn('[OrderService Neon Guide Lookup Fallback]', neonErr.message);
  }

  // 2. SQLite
  try {
    const shipment = db.prepare('SELECT * FROM shipments WHERE guide_number = ?').get(guideNumber);
    if (shipment) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(shipment.order_id);
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(shipment.order_id);
      if (order) {
        return { shipment, order, items };
      }
    }
  } catch (sqliteErr) {
    console.warn('[OrderService SQLite Guide Lookup Error]', sqliteErr.message);
  }

  return null;
}

/**
 * Consulta de registros de correos para el panel de administración
 */
export async function getAdminEmailLogs(limit = 50) {
  try {
    const res = await query('SELECT * FROM email_logs ORDER BY id DESC LIMIT $1', [limit]);
    if (res.rows.length > 0) {
      return res.rows;
    }
  } catch (neonErr) {
    console.warn('[OrderService Neon Email Logs Fallback]', neonErr.message);
  }

  try {
    return db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT ?').all(limit);
  } catch (e) {
    return [];
  }
}

/**
 * Consulta de todos los despachos con datos del cliente y orden
 */
export async function getAdminShipmentsList() {
  try {
    const res = await query(`
      SELECT s.*, o.order_number, o.customer_name, o.customer_email, o.delivery_city, o.delivery_department, o.total, o.payment_method
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      ORDER BY s.id DESC
    `);
    if (res.rows.length > 0) return res.rows;
  } catch (neonErr) {
    console.warn('[OrderService Neon Shipments Fallback]', neonErr.message);
  }

  try {
    return db.prepare(`
      SELECT s.*, o.order_number, o.customer_name, o.customer_email, o.delivery_city, o.delivery_department, o.total, o.payment_method
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      ORDER BY s.id DESC
    `).all();
  } catch (e) {
    return [];
  }
}

