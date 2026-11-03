import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

/**
 * Limpia y normaliza la cadena de conexión de Neon para compatibilidad con pg en Node.js
 */
function getSanitizedConnectionString() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;

  return rawUrl
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require&', '?')
    .replace('?channel_binding=require', '');
}

/**
 * Obtiene o crea el pool de conexiones a Neon PostgreSQL
 */
export function getNeonPool() {
  if (pool) return pool;

  const connectionString = getSanitizedConnectionString();
  if (!connectionString) {
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    keepAlive: true
  });

  pool.on('error', (err) => {
    console.error('[Neon PostgreSQL Pool Error]', err);
  });

  return pool;
}

/**
 * Ejecuta una consulta parametrizada en Neon PostgreSQL
 */
export async function query(text, params = []) {
  const p = getNeonPool();
  if (!p) {
    throw new Error('DATABASE_URL no configurada para Neon PostgreSQL');
  }
  return p.query(text, params);
}

/**
 * Diagnóstico de conexión con Neon PostgreSQL
 */
export async function testNeonConnection() {
  const p = getNeonPool();
  if (!p) {
    return {
      connected: false,
      message: 'DATABASE_URL no encontrada en variables de entorno'
    };
  }

  const startTime = Date.now();
  try {
    const res = await p.query(
      'SELECT NOW() as current_time, version() as version, current_database() as database, current_user as user'
    );
    const latency = Date.now() - startTime;

    return {
      connected: true,
      latencyMs: latency,
      database: res.rows[0].database,
      user: res.rows[0].user,
      version: res.rows[0].version.split(' on ')[0],
      branch: process.env.NEON_BRANCH || 'production',
      currentTime: res.rows[0].current_time
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Inicializa las tablas relacionales de URBAN STYLE en Neon PostgreSQL
 */
export async function initNeonTables() {
  const p = getNeonPool();
  if (!p) return false;

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price INTEGER NOT NULL,
        formatted_price VARCHAR(64),
        image TEXT,
        description TEXT,
        sizes TEXT,
        composition VARCHAR(255),
        color VARCHAR(100),
        stock INTEGER DEFAULT 50,
        is_active BOOLEAN DEFAULT TRUE,
        discount_percent INTEGER DEFAULT 0,
        discount_active BOOLEAN DEFAULT FALSE,
        discount_start_at TIMESTAMPTZ,
        discount_end_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_active BOOLEAN DEFAULT FALSE;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_start_at TIMESTAMPTZ;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_end_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS product_images (
        id VARCHAR(64) PRIMARY KEY,
        product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        mime_type VARCHAR(64) DEFAULT 'image/jpeg',
        storage_key VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_images_sort_order ON product_images(product_id, sort_order ASC);

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(64) UNIQUE NOT NULL,
        customer_name VARCHAR(120) NOT NULL,
        customer_surname VARCHAR(120) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_doc VARCHAR(50) NOT NULL,
        delivery_department VARCHAR(100) NOT NULL,
        delivery_city VARCHAR(100) NOT NULL,
        delivery_dane_code VARCHAR(16) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_neighborhood VARCHAR(150),
        delivery_notes TEXT,
        payment_method VARCHAR(50) NOT NULL,
        subtotal INTEGER NOT NULL,
        shipping_cost INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(64) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        size VARCHAR(30),
        color VARCHAR(50),
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        subtotal INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shipments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        guide_number VARCHAR(100) UNIQUE,
        carrier_name VARCHAR(100) NOT NULL,
        carrier_service_id VARCHAR(100),
        mp_code VARCHAR(100),
        status VARCHAR(64) DEFAULT 'LABEL_GENERATED',
        status_description TEXT,
        pdf_guide_url TEXT,
        tracking_url TEXT,
        origin_city VARCHAR(100) NOT NULL,
        destiny_city VARCHAR(100) NOT NULL,
        destiny_dane_code VARCHAR(16) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        order_number VARCHAR(64),
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        content_preview TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        previous_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        comment TEXT,
        changed_by VARCHAR(100) DEFAULT 'SYSTEM',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS idempotency_records (
        id SERIAL PRIMARY KEY,
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        response_payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS admin_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(128) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(100) NOT NULL,
        username VARCHAR(100),
        success BOOLEAN DEFAULT FALSE,
        attempted_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_attempts_lookup ON admin_login_attempts(ip_address, username, attempted_at);

      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(64) PRIMARY KEY,
        text TEXT NOT NULL,
        link TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        bg_color VARCHAR(30) DEFAULT '',
        text_color VARCHAR(30) DEFAULT '',
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_neon_announcements_order ON announcements(sort_order ASC, is_active);

      CREATE TABLE IF NOT EXISTS store_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    return true;
  } catch (err) {
    console.error('[Neon Tables Init Error]', err);
    return false;
  }
}
