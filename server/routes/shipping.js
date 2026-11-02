import express from 'express';
import { quoteShipping, getSendingTracking } from '../services/mipaquete.js';
import { renderPrintableGuideHtml } from '../services/guideGenerator.js';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * POST /api/shipping/quote
 * Cotiza envíos en tiempo real con Mi Paquete v2 para un destino DANE dado
 */
router.post('/quote', async (req, res) => {
  try {
    const { destinyDaneCode, items = [], totalValue = 100000 } = req.body;

    if (!destinyDaneCode) {
      return res.status(400).json({
        success: false,
        message: 'El código DANE de destino es obligatorio para cotizar el envío.'
      });
    }

    const quoteResult = await quoteShipping({
      destinyDaneCode,
      items,
      totalValue
    });

    res.json({
      success: true,
      ...quoteResult
    });
  } catch (error) {
    console.error('[Shipping Route Error]', error);
    res.status(500).json({
      success: false,
      message: 'Error al cotizar envío con transportadora.',
      error: error.message
    });
  }
});

/**
 * GET /api/shipping/tracking/:mpCode
 * Consulta el estado y trazabilidad en Mi Paquete
 */
router.get('/tracking/:mpCode', async (req, res) => {
  try {
    const { mpCode } = req.params;
    const tracking = await getSendingTracking(mpCode);
    res.json({
      success: true,
      data: tracking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error consultando tracking del envío',
      error: error.message
    });
  }
});

/**
 * GET /api/shipping/guide/:guideNumber
 * Genera y sirve la guía oficial de despacho para impresión o descarga PDF
 */
router.get('/guide/:guideNumber', (req, res) => {
  try {
    const { guideNumber } = req.params;

    // Buscar el envío en la base de datos
    const shipment = db.prepare('SELECT * FROM shipments WHERE guide_number = ?').get(guideNumber);

    if (!shipment) {
      // Si se consulta una guía de demostración directa
      const demoOrder = {
        order_number: 'US-2026-DEMO',
        customer_name: 'Cliente',
        customer_surname: 'URBAN STYLE',
        customer_doc: '1020304050',
        customer_phone: '3102345678',
        delivery_address: 'Calle 85 # 13-45',
        delivery_neighborhood: 'Zona Rosa',
        delivery_city: 'BOGOTÁ D.C.',
        delivery_department: 'BOGOTÁ D.C.',
        delivery_dane_code: '11001000',
        delivery_notes: 'Entrega prioritaria',
        payment_method: 'COD',
        total: 249900,
        created_at: new Date().toISOString()
      };
      const demoShipment = {
        guide_number: guideNumber,
        carrier_name: guideNumber.startsWith('SERV') ? 'SERVIENTREGA' : 'COORDINADORA',
        mp_code: 254562,
        shipping_cost: 12500
      };
      const demoItems = [
        { product_name: "Hoodie Essential 'Midnight Raw'", size: 'M', quantity: 1 }
      ];

      const html = renderPrintableGuideHtml({
        order: demoOrder,
        shipment: demoShipment,
        items: demoItems
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(shipment.order_id);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(shipment.order_id);

    const html = renderPrintableGuideHtml({
      order,
      shipment,
      items
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).send(`Error generando guía: ${error.message}`);
  }
});

export default router;
