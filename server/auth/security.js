import crypto from 'crypto';

/**
 * Generación de hash criptográficamente seguro PBKDF2 (120.000 iteraciones SHA-512)
 * con sal aleatoria de 256 bits (32 bytes).
 */
export function hashPassword(password, salt = crypto.randomBytes(32).toString('hex')) {
  if (!password || typeof password !== 'string') {
    throw new Error('La contraseña debe ser una cadena no vacía.');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verificación en tiempo constante (timingSafeEqual) para prevenir ataques de canal lateral (timing attacks).
 */
export function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    const compBuf = Buffer.from(computedHash, 'hex');
    if (storedBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, compBuf);
  } catch {
    return false;
  }
}

/**
 * Genera un identificador de sesión criptográficamente aleatorio (512 bits / 64 bytes hex)
 */
export function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Opciones seguras para cookies de sesión administrativa
 */
export const ADMIN_COOKIE_NAME = 'urban_admin_session';

export function getAdminCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return {
    httpOnly: true, // No accesible desde JavaScript (protege contra XSS)
    secure: isProduction, // Transmitida únicamente sobre HTTPS en producción
    sameSite: 'lax', // Protección contra ataques CSRF manteniendo navegación natural
    maxAge: 8 * 60 * 60 * 1000, // 8 horas de vigencia máxima
    path: '/'
  };
}

/**
 * Validación estricta de datos de entrada
 */
export function validateLoginInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Cuerpo de solicitud inválido.' };
  }

  const { username, password } = body;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return { valid: false, message: 'El nombre de usuario es requerido.' };
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    return { valid: false, message: 'El usuario debe tener entre 3 y 50 caracteres.' };
  }

  // Solo caracteres alfanuméricos, guiones y puntos
  const usernameRegex = /^[a-z0-9_.-]+$/;
  if (!usernameRegex.test(cleanUsername)) {
    return { valid: false, message: 'El usuario contiene caracteres no permitidos.' };
  }

  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'La contraseña es requerida.' };
  }

  if (password.length < 6 || password.length > 128) {
    return { valid: false, message: 'La contraseña debe tener entre 6 y 128 caracteres.' };
  }

  return { valid: true, cleanUsername, password };
}

/**
 * Sistema de protección contra fuerza bruta y rate-limiting en memoria y sincronizable
 */
const loginAttempts = new Map(); // key -> { count: number, firstAttempt: number, lastAttempt: number, blockedUntil: number }
const MAX_ATTEMPTS_PER_USER = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos de bloqueo tras superar límite

export function getAttemptKey(ip, username = '') {
  const cleanIp = (ip || 'unknown').replace('::ffff:', '');
  const cleanUser = (username || '').trim().toLowerCase();
  return cleanUser ? `${cleanIp}:${cleanUser}` : `ip:${cleanIp}`;
}

export function checkRateLimit(ip, username = '') {
  const now = Date.now();
  const userKey = getAttemptKey(ip, username);
  const ipKey = getAttemptKey(ip, '');

  const checks = [
    { key: userKey, max: MAX_ATTEMPTS_PER_USER },
    { key: ipKey, max: MAX_ATTEMPTS_PER_IP }
  ];

  for (const { key } of checks) {
    const record = loginAttempts.get(key);
    if (record) {
      if (record.blockedUntil && record.blockedUntil > now) {
        const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
        return {
          allowed: false,
          remainingSeconds,
          message: `Demasiados intentos fallidos. Tu acceso ha sido bloqueado temporalmente por ${Math.ceil(remainingSeconds / 60)} minutos.`
        };
      }

      // Reiniciar si la ventana de tiempo ya expiró
      if (now - record.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(key);
      }
    }
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip, username = '') {
  const now = Date.now();
  const userKey = getAttemptKey(ip, username);
  const ipKey = getAttemptKey(ip, '');

  const targets = [
    { key: userKey, max: MAX_ATTEMPTS_PER_USER },
    { key: ipKey, max: MAX_ATTEMPTS_PER_IP }
  ];

  for (const { key, max } of targets) {
    const record = loginAttempts.get(key) || { count: 0, firstAttempt: now, lastAttempt: now, blockedUntil: 0 };
    if (now - record.firstAttempt > WINDOW_MS) {
      record.count = 1;
      record.firstAttempt = now;
      record.blockedUntil = 0;
    } else {
      record.count += 1;
    }
    record.lastAttempt = now;

    if (record.count >= max) {
      record.blockedUntil = now + LOCKOUT_MS;
    }

    loginAttempts.set(key, record);
  }

  const currentRecord = loginAttempts.get(userKey);
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS_PER_USER - (currentRecord ? currentRecord.count : 0));
  return {
    remainingAttempts,
    isBlocked: currentRecord ? currentRecord.blockedUntil > now : false
  };
}

export function resetFailedAttempts(ip, username = '') {
  const userKey = getAttemptKey(ip, username);
  loginAttempts.delete(userKey);
}

export function resetAllRateLimits() {
  loginAttempts.clear();
}
