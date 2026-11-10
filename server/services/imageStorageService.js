import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { query as neonQuery, getNeonPool } from '../db/neon.js';
import { db as sqliteDb } from '../db/database.js';

// Configuración de almacenamiento persistente S3 en Neon
const STORAGE_ENDPOINT = process.env.NEON_STORAGE_ENDPOINT || 'https://br-small-band-bey5ggyc.storage.c-9.us-east-2.aws.neon.tech';
const STORAGE_REGION = process.env.NEON_STORAGE_REGION || 'us-east-2';
const STORAGE_BUCKET = process.env.NEON_STORAGE_BUCKET || 'urban-style-products';
const STORAGE_ACCESS_KEY = process.env.NEON_STORAGE_ACCESS_KEY_ID || 'nak_live_bf42b778e87a43abb9ac27045e7f121d';
const STORAGE_SECRET_KEY = process.env.NEON_STORAGE_SECRET_ACCESS_KEY || 'nsk_live_39db711b150929f377cf495d5955cb22512f10bf1e6ed6dd964605b7e83897dd';

// Tipos MIME permitidos y límite de tamaño
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Cliente S3 configurado
let s3ClientInstance = null;

function getS3Client() {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: STORAGE_REGION,
      endpoint: STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY,
        secretAccessKey: STORAGE_SECRET_KEY
      },
      forcePathStyle: true
    });
  }
  return s3ClientInstance;
}

/**
 * Valida tipo y tamaño de archivo en el servidor
 */
export function validateImageFile({ buffer, mimeType, originalName }) {
  if (!buffer || buffer.length === 0) {
    throw new Error('El archivo de imagen está vacío.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`El archivo excede el tamaño máximo permitido de 5 MB (tamaño recibido: ${sizeMb} MB).`);
  }

  const cleanMime = (mimeType || '').toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
    throw new Error(`Formato no permitido: "${cleanMime}". Formatos válidos: JPEG, PNG, WebP, AVIF, GIF.`);
  }

  return true;
}

/**
 * Genera extensión de archivo a partir del MIME
 */
function getExtensionFromMime(mimeType) {
  switch (mimeType) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/avif': return 'avif';
    case 'image/gif': return 'gif';
    case 'image/jpeg':
    default: return 'jpg';
  }
}

/**
 * Sube una imagen al bucket de Neon Object Storage y la registra en la base de datos
 */
export async function uploadProductImage({
  productId,
  buffer,
  originalName = 'product-image',
  mimeType = 'image/jpeg',
  isPrimary = false,
  altText = ''
}) {
  validateImageFile({ buffer, mimeType, originalName });

  const ext = getExtensionFromMime(mimeType);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const imageId = `img-${productId}-${timestamp}-${randomSuffix}`;
  const storageKey = `products/${productId}/${timestamp}-${randomSuffix}.${ext}`;

  // 1. Subida al bucket en Neon S3
  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: storageKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      productId: String(productId),
      originalName: encodeURIComponent(originalName)
    }
  }));

  const publicUrl = `${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/${storageKey}`;

  // 2. Determinar si esta imagen debe ser la principal
  const existingImages = await getProductImages(productId);
  const makePrimary = Boolean(isPrimary) || existingImages.length === 0;

  let nextSortOrder = 0;
  if (existingImages.length > 0) {
    const maxOrder = Math.max(...existingImages.map((img) => img.sort_order ?? 0));
    nextSortOrder = maxOrder + 1;
  }

  // 3. Persistir metadatos en Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      if (makePrimary) {
        // Desmarcar anteriores
        await neonQuery('UPDATE product_images SET is_primary = FALSE WHERE product_id = $1', [productId]);
      }

      await neonQuery(
        `INSERT INTO product_images (id, product_id, url, alt_text, is_primary, sort_order, file_size, mime_type, storage_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [imageId, productId, publicUrl, altText || originalName, makePrimary, nextSortOrder, buffer.length, mimeType, storageKey]
      );

      if (makePrimary) {
        await neonQuery('UPDATE products SET image = $1 WHERE id = $2', [publicUrl, productId]);
      }
    } catch (err) {
      console.warn('[Neon Image Insert Error]', err.message);
    }
  }

  // 4. Sincronizar en SQLite
  try {
    if (makePrimary) {
      sqliteDb.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').run(productId);
    }

    sqliteDb.prepare(`
      INSERT INTO product_images (id, product_id, url, alt_text, is_primary, sort_order, file_size, mime_type, storage_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(imageId, productId, publicUrl, altText || originalName, makePrimary ? 1 : 0, nextSortOrder, buffer.length, mimeType, storageKey, new Date().toISOString());

    if (makePrimary) {
      sqliteDb.prepare('UPDATE products SET image = ? WHERE id = ?').run(publicUrl, productId);
    }
  } catch (err) {
    console.warn('[SQLite Image Insert Error]', err.message);
  }

  return {
    id: imageId,
    product_id: productId,
    url: publicUrl,
    alt_text: altText || originalName,
    is_primary: makePrimary,
    sort_order: nextSortOrder,
    file_size: buffer.length,
    mime_type: mimeType,
    storage_key: storageKey
  };
}

