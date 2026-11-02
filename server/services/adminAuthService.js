import { query as neonQuery, getNeonPool } from '../db/neon.js';
import { db as sqliteDb } from '../db/database.js';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken
} from '../auth/security.js';

/**
 * Servicio unificado de Autenticación y Sesiones para URBAN STYLE.
 * Prioriza Neon PostgreSQL con tolerancia a fallos sobre la base local.
 */

export async function findAdminByUsername(username) {
  if (!username) return null;
  const cleanUser = username.trim().toLowerCase();

  // 1. Intentar consulta en Neon PostgreSQL
  try {
    const pool = getNeonPool();
    if (pool) {
      const res = await neonQuery(
        'SELECT id, username, password_hash, salt, role, created_at FROM admin_users WHERE LOWER(username) = LOWER($1) LIMIT 1',
        [cleanUser]
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
    }
  } catch (err) {
    console.warn('[AdminAuthService] Neon no disponible temporalmente, consultando fallback:', err.message);
  }

  // 2. Fallback a SQLite
  try {
    const stmt = sqliteDb.prepare('SELECT id, username, password_hash, salt, role, created_at FROM admin_users WHERE LOWER(username) = LOWER(?) LIMIT 1');
    return stmt.get(cleanUser) || null;
  } catch (err) {
    console.error('[AdminAuthService] Error consultando administrador local:', err.message);
    return null;
  }
}

export async function countAdminUsers() {
  try {
    const pool = getNeonPool();
    if (pool) {
      const res = await neonQuery('SELECT count(*) as count FROM admin_users');
      return parseInt(res.rows[0].count, 10);
    }
  } catch (err) {
    console.warn('[AdminAuthService] Fallback conteo admin:', err.message);
  }

  try {
    const row = sqliteDb.prepare('SELECT count(*) as count FROM admin_users').get();
    return row ? row.count : 0;
  } catch {
    return 0;
  }
}

export async function createAdminUser({ username, password, role = 'admin' }) {
  if (!username || !password) {
    throw new Error('Usuario y contraseña son obligatorios.');
  }

  const cleanUser = username.trim().toLowerCase();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  let createdInNeon = false;

  // 1. Crear en Neon PostgreSQL
  try {
    const pool = getNeonPool();
    if (pool) {
      await neonQuery(
        `INSERT INTO admin_users (username, password_hash, salt, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             salt = EXCLUDED.salt,
             role = EXCLUDED.role,
             updated_at = NOW()`,
        [cleanUser, hash, salt, role]
      );
      createdInNeon = true;
    }
  } catch (err) {
    console.warn('[AdminAuthService] Error creando admin en Neon:', err.message);
  }

  // 2. Sincronizar en SQLite para coherencia local
  try {
    sqliteDb.prepare(`
      INSERT INTO admin_users (username, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        salt = excluded.salt,
        role = excluded.role
    `).run(cleanUser, hash, salt, role, now);
  } catch (err) {
    console.warn('[AdminAuthService] Error sincronizando admin local:', err.message);
  }

  return { username: cleanUser, role, createdInNeon };
}

export async function createAdminSession({ userId, username, role, ipAddress, userAgent }) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas
  const cleanUser = username.trim().toLowerCase();

  // Guardar en Neon
  try {
    const pool = getNeonPool();
    if (pool) {
      await neonQuery(
        `INSERT INTO admin_sessions (session_token, user_id, username, role, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sessionToken, userId, cleanUser, role, ipAddress || 'unknown', userAgent || '', expiresAt]
      );
    }
  } catch (err) {
    console.warn('[AdminAuthService] Error guardando sesión en Neon:', err.message);
  }

  // Guardar en SQLite
  try {
    sqliteDb.prepare(`
      INSERT INTO admin_sessions (session_token, user_id, username, role, ip_address, user_agent, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionToken,
      userId,
      cleanUser,
      role,
      ipAddress || 'unknown',
      userAgent || '',
      expiresAt.toISOString(),
      new Date().toISOString()
    );
  } catch (err) {
    console.warn('[AdminAuthService] Error guardando sesión local:', err.message);
  }

  return {
    sessionToken,
    expiresAt,
    user: { id: userId, username: cleanUser, role }
  };
}

export async function getAdminSession(sessionToken) {
  if (!sessionToken) return null;

  // 1. Consultar Neon
  try {
    const pool = getNeonPool();
    if (pool) {
      const res = await neonQuery(
        `SELECT session_token, user_id, username, role, expires_at
         FROM admin_sessions
         WHERE session_token = $1 AND expires_at > NOW()
         LIMIT 1`,
        [sessionToken]
      );
      if (res.rows && res.rows.length > 0) {
        return {
          sessionToken: res.rows[0].session_token,
          user: {
            id: res.rows[0].user_id,
            username: res.rows[0].username,
            role: res.rows[0].role
          },
          expiresAt: res.rows[0].expires_at
        };
      }
    }
  } catch (err) {
    console.warn('[AdminAuthService] Error validando sesión en Neon:', err.message);
  }

  // 2. Consultar SQLite fallback
  try {
    const nowIso = new Date().toISOString();
    const row = sqliteDb.prepare(`
      SELECT session_token, user_id, username, role, expires_at
      FROM admin_sessions
      WHERE session_token = ? AND expires_at > ?
      LIMIT 1
    `).get(sessionToken, nowIso);

    if (row) {
      return {
        sessionToken: row.session_token,
        user: {
          id: row.user_id,
          username: row.username,
          role: row.role
        },
        expiresAt: new Date(row.expires_at)
      };
    }
  } catch (err) {
    console.warn('[AdminAuthService] Error validando sesión local:', err.message);
  }

  return null;
}

export async function revokeAdminSession(sessionToken) {
  if (!sessionToken) return;

  try {
    const pool = getNeonPool();
    if (pool) {
      await neonQuery('DELETE FROM admin_sessions WHERE session_token = $1', [sessionToken]);
    }
  } catch (err) {
    console.warn('[AdminAuthService] Error eliminando sesión en Neon:', err.message);
  }

  try {
    sqliteDb.prepare('DELETE FROM admin_sessions WHERE session_token = ?').run(sessionToken);
  } catch (err) {
    console.warn('[AdminAuthService] Error eliminando sesión local:', err.message);
  }
}

export async function logLoginAttempt({ ipAddress, username, success }) {
  try {
    const pool = getNeonPool();
    if (pool) {
      await neonQuery(
        'INSERT INTO admin_login_attempts (ip_address, username, success) VALUES ($1, $2, $3)',
        [ipAddress || 'unknown', (username || '').toLowerCase(), success]
      );
    }
  } catch {
    // Silencioso para no degradar el flujo de autenticación
  }

  try {
    sqliteDb.prepare(
      'INSERT INTO admin_login_attempts (ip_address, username, success, attempted_at) VALUES (?, ?, ?, ?)'
    ).run(ipAddress || 'unknown', (username || '').toLowerCase(), success ? 1 : 0, new Date().toISOString());
  } catch {
    // Silencioso
  }
}
