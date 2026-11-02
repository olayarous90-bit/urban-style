import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { db, initDatabase } from './db/database.js';
import { testNeonConnection, initNeonTables } from './db/neon.js';
import locationsRouter from './routes/locations.js';
import shippingRouter from './routes/shipping.js';
import ordersRouter from './routes/orders.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'session-tracker']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Inicializar base de datos local y tablas Neon
initDatabase();
if (process.env.DATABASE_URL) {
  initNeonTables().catch((err) => {
    console.warn('[Neon Bootstrap Notice] No se pudo inicializar Neon en el arranque:', err.message);
  });
}

// 1. RUTA DE SALUD Y DIAGNÓSTICO
app.get('/api/health', async (req, res) => {
  try {
    const productCount = db.prepare('SELECT count(*) as count FROM products').get().count;
    const orderCount = db.prepare('SELECT count(*) as count FROM orders').get().count;

    // Diagnóstico de Neon PostgreSQL
    const neonStatus = await testNeonConnection();

    res.json({
      status: 'UP',
      service: 'URBAN STYLE E-COMMERCE API',
      version: '2.0.0',
      database: {
        engine: 'SQLite3',
        status: 'Connected',
        products: productCount,
        orders: orderCount
      },
      neonPostgreSQL: neonStatus,
      logistics: {
        provider: 'Mi Paquete v2 (Colombia)',
        originCity: process.env.ORIGIN_CITY || 'BOGOTÁ D.C.',
        originDaneCode: process.env.ORIGIN_DANE_CODE || '11001000',
        apiBaseUrl: process.env.MIPAQUETE_BASE_URL || 'https://api-v2.dev.mpr.mipaquete.com',
        apiKeyConfigured: !!(process.env.MIPAQUETE_APIKEY && process.env.MIPAQUETE_APIKEY.length > 5)
      },
      mailer: {
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
        fallbackMode: 'Local HTML Log & Browser Preview'
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// 2. RUTA DE PRODUCTOS DEL CATÁLOGO OFICIAL
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      formattedPrice: p.formatted_price,
      image: p.image,
      description: p.description,
      sizes: p.sizes ? JSON.parse(p.sizes) : ['S', 'M', 'L'],
      composition: p.composition,
      color: p.color,
      stock: p.stock
    }));

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. ENRUTADORES DE LA APLICACIÓN
app.use('/api/locations', locationsRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'Error interno en el servidor de URBAN STYLE',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// Iniciar servidor HTTP en modo standalone (no en Vercel Serverless)
let server = null;
if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 URBAN STYLE Backend API escuchando en puerto :${PORT}`);
    console.log(`📦 Mi Paquete v2 listo | Origen: ${process.env.ORIGIN_CITY || 'BOGOTÁ D.C.'}`);
    console.log(`🔗 Diagnóstico: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });
}

export default app;