/**
 * Consulta todas las imágenes de un producto ordenadas
 */
export async function getProductImages(productId) {
  const pool = getNeonPool();

  if (pool) {
    try {
      const res = await neonQuery(
        'SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, created_at ASC',
        [productId]
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows.map((r) => ({
          ...r,
          is_primary: Boolean(r.is_primary),
          sort_order: Number(r.sort_order || 0),
          file_size: Number(r.file_size || 0)
        }));
      }
    } catch (err) {
      console.warn('[Neon getProductImages]', err.message);
    }
  }

  // Fallback SQLite
  try {
    const rows = sqliteDb.prepare(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(productId);

    return rows.map((r) => ({
      ...r,
      is_primary: Boolean(r.is_primary),
      sort_order: Number(r.sort_order || 0),
      file_size: Number(r.file_size || 0)
    }));
  } catch {
    return [];
  }
}

/**
 * Marca una imagen como principal para el producto
 */
export async function setPrimaryImage(productId, imageId) {
  const pool = getNeonPool();
  let targetUrl = null;

  if (pool) {
    try {
      await neonQuery('UPDATE product_images SET is_primary = FALSE WHERE product_id = $1', [productId]);
      const res = await neonQuery(
        'UPDATE product_images SET is_primary = TRUE WHERE product_id = $1 AND id = $2 RETURNING url',
        [productId, imageId]
      );
      if (res.rows?.[0]) {
        targetUrl = res.rows[0].url;
        await neonQuery('UPDATE products SET image = $1 WHERE id = $2', [targetUrl, productId]);
      }
    } catch (err) {
      console.warn('[Neon setPrimaryImage]', err.message);
    }
  }

  try {
    sqliteDb.prepare('UPDATE product_images SET is_primary = 0 WHERE product_id = ?').run(productId);
    const row = sqliteDb.prepare(
      'UPDATE product_images SET is_primary = 1 WHERE product_id = ? AND id = ? RETURNING url'
    ).get(productId, imageId);
    if (row?.url) {
      targetUrl = targetUrl || row.url;
      sqliteDb.prepare('UPDATE products SET image = ? WHERE id = ?').run(row.url, productId);
    }
  } catch (err) {
    console.warn('[SQLite setPrimaryImage]', err.message);
  }

  return { success: true, imageId, primaryUrl: targetUrl };
}

/**
 * Reordena las imágenes según un array de IDs ordenados
 */
export async function reorderProductImages(productId, orderedImageIds = []) {
  if (!Array.isArray(orderedImageIds) || orderedImageIds.length === 0) {
    return { success: false, message: 'Se requiere un array de IDs.' };
  }

  const pool = getNeonPool();

  for (let idx = 0; idx < orderedImageIds.length; idx++) {
    const imgId = orderedImageIds[idx];

    if (pool) {
      try {
        await neonQuery(
          'UPDATE product_images SET sort_order = $1 WHERE product_id = $2 AND id = $3',
          [idx, productId, imgId]
        );
      } catch (err) {
        console.warn('[Neon reorder error]', err.message);
      }
    }

    try {
      sqliteDb.prepare(
        'UPDATE product_images SET sort_order = ? WHERE product_id = ? AND id = ?'
      ).run(idx, productId, imgId);
    } catch (err) {
      console.warn('[SQLite reorder error]', err.message);
    }
  }

  return { success: true, message: 'Imágenes reordenadas exitosamente.' };
}

/**
 * Elimina una imagen del almacenamiento persistente S3 y de la base de datos
 */
export async function deleteProductImage(productId, imageId) {
  const images = await getProductImages(productId);
  const target = images.find((img) => img.id === imageId);

  if (!target) {
    throw new Error('Imagen no encontrada para este producto.');
  }

  // 1. Si tiene storage_key, eliminar del bucket S3 en Neon
  if (target.storage_key) {
    try {
      const s3 = getS3Client();
      await s3.send(new DeleteObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: target.storage_key
      }));
    } catch (err) {
      console.warn('[S3 Delete Error]', err.message);
    }
  }

  // 2. Eliminar registro en Neon
  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery('DELETE FROM product_images WHERE product_id = $1 AND id = $2', [productId, imageId]);
    } catch (err) {
      console.warn('[Neon deleteProductImage]', err.message);
    }
  }

  // 3. Eliminar registro en SQLite
  try {
    sqliteDb.prepare('DELETE FROM product_images WHERE product_id = ? AND id = ?').run(productId, imageId);
  } catch (err) {
    console.warn('[SQLite deleteProductImage]', err.message);
  }

  // 4. Si la eliminada era la principal, reasignar la primera disponible
  if (target.is_primary) {
    const remaining = await getProductImages(productId);
    if (remaining.length > 0) {
      await setPrimaryImage(productId, remaining[0].id);
    } else {
      // Sin imágenes restantes: fallback a imagen neutra
      const fallbackUrl = '/images/products/prod-tshirt.jpg';
      if (pool) {
        await neonQuery('UPDATE products SET image = $1 WHERE id = $2', [fallbackUrl, productId]);
      }
      try {
        sqliteDb.prepare('UPDATE products SET image = ? WHERE id = ?').run(fallbackUrl, productId);
      } catch {}
    }
  }

  return {
    success: true,
    deletedId: imageId,
    message: 'Imagen eliminada exitosamente del almacenamiento y catálogo.'
  };
}

