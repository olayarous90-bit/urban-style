import { db } from '../db/database.js';
import { getNeonPool } from '../db/neon.js';

export const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann_envios_colombia',
    text: '¡Envíos a todo Colombia!',
    link: '#beneficios',
    is_active: 1,
    sort_order: 1,
    bg_color: '',
    text_color: '',
    start_date: null,
    end_date: null
  },
  {
    id: 'ann_ofertas_especiales',
    text: '¡Ofertas especiales por tiempo limitado!',
    link: '#ofertas',
    is_active: 1,
    sort_order: 2,
    bg_color: '',
    text_color: '',
    start_date: null,
    end_date: null
  },
  {
    id: 'ann_nuevas_colecciones',
    text: '¡Nuevas colecciones disponibles!',
    link: '#coleccion',
    is_active: 1,
    sort_order: 3,
    bg_color: '',
    text_color: '',
    start_date: null,
    end_date: null
  },
  {
    id: 'ann_descuentos_seleccionados',
    text: '¡Descuentos especiales en productos seleccionados!',
    link: '#productos',
    is_active: 1,
    sort_order: 4,
    bg_color: '',
    text_color: '',
    start_date: null,
    end_date: null
  }
];

/**
 * Asegura la existencia de tablas en SQLite y siembra anuncios por defecto
 */
export function ensureAnnouncementsTable() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        link TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        bg_color TEXT DEFAULT '',
        text_color TEXT DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS store_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Sembrar configuración de la barra si no existe
    const settingStmt = db.prepare('SELECT value FROM store_settings WHERE key = ?');
    const enabledSetting = settingStmt.get('announcement_bar_enabled');
    if (!enabledSetting) {
      db.prepare('INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('announcement_bar_enabled', 'true', new Date().toISOString());
    }

    const intervalSetting = settingStmt.get('announcement_rotation_seconds');
    if (!intervalSetting) {
      db.prepare('INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('announcement_rotation_seconds', '4', new Date().toISOString());
    }

    // Sembrar anuncios iniciales si la tabla está vacía
    const count = db.prepare('SELECT count(*) as count FROM announcements').get();
    if (count.count === 0) {
      const insert = db.prepare(`
        INSERT INTO announcements (id, text, link, is_active, sort_order, bg_color, text_color, start_date, end_date, created_at, updated_at)
        VALUES (@id, @text, @link, @is_active, @sort_order, @bg_color, @text_color, @start_date, @end_date, @created_at, @updated_at)
      `);

      const now = new Date().toISOString();
      for (const ann of DEFAULT_ANNOUNCEMENTS) {
        insert.run({
          ...ann,
          created_at: now,
          updated_at: now
        });
      }
    }
  } catch (error) {
    console.error('[AnnouncementService] Error asegurando tablas SQLite:', error.message);
  }
}

/**
 * Sincroniza una operación de anuncios con Neon PostgreSQL en segundo plano
 */
async function syncNeonAnnouncement(sqlQuery, params = []) {
  try {
    const pool = getNeonPool();
    if (!pool) return;
    await pool.query(sqlQuery, params);
  } catch (err) {
    console.warn('[Neon Sync Announcement Warning]', err.message);
  }
}

/**
 * Obtiene los anuncios públicos visibles y la configuración de la barra
 */
