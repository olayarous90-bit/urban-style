import express from 'express';
import {
  processUserMessage,
  getAssistantSettings,
  getBestsellerProducts
} from '../services/assistantService.js';
import { getSiteSettings } from '../services/siteSettingsService.js';

const router = express.Router();

/**
 * POST /api/assistant/chat
 * Procesa un mensaje conversacional del cliente y devuelve respuesta inteligente + tarjetas de producto
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'El campo "message" es obligatorio.'
      });
    }

    const result = await processUserMessage({
      message,
      sessionId: sessionId || req.cookies?.['session-tracker'] || 'anon'
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Assistant Chat Route Error]:', error);
    res.status(500).json({
      success: false,
      text: 'Ocurrió un error al procesar tu consulta. Por favor, intenta de nuevo o escríbenos directamente por WhatsApp.',
      products: [],
      error: error.message
    });
  }
});

/**
 * GET /api/assistant/settings
 * Configuración pública para inicializar el botón flotante del robot y el modal de chat
 */
router.get('/settings', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=120');
    const settings = await getAssistantSettings();
    const siteSettings = await getSiteSettings();

    res.json({
      success: true,
      data: {
        ...settings,
        whatsappNumber: siteSettings.contactWhatsapp || siteSettings.contactPhone || '3001234567',
        storeName: siteSettings.storeName || 'URBAN STYLE'
      }
    });
  } catch (error) {
    console.error('[Assistant Settings Route Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la configuración del asistente.'
    });
  }
});

/**
 * GET /api/assistant/bestsellers
 * Obtiene los productos más vendidos para sugerencias iniciales
 */
router.get('/bestsellers', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    const limit = parseInt(req.query.limit || '4', 10);
    const bestsellers = await getBestsellerProducts(limit);

    res.json({
      success: true,
      count: bestsellers.length,
      data: bestsellers
    });
  } catch (error) {
    console.error('[Assistant Bestsellers Route Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar los productos más vendidos.'
    });
  }
});

export default router;