/**
 * Si Neon product_images está vacío, crea las referencias iniciales desde products
 */
export async function seedProductImagesIfEmpty() {
  const pool = getNeonPool();
  if (!pool) return;

  try {
    const countRes = await neonQuery('SELECT count(*) as count FROM product_images');
    const count = parseInt(countRes.rows[0].count, 10);
    if (count === 0) {
      await neonQuery(`
        INSERT INTO product_images (id, product_id, url, alt_text, is_primary, sort_order, file_size, mime_type, storage_key, created_at)
        SELECT
          'img-' || id || '-primary' AS id,
          id AS product_id,
          image AS url,
          name AS alt_text,
          TRUE AS is_primary,
          0 AS sort_order,
          0 AS file_size,
          'image/jpeg' AS mime_type,
          NULL AS storage_key,
          NOW() AS created_at
        FROM products
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('[Neon Storage] Imágenes iniciales sembradas en product_images.');
    }
  } catch (err) {
    console.warn('[Neon Images Seed Notice]', err.message);
  }
}

/**
 * Sube una imagen para anuncio emergente (Popup) a Neon Object Storage S3 o fallback local persistente
 */
export async function uploadPopupImage({
  buffer,
  originalName = 'popup-banner',
  mimeType = 'image/jpeg'
}) {
  validateImageFile({ buffer, mimeType, originalName });

  const ext = getExtensionFromMime(mimeType);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const storageKey = `popups/${timestamp}-${randomSuffix}.${ext}`;

  // Intentar subida a Neon S3 Bucket
  try {
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        category: 'popup-announcement',
        originalName: encodeURIComponent(originalName)
      }
    }));

    const publicUrl = `${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/${storageKey}`;
    return {
      url: publicUrl,
      storageKey,
      fileSize: buffer.length,
      mimeType
    };
  } catch (err) {
    console.warn('[Neon S3 Popup Upload Notice, using local fallback]:', err.message);
    const popupsDir = path.resolve(process.cwd(), 'public/images/popups');
    if (!fs.existsSync(popupsDir)) {
      fs.mkdirSync(popupsDir, { recursive: true });
    }
    const fileName = `${timestamp}-${randomSuffix}.${ext}`;
    const localFilePath = path.join(popupsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);

    return {
      url: `/images/popups/${fileName}`,
      storageKey: `local:${fileName}`,
      fileSize: buffer.length,
      mimeType
    };
  }
}

/**
 * Elimina una imagen de anuncio emergente de Neon S3 o del almacenamiento local
 */
export async function deletePopupImage(storageKey) {
  if (!storageKey) return { success: true };

  if (storageKey.startsWith('local:')) {
    const fileName = storageKey.replace('local:', '');
    const localPath = path.resolve(process.cwd(), 'public/images/popups', fileName);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {}
    }
    return { success: true };
  }

  try {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: storageKey
    }));
  } catch (err) {
    console.warn('[Neon S3 Popup Delete Notice]:', err.message);
  }

  return { success: true };
}