export async function getPublicAnnouncements() {
  ensureAnnouncementsTable();

  let isBarEnabled = true;
  let rotationSeconds = 4;

  try {
    const enabledRow = db.prepare("SELECT value FROM store_settings WHERE key = 'announcement_bar_enabled'").get();
    if (enabledRow) {
      isBarEnabled = enabledRow.value === 'true' || enabledRow.value === '1';
    }

    const intervalRow = db.prepare("SELECT value FROM store_settings WHERE key = 'announcement_rotation_seconds'").get();
    if (intervalRow) {
      const parsed = parseInt(intervalRow.value, 10);
      if (!isNaN(parsed) && parsed >= 2) {
        rotationSeconds = parsed;
      }
    }
  } catch {}

  // Si la barra está desactivada globalmente, responder con lista vacía y flag disabled
  if (!isBarEnabled) {
    return {
      enabled: false,
      rotationSeconds,
      announcements: []
    };
  }

  try {
    const rows = db.prepare(`
      SELECT * FROM announcements
      WHERE is_active = 1
      ORDER BY sort_order ASC, created_at ASC
    `).all();

    const now = new Date();

    // Filtrar por fechas si están configuradas
    const activeAnnouncements = rows.filter((ann) => {
      if (ann.start_date) {
        const start = new Date(ann.start_date);
        if (!isNaN(start.getTime()) && now < start) {
          return false;
        }
      }
      if (ann.end_date) {
        const end = new Date(ann.end_date);
        if (!isNaN(end.getTime()) && now > end) {
          return false;
        }
      }
      return true;
    }).map((ann) => ({
      id: ann.id,
      text: ann.text,
      link: ann.link || '',
      sort_order: ann.sort_order,
      bg_color: ann.bg_color || '',
      text_color: ann.text_color || ''
    }));

    return {
      enabled: true,
      rotationSeconds,
      announcements: activeAnnouncements.length > 0 ? activeAnnouncements : DEFAULT_ANNOUNCEMENTS
    };
  } catch (error) {
    console.error('[getPublicAnnouncements Error]:', error.message);
    return {
      enabled: true,
      rotationSeconds: 4,
      announcements: DEFAULT_ANNOUNCEMENTS
    };
  }
}

/**
 * Obtiene todos los anuncios para el panel de administración
 */
export async function getAllAdminAnnouncements() {
  ensureAnnouncementsTable();

  let isBarEnabled = true;
  let rotationSeconds = 4;

  try {
    const enabledRow = db.prepare("SELECT value FROM store_settings WHERE key = 'announcement_bar_enabled'").get();
    if (enabledRow) {
      isBarEnabled = enabledRow.value === 'true' || enabledRow.value === '1';
    }

    const intervalRow = db.prepare("SELECT value FROM store_settings WHERE key = 'announcement_rotation_seconds'").get();
    if (intervalRow) {
      const parsed = parseInt(intervalRow.value, 10);
      if (!isNaN(parsed) && parsed >= 2) {
        rotationSeconds = parsed;
      }
    }
  } catch {}

  const rows = db.prepare(`
    SELECT * FROM announcements
    ORDER BY sort_order ASC, created_at ASC
  `).all();

  const formatted = rows.map((ann) => ({
    id: ann.id,
    text: ann.text,
    link: ann.link || '',
    is_active: Boolean(ann.is_active),
    sort_order: ann.sort_order,
    bg_color: ann.bg_color || '',
    text_color: ann.text_color || '',
    start_date: ann.start_date || null,
    end_date: ann.end_date || null,
    created_at: ann.created_at,
    updated_at: ann.updated_at
  }));

  return {
    barEnabled: isBarEnabled,
    rotationSeconds,
    total: formatted.length,
    activeCount: formatted.filter((a) => a.is_active).length,
    announcements: formatted
  };
}

/**
 * Crea un nuevo anuncio
 */
