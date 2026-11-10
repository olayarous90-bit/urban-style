import { db } from '../db/database.js';
import { getNeonPool } from '../db/neon.js';
import { deletePopupImage } from './imageStorageService.js';

export const POPUP_TYPES = [
  { id: 'discount', label: 'Descuentos', badge: 'DESCUENTO ESPECIAL', icon: '🏷️' },
  { id: 'news', label: 'Novedades', badge: 'NUEVA COLECCIÓN', icon: '✦' },
  { id: 'promotion', label: 'Promociones', badge: 'TIEMPO LIMITADO', icon: '🔥' },
  { id: 'launch', label: 'Lanzamientos', badge: 'LANZAMIENTO EXCLUSIVO', icon: '⚡' },
  { id: 'custom', label: 'Personalizado', badge: 'URBAN STYLE', icon: '★' }
];

export const POPUP_FREQUENCIES = [
  { id: 'always', label: 'En cada visita a la tienda' },
  { id: 'once_per_session', label: 'Una vez por sesión del navegador' },
  { id: 'once_per_day', label: 'Una vez al día por visitante' },
  { id: 'once_ever', label: 'Solo una vez por visitante' }
];

export const DEFAULT_POPUP = {
  id: 'pop_default_ofertas_urbanas',
  title: '¡HASTA 30% OFF EN STREETWEAR EXCLUSIVO!',
  description: 'Aprovecha nuestras ofertas por tiempo limitado en hoodies, cargo pants y sneakers. Envíos rápidos y seguros a toda Colombia.',
  type: 'discount',
  badge_text: 'OFERTA ESPECIAL URBAN STYLE',
  image_url: '/images/hero-campaign.jpg',
  image_storage_key: null,
  button_text: 'Ver Ofertas Ahora',
  button_link: '#ofertas',
  secondary_button_text: 'Continuar a la tienda',
  is_active: 1,
  priority: 10,
  frequency: 'always',
  start_date: null,
  end_date: null,
  status: 'active'
};

/**
 * Asegura la existencia de tablas en SQLite y siembra el popup inicial si la tabla está vacía
 */
