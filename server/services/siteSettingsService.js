import { db } from '../db/database.js';
import { getNeonPool } from '../db/neon.js';

export const DEFAULT_SITE_SETTINGS = {
  storeName: 'URBAN STYLE',
  tagline: 'TU ESTILO. TUS REGLAS.',
  description: 'Tienda de moda urbana contemporánea para hombres y mujeres. Diseños que combinan comodidad, actitud y autenticidad sin límites.',
  contactEmail: 'contacto@urbanstyle.com.co',
  contactPhone: '',
  contactWhatsapp: '',
  whatsappMessage: '¡Hola URBAN STYLE! Me gustaría recibir información sobre sus productos y envíos.',
  contactHours: 'Lunes a Sábado: 9:00 AM – 7:00 PM (Hora Colombia)',
  city: 'Bogotá D.C., Colombia',
  address: '',
  businessName: '',
  nit: '',
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: ''
  },
  cookiesPolicyVersion: '1.0'
};

const SETTINGS_KEY = 'site_settings';

/**
 * Obtiene la configuración del sitio unificada y saneada
 */
export async function getSiteSettings() {
  let settings = { ...DEFAULT_SITE_SETTINGS };

  // 1. Intentar desde Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT value FROM store_settings WHERE key = $1', [SETTINGS_KEY]);
      if (res.rows?.[0]?.value) {
        const parsed = JSON.parse(res.rows[0].value);
        settings = deepMerge(settings, parsed);
        return settings;
      }
    } catch (err) {
      console.warn('[Neon getSiteSettings Notice]:', err.message);
    }
  }

  // 2. Fallback SQLite
  try {
    const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(SETTINGS_KEY);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      settings = deepMerge(settings, parsed);
    }
  } catch (err) {
    console.warn('[SQLite getSiteSettings Notice]:', err.message);
  }

  return settings;
}

/**
 * Actualiza la configuración del sitio en Neon y SQLite
 */
export async function updateSiteSettings(incomingData = {}) {
  const current = await getSiteSettings();
  const updated = deepMerge(current, incomingData);
  const jsonStr = JSON.stringify(updated);
  const now = new Date().toISOString();

  // Guardar en SQLite
  try {
    db.prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(SETTINGS_KEY, jsonStr, now);
  } catch (err) {
    console.error('[SQLite updateSiteSettings Error]:', err.message);
  }

  // Guardar en Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO store_settings (key, value, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `, [SETTINGS_KEY, jsonStr, now]);
    } catch (err) {
      console.warn('[Neon updateSiteSettings Warning]:', err.message);
    }
  }

  return updated;
}

/**
 * Utilidad recursiva para mezclar objetos sin perder subclaves
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      key in target &&
      typeof target[key] === 'object'
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}