export async function createAnnouncement({ text, link = '', is_active = 1, sort_order = 0, start_date = null, end_date = null }) {
  ensureAnnouncementsTable();

  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    throw new Error('El texto del anuncio es obligatorio');
  }

  // Si no se pasó orden, colocarlo al final
  let finalSortOrder = Number(sort_order);
  if (isNaN(finalSortOrder) || finalSortOrder <= 0) {
    const maxOrderRow = db.prepare('SELECT MAX(sort_order) as maxOrder FROM announcements').get();
    finalSortOrder = (maxOrderRow?.maxOrder || 0) + 1;
  }

  const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const now = new Date().toISOString();
  const activeInt = is_active ? 1 : 0;

  db.prepare(`
    INSERT INTO announcements (id, text, link, is_active, sort_order, start_date, end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, trimmedText, link.trim(), activeInt, finalSortOrder, start_date || null, end_date || null, now, now);

  // Sincronizar en Neon
  syncNeonAnnouncement(`
    INSERT INTO announcements (id, text, link, is_active, sort_order, start_date, end_date, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      text = EXCLUDED.text,
      link = EXCLUDED.link,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      updated_at = EXCLUDED.updated_at
  `, [id, trimmedText, link.trim(), Boolean(activeInt), finalSortOrder, start_date || null, end_date || null, now, now]);

  return {
    id,
    text: trimmedText,
    link: link.trim(),
    is_active: Boolean(activeInt),
    sort_order: finalSortOrder,
    start_date: start_date || null,
    end_date: end_date || null,
    created_at: now,
    updated_at: now
  };
}

/**
 * Actualiza un anuncio existente
 */
export async function updateAnnouncement(id, { text, link, is_active, sort_order, start_date, end_date }) {
  ensureAnnouncementsTable();

  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!existing) {
    throw new Error(`Anuncio con id "${id}" no encontrado`);
  }

  const newText = text !== undefined ? String(text).trim() : existing.text;
  if (!newText) {
    throw new Error('El texto del anuncio no puede estar vacío');
  }

  const newLink = link !== undefined ? String(link).trim() : existing.link;
  const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;
  const newOrder = sort_order !== undefined ? Number(sort_order) : existing.sort_order;
  const newStartDate = start_date !== undefined ? (start_date || null) : existing.start_date;
  const newEndDate = end_date !== undefined ? (end_date || null) : existing.end_date;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE announcements
    SET text = ?, link = ?, is_active = ?, sort_order = ?, start_date = ?, end_date = ?, updated_at = ?
    WHERE id = ?
  `).run(newText, newLink, newActive, newOrder, newStartDate, newEndDate, now, id);

  // Sincronizar en Neon
  syncNeonAnnouncement(`
    UPDATE announcements
    SET text = $1, link = $2, is_active = $3, sort_order = $4, start_date = $5, end_date = $6, updated_at = $7
    WHERE id = $8
  `, [newText, newLink, Boolean(newActive), newOrder, newStartDate, newEndDate, now, id]);

  return {
    id,
    text: newText,
    link: newLink,
    is_active: Boolean(newActive),
    sort_order: newOrder,
    start_date: newStartDate,
    end_date: newEndDate,
    updated_at: now
  };
}

/**
 * Elimina un anuncio
 */
export async function deleteAnnouncement(id) {
  ensureAnnouncementsTable();

  const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
  if (!existing) {
    throw new Error(`Anuncio con id "${id}" no encontrado`);
  }

  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

  // Sincronizar en Neon
  syncNeonAnnouncement('DELETE FROM announcements WHERE id = $1', [id]);

  return { success: true, id };
}

/**
 * Activa o desactiva la barra de anuncios completa
 */
export async function setBarEnabled(enabled) {
  ensureAnnouncementsTable();

  const valStr = enabled ? 'true' : 'false';
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('announcement_bar_enabled', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(valStr, now);

  syncNeonAnnouncement(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('announcement_bar_enabled', $1, $2)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `, [valStr, now]);

  return { enabled: Boolean(enabled) };
}

/**
 * Actualiza el intervalo de rotación en segundos
 */
export async function setRotationInterval(seconds) {
  ensureAnnouncementsTable();

  const parsed = Math.max(2, Math.min(60, parseInt(seconds, 10) || 4));
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('announcement_rotation_seconds', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(parsed), now);

  syncNeonAnnouncement(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('announcement_rotation_seconds', $1, $2)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `, [String(parsed), now]);

  return { rotationSeconds: parsed };
}

/**
 * Reordena una lista de IDs de anuncios
 */
export async function reorderAnnouncements(orderedIds = []) {
  ensureAnnouncementsTable();

  if (!Array.isArray(orderedIds)) return false;

  const updateStmt = db.prepare('UPDATE announcements SET sort_order = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();

  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updateStmt.run(index + 1, now, id);
    });
  });

  transaction(orderedIds);

  // Sincronizar en Neon
  try {
    const pool = getNeonPool();
    if (pool) {
      for (let i = 0; i < orderedIds.length; i++) {
        await pool.query('UPDATE announcements SET sort_order = $1, updated_at = $2 WHERE id = $3', [i + 1, now, orderedIds[i]]);
      }
    }
  } catch {}

  return true;
}
