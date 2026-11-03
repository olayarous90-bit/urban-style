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

import { getShipmentByGuide } from '../services/orderService.js';

/**
 * GET /api/shipping/guide/:guideNumber
 * Genera y sirve la guía oficial de despacho para impresión o descarga PDF
 * Consulta autoritativamente en Neon PostgreSQL (y SQLite local)
 */
router.get('/guide/:guideNumber', async (req, res) => {
  try {
    const { guideNumber } = req.params;

    // 1. Consultar envío y pedido autoritativo en Neon PostgreSQL (o SQLite)
    const result = await getShipmentByGuide(guideNumber);

    if (!result || !result.order) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Guía no encontrada - URBAN STYLE</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #111; color: #fff; text-align: center; padding: 60px 20px; }
            .box { max-width: 500px; margin: 0 auto; background: #1c1c1c; border: 1px solid #333; padding: 30px; border-radius: 8px; }
            h1 { color: #FF5A1F; margin-top: 0; }
            p { color: #aaa; line-height: 1.6; }
            a { color: #FF5A1F; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Guía No Encontrada</h1>
            <p>La guía de transporte <strong>${guideNumber}</strong> no se encuentra registrada en la base de datos de URBAN STYLE.</p>
            <p>Verifica el número o consulta el panel administrativo.</p>
            <p><a href="/admin">← Volver al Panel de Administración</a></p>
          </div>
        </body>
        </html>
      `);
    }

    const html = renderPrintableGuideHtml({
      order: result.order,
      shipment: result.shipment,
      items: result.items || []
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).send(`Error generando guía: ${error.message}`);
  }
});

export default router;