export function ensurePopupsTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS popups (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'discount',
        badge_text TEXT,
        image_url TEXT,
        image_storage_key TEXT,
        button_text TEXT DEFAULT 'Ver Oferta',
        button_link TEXT DEFAULT '#ofertas',
        secondary_button_text TEXT DEFAULT 'Continuar a la tienda',
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 1,
        frequency TEXT DEFAULT 'always',
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS store_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Sembrar configuración maestra si no existe
    const settingStmt = db.prepare('SELECT value FROM store_settings WHERE key = ?');
    const enabledSetting = settingStmt.get('popup_system_enabled');
    if (!enabledSetting) {
      db.prepare('INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('popup_system_enabled', 'true', new Date().toISOString());
    }

    // Sembrar popup inicial si la tabla está vacía
    const count = db.prepare('SELECT count(*) as count FROM popups').get();
    if (count.count === 0) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO popups (
          id, title, description, type, badge_text, image_url, image_storage_key,
          button_text, button_link, secondary_button_text, is_active, priority,
          frequency, start_date, end_date, status, created_at, updated_at
        ) VALUES (
          @id, @title, @description, @type, @badge_text, @image_url, @image_storage_key,
          @button_text, @button_link, @secondary_button_text, @is_active, @priority,
          @frequency, @start_date, @end_date, @status, @created_at, @updated_at
        )
      `).run({
        ...DEFAULT_POPUP,
        created_at: now,
        updated_at: now
      });

      // Sincronizar también en Neon si está disponible
      syncNeonPopup(`
        INSERT INTO popups (
          id, title, description, type, badge_text, image_url, image_storage_key,
          button_text, button_link, secondary_button_text, is_active, priority,
          frequency, start_date, end_date, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO NOTHING
      `, [
        DEFAULT_POPUP.id, DEFAULT_POPUP.title, DEFAULT_POPUP.description, DEFAULT_POPUP.type,
        DEFAULT_POPUP.badge_text, DEFAULT_POPUP.image_url, DEFAULT_POPUP.image_storage_key,
        DEFAULT_POPUP.button_text, DEFAULT_POPUP.button_link, DEFAULT_POPUP.secondary_button_text,
        true, DEFAULT_POPUP.priority, DEFAULT_POPUP.frequency,
        DEFAULT_POPUP.start_date, DEFAULT_POPUP.end_date, DEFAULT_POPUP.status, now, now
      ]);
    }
  } catch (error) {
    console.error('[PopupService] Error asegurando tablas SQLite:', error.message);
  }
}

/**
 * Sincroniza una operación de anuncios emergentes con Neon PostgreSQL
 */
async function syncNeonPopup(sqlQuery, params = []) {
  try {
    const pool = getNeonPool();
    if (!pool) return;
    await pool.query(sqlQuery, params);
  } catch (err) {
    console.warn('[Neon Sync Popup Warning]', err.message);
  }
}

/**
 * Calcula el estado de vigencia en tiempo real
 */
export function computePopupStatus(popup) {
  if (!popup.is_active || popup.status === 'draft') {
    return 'draft';
  }
  const now = new Date();
  if (popup.start_date) {
    const start = new Date(popup.start_date);
    if (!isNaN(start.getTime()) && now < start) {
      return 'scheduled';
    }
  }
  if (popup.end_date) {
    const end = new Date(popup.end_date);
    if (!isNaN(end.getTime()) && now > end) {
      return 'expired';
    }
  }
  return 'active';
}

/**
 * Normaliza un registro de base de datos a objeto Popup limpio
 */
function formatPopupRow(row) {
  const is_active = Boolean(row.is_active);
  const priority = Number(row.priority || 1);
  const popup = {
    id: row.id,
    title: row.title,
    description: row.description || '',
    type: row.type || 'discount',
    badge_text: row.badge_text || '',
    image_url: row.image_url || '',
    image_storage_key: row.image_storage_key || null,
    button_text: row.button_text || 'Ver Oferta',
    button_link: row.button_link || '#ofertas',
    secondary_button_text: row.secondary_button_text || 'Continuar a la tienda',
    is_active,
    priority,
    frequency: row.frequency || 'always',
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    status: row.status || 'active',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  popup.computed_status = computePopupStatus(popup);
  return popup;
}

/**
 * Obtiene el anuncio emergente activo para la tienda pública
 */
export async function getPublicActivePopup() {
  ensurePopupsTable();

  // 1. Verificar si el sistema de popups está habilitado globalmente
  let systemEnabled = true;
  try {
    const settingRow = db.prepare("SELECT value FROM store_settings WHERE key = 'popup_system_enabled'").get();
    if (settingRow) {
      systemEnabled = settingRow.value === 'true' || settingRow.value === '1';
    }
  } catch {}

  if (!systemEnabled) {
    return { enabled: false, popup: null };
  }

  // 2. Intentar consultar desde Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      const neonRes = await pool.query(`
        SELECT * FROM popups
        WHERE is_active = TRUE AND status != 'draft'
        ORDER BY priority DESC, created_at DESC
      `);
      if (neonRes.rows && neonRes.rows.length > 0) {
        for (const row of neonRes.rows) {
          const formatted = formatPopupRow(row);
          if (formatted.computed_status === 'active') {
            return {
              enabled: true,
              popup: formatted
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Neon getPublicActivePopup Warning]', err.message);
    }
  }

  // 3. Fallback SQLite
  try {
    const rows = db.prepare(`
      SELECT * FROM popups
      WHERE is_active = 1 AND status != 'draft'
      ORDER BY priority DESC, created_at DESC
    `).all();

    for (const row of rows) {
      const formatted = formatPopupRow(row);
      if (formatted.computed_status === 'active') {
        return {
          enabled: true,
          popup: formatted
        };
      }
    }

    return { enabled: true, popup: null };
  } catch (error) {
    console.error('[getPublicActivePopup Error]:', error.message);
    return { enabled: true, popup: null };
  }
}

/**
 * Obtiene todos los anuncios emergentes para el panel de administración
 */
export async function getAllAdminPopups() {
  ensurePopupsTable();

  let systemEnabled = true;
  try {
    const settingRow = db.prepare("SELECT value FROM store_settings WHERE key = 'popup_system_enabled'").get();
    if (settingRow) {
      systemEnabled = settingRow.value === 'true' || settingRow.value === '1';
    }
  } catch {}

  // Intentar Neon primero
  const pool = getNeonPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM popups ORDER BY priority DESC, created_at DESC');
      if (res.rows && res.rows.length > 0) {
        const popups = res.rows.map(formatPopupRow);
        return {
          systemEnabled,
          total: popups.length,
          activeCount: popups.filter((p) => p.computed_status === 'active').length,
          popups
        };
      }
    } catch (err) {
      console.warn('[Neon getAllAdminPopups Warning]', err.message);
    }
  }

  // Fallback SQLite
  const rows = db.prepare('SELECT * FROM popups ORDER BY priority DESC, created_at DESC').all();
  const popups = rows.map(formatPopupRow);

  return {
    systemEnabled,
    total: popups.length,
    activeCount: popups.filter((p) => p.computed_status === 'active').length,
    popups
  };
}

/**
 * Obtiene un anuncio emergente específico por ID
 */
export async function getPopupById(id) {
  ensurePopupsTable();

  const pool = getNeonPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM popups WHERE id = $1', [id]);
      if (res.rows?.[0]) {
        return formatPopupRow(res.rows[0]);
      }
    } catch {}
  }

  const row = db.prepare('SELECT * FROM popups WHERE id = ?').get(id);
  if (!row) return null;
  return formatPopupRow(row);
}

/**
 * Crea un nuevo anuncio emergente
 */
export async function createPopup({
  title,
  description = '',
  type = 'discount',
  badge_text = '',
  image_url = '',
  image_storage_key = null,
  button_text = 'Ver Oferta',
  button_link = '#ofertas',
  secondary_button_text = 'Continuar a la tienda',
  is_active = true,
  priority = 1,
  frequency = 'always',
  start_date = null,
  end_date = null,
  status = 'active'
}) {
  ensurePopupsTable();

  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    throw new Error('El título del anuncio emergente es obligatorio');
  }

  const id = `pop_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  const activeInt = is_active ? 1 : 0;
  const numPriority = Math.max(1, parseInt(priority, 10) || 1);

  // Guardar en SQLite
  db.prepare(`
    INSERT INTO popups (
      id, title, description, type, badge_text, image_url, image_storage_key,
      button_text, button_link, secondary_button_text, is_active, priority,
      frequency, start_date, end_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, cleanTitle, String(description || '').trim(), type || 'discount',
    badge_text ? String(badge_text).trim() : null,
    image_url ? String(image_url).trim() : null,
    image_storage_key || null,
    button_text ? String(button_text).trim() : 'Ver Oferta',
    button_link ? String(button_link).trim() : '#ofertas',
    secondary_button_text ? String(secondary_button_text).trim() : 'Continuar a la tienda',
    activeInt, numPriority, frequency || 'always',
    start_date || null, end_date || null, status || 'active', now, now
  );

  // Sincronizar en Neon PostgreSQL
  syncNeonPopup(`
    INSERT INTO popups (
      id, title, description, type, badge_text, image_url, image_storage_key,
      button_text, button_link, secondary_button_text, is_active, priority,
      frequency, start_date, end_date, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      type = EXCLUDED.type,
      badge_text = EXCLUDED.badge_text,
      image_url = EXCLUDED.image_url,
      image_storage_key = EXCLUDED.image_storage_key,
      button_text = EXCLUDED.button_text,
      button_link = EXCLUDED.button_link,
      secondary_button_text = EXCLUDED.secondary_button_text,
      is_active = EXCLUDED.is_active,
      priority = EXCLUDED.priority,
      frequency = EXCLUDED.frequency,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  `, [
    id, cleanTitle, String(description || '').trim(), type || 'discount',
    badge_text ? String(badge_text).trim() : null,
    image_url ? String(image_url).trim() : null,
    image_storage_key || null,
    button_text ? String(button_text).trim() : 'Ver Oferta',
    button_link ? String(button_link).trim() : '#ofertas',
    secondary_button_text ? String(secondary_button_text).trim() : 'Continuar a la tienda',
    Boolean(activeInt), numPriority, frequency || 'always',
    start_date || null, end_date || null, status || 'active', now, now
  ]);

  return getPopupById(id);
}

/**
 * Actualiza un anuncio emergente existente
 */
export async function updatePopup(id, data = {}) {
  ensurePopupsTable();

  const existing = await getPopupById(id);
  if (!existing) {
    throw new Error(`Anuncio emergente con ID "${id}" no encontrado`);
  }

  const cleanTitle = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!cleanTitle) {
    throw new Error('El título del anuncio emergente no puede estar vacío');
  }

  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const type = data.type !== undefined ? data.type : existing.type;
  const badge_text = data.badge_text !== undefined ? (data.badge_text ? String(data.badge_text).trim() : '') : existing.badge_text;
  const image_url = data.image_url !== undefined ? (data.image_url ? String(data.image_url).trim() : '') : existing.image_url;
  const image_storage_key = data.image_storage_key !== undefined ? data.image_storage_key : existing.image_storage_key;
  const button_text = data.button_text !== undefined ? String(data.button_text).trim() : existing.button_text;
  const button_link = data.button_link !== undefined ? String(data.button_link).trim() : existing.button_link;
  const secondary_button_text = data.secondary_button_text !== undefined ? String(data.secondary_button_text).trim() : existing.secondary_button_text;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : (existing.is_active ? 1 : 0);
  const priority = data.priority !== undefined ? Math.max(1, parseInt(data.priority, 10) || 1) : existing.priority;
  const frequency = data.frequency !== undefined ? data.frequency : existing.frequency;
  const start_date = data.start_date !== undefined ? (data.start_date || null) : existing.start_date;
  const end_date = data.end_date !== undefined ? (data.end_date || null) : existing.end_date;
  const status = data.status !== undefined ? data.status : existing.status;
  const now = new Date().toISOString();

  // Actualizar SQLite
  db.prepare(`
    UPDATE popups SET
      title = ?, description = ?, type = ?, badge_text = ?, image_url = ?, image_storage_key = ?,
      button_text = ?, button_link = ?, secondary_button_text = ?, is_active = ?, priority = ?,
      frequency = ?, start_date = ?, end_date = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    cleanTitle, description, type, badge_text || null, image_url || null, image_storage_key,
    button_text, button_link, secondary_button_text, is_active, priority,
    frequency, start_date, end_date, status, now, id
  );

  // Actualizar Neon PostgreSQL
  syncNeonPopup(`
    UPDATE popups SET
      title = $1, description = $2, type = $3, badge_text = $4, image_url = $5, image_storage_key = $6,
      button_text = $7, button_link = $8, secondary_button_text = $9, is_active = $10, priority = $11,
      frequency = $12, start_date = $13, end_date = $14, status = $15, updated_at = $16
    WHERE id = $17
  `, [
    cleanTitle, description, type, badge_text || null, image_url || null, image_storage_key,
    button_text, button_link, secondary_button_text, Boolean(is_active), priority,
    frequency, start_date, end_date, status, now, id
  ]);

  return getPopupById(id);
}

/**
 * Elimina un anuncio emergente y limpia su imagen en almacenamiento persistente
 */
export async function deletePopup(id) {
  ensurePopupsTable();

  const existing = await getPopupById(id);
  if (!existing) {
    throw new Error(`Anuncio emergente con ID "${id}" no encontrado`);
  }

  // Limpiar imagen persistente si tiene storage key
  if (existing.image_storage_key) {
    try {
      await deletePopupImage(existing.image_storage_key);
    } catch (e) {
      console.warn('[deletePopup Image Cleanup Notice]', e.message);
    }
  }

  // Eliminar en SQLite
  db.prepare('DELETE FROM popups WHERE id = ?').run(id);

  // Eliminar en Neon
  syncNeonPopup('DELETE FROM popups WHERE id = $1', [id]);

  return { success: true, deletedId: id };
}

/**
 * Alterna el estado activo/inactivo de un anuncio emergente
 */
export async function togglePopupStatus(id, isActive) {
  ensurePopupsTable();

  const existing = await getPopupById(id);
  if (!existing) {
    throw new Error(`Anuncio emergente con ID "${id}" no encontrado`);
  }

  const activeInt = isActive ? 1 : 0;
  const now = new Date().toISOString();

  db.prepare('UPDATE popups SET is_active = ?, updated_at = ? WHERE id = ?').run(activeInt, now, id);
  syncNeonPopup('UPDATE popups SET is_active = $1, updated_at = $2 WHERE id = $3', [Boolean(activeInt), now, id]);

  return getPopupById(id);
}

/**
 * Activa o desactiva el sistema global de anuncios emergentes
 */
export async function setPopupSystemEnabled(enabled) {
  ensurePopupsTable();

  const valStr = enabled ? 'true' : 'false';
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('popup_system_enabled', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(valStr, now);

  syncNeonPopup(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('popup_system_enabled', $1, $2)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `, [valStr, now]);

  return { enabled: Boolean(enabled) };
}
