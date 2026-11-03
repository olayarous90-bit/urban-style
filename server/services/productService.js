import { query as neonQuery, getNeonPool } from '../db/neon.js';
import { db as sqliteDb } from '../db/database.js';
import { getProductImages, seedProductImagesIfEmpty } from './imageStorageService.js';

/**
 * Formatea un valor numérico a moneda oficial colombiana ($ COP)
 */
export function formatCOP(price) {
  const num = Math.round(Number(price) || 0);
  return `$${num.toLocaleString('es-CO')} COP`;
}

/**
 * Normaliza las tallas recibidas a formato de array limpio
 */
export function parseSizes(sizes) {
  if (Array.isArray(sizes)) {
    return sizes.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof sizes === 'string') {
    try {
      const parsed = JSON.parse(sizes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return sizes.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return ['S', 'M', 'L', 'XL'];
}

/**
 * Calcula dinámicamente los precios oficiales y el estado de promociones
 * comparando con la marca de tiempo actual del servidor (o una referencia).
 */
export function computeProductPricing(p, referenceDate = new Date()) {
  const originalPrice = Math.round(Number(p.price) || 0);
  const formattedOriginalPrice = formatCOP(originalPrice);

  const rawPercent = Math.round(Number(p.discount_percent) || 0);
  const discountPercent = Math.max(0, Math.min(99, rawPercent));
  const discountActive = Boolean(p.discount_active);

  let discountStartAt = null;
  if (p.discount_start_at) {
    const s = new Date(p.discount_start_at);
    if (!isNaN(s.getTime())) discountStartAt = s;
  }

  let discountEndAt = null;
  if (p.discount_end_at) {
    const e = new Date(p.discount_end_at);
    if (!isNaN(e.getTime())) discountEndAt = e;
  }

  let discountStatus = 'INACTIVE';
  let isEffective = false;

  if (discountActive && discountPercent > 0) {
    if (discountStartAt && referenceDate < discountStartAt) {
      discountStatus = 'SCHEDULED';
      isEffective = false;
    } else if (discountEndAt && referenceDate > discountEndAt) {
      discountStatus = 'EXPIRED';
      isEffective = false;
    } else {
      discountStatus = 'ACTIVE';
      isEffective = true;
    }
  }

  let finalPrice = originalPrice;
  let savings = 0;
  let formattedPrice = formattedOriginalPrice;
  let formattedSavings = null;

  if (isEffective) {
    finalPrice = Math.max(1000, Math.round(originalPrice * (1 - discountPercent / 100)));
    savings = originalPrice - finalPrice;
    formattedPrice = formatCOP(finalPrice);
    formattedSavings = formatCOP(savings);
  }

  return {
    originalPrice,
    formattedOriginalPrice,
    finalPrice,
    price: finalPrice, // Retrocompatibilidad para endpoints y carrito
    formattedPrice,
    hasActiveDiscount: isEffective,
    hasDiscount: isEffective,
    discountPercent,
    discountActive,
    discountStatus, // 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE'
    discountStartAt: discountStartAt ? discountStartAt.toISOString() : null,
    discountEndAt: discountEndAt ? discountEndAt.toISOString() : null,
    savings,
    formattedSavings
  };
}

/**
 * Si Neon PostgreSQL no tiene productos, copia los iniciales de SQLite para bootstrap
 */
export async function seedProductsToNeonIfEmpty() {
  const pool = getNeonPool();
  if (!pool) return;

  try {
    const res = await neonQuery('SELECT count(*) as count FROM products');
    const count = parseInt(res.rows[0].count, 10);
    if (count === 0) {
      console.log('[Neon Products] Poblando catálogo inicial en Neon PostgreSQL...');
      const localProducts = sqliteDb.prepare('SELECT * FROM products').all();
      for (const p of localProducts) {
        await neonQuery(
          `INSERT INTO products (id, name, category, price, formatted_price, image, description, sizes, composition, color, stock, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.name,
            p.category,
            p.price,
            p.formatted_price || formatCOP(p.price),
            p.image || '/images/products/prod-tshirt.jpg',
            p.description || '',
            p.sizes || JSON.stringify(['S', 'M', 'L', 'XL']),
            p.composition || '100% Algodón Premium',
            p.color || 'Negro',
            p.stock ?? 50,
            Boolean(p.is_active ?? 1)
          ]
        );
      }
      console.log(`[Neon Products] ${localProducts.length} productos iniciales sembrados en Neon exitosamente.`);
    }

    // Asegurar que las imágenes de productos iniciales estén registradas en product_images
    await seedProductImagesIfEmpty();
  } catch (err) {
    console.warn('[Neon Products Seed Notice]', err.message);
  }
}

/**
 * Obtiene todos los productos para el panel de administración con filtros
 */
export async function getAdminProducts({ search = '', category = 'ALL', status = 'ALL', discount_status = 'ALL' } = {}) {
  const pool = getNeonPool();

  if (pool) {
    try {
      let queryStr = 'SELECT * FROM products WHERE 1=1';
      const params = [];
      let idx = 1;

      if (category && category !== 'ALL') {
        queryStr += ` AND LOWER(category) = LOWER($${idx++})`;
        params.push(category);
      }

      if (status === 'ACTIVE') {
        queryStr += ` AND is_active = TRUE`;
      } else if (status === 'INACTIVE') {
        queryStr += ` AND is_active = FALSE`;
      }

      if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        queryStr += ` AND (LOWER(name) LIKE $${idx} OR LOWER(id) LIKE $${idx} OR LOWER(description) LIKE $${idx} OR LOWER(color) LIKE $${idx})`;
        params.push(term);
        idx++;
      }

      queryStr += ' ORDER BY created_at DESC, id DESC';
      const result = await neonQuery(queryStr, params);

      let productsWithImages = await Promise.all(
        result.rows.map(async (r) => {
          const images = await getProductImages(r.id);
          const defaultImg = r.image || '/images/products/prod-tshirt.jpg';
          const pricing = computeProductPricing(r);
          return {
            ...r,
            ...pricing,
            image: r.image || (images[0]?.url || defaultImg),
            images: images.length > 0 ? images : [{ id: `img-${r.id}-default`, url: defaultImg, is_primary: true }],
            sizes: parseSizes(r.sizes),
            isActive: Boolean(r.is_active)
          };
        })
      );

      if (discount_status && discount_status !== 'ALL') {
        productsWithImages = productsWithImages.filter((p) => {
          if (discount_status === 'ACTIVE') return p.discountStatus === 'ACTIVE';
          if (discount_status === 'SCHEDULED') return p.discountStatus === 'SCHEDULED';
          if (discount_status === 'EXPIRED') return p.discountStatus === 'EXPIRED';
          if (discount_status === 'INACTIVE' || discount_status === 'NONE') return p.discountStatus === 'INACTIVE';
          if (discount_status === 'WITH_DISCOUNT') return p.discountStatus !== 'INACTIVE';
          return true;
        });
      }

      return productsWithImages;
    } catch (err) {
      console.warn('[Admin Products] Fallback a base local:', err.message);
    }
  }

  // Fallback a SQLite
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'ALL') {
    sql += ' AND LOWER(category) = LOWER(?)';
    params.push(category);
  }

  if (status === 'ACTIVE') {
    sql += ' AND is_active = 1';
  } else if (status === 'INACTIVE') {
    sql += ' AND is_active = 0';
  }

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(id) LIKE ? OR LOWER(description) LIKE ? OR LOWER(color) LIKE ?)';
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY id DESC';
  const rows = sqliteDb.prepare(sql).all(...params);

  let localWithImages = await Promise.all(
    rows.map(async (r) => {
      const images = await getProductImages(r.id);
      const defaultImg = r.image || '/images/products/prod-tshirt.jpg';
      const pricing = computeProductPricing(r);
      return {
        ...r,
        ...pricing,
        image: r.image || (images[0]?.url || defaultImg),
        images: images.length > 0 ? images : [{ id: `img-${r.id}-default`, url: defaultImg, is_primary: true }],
        sizes: parseSizes(r.sizes),
        is_active: Boolean(r.is_active),
        isActive: Boolean(r.is_active)
      };
    })
  );

  if (discount_status && discount_status !== 'ALL') {
    localWithImages = localWithImages.filter((p) => {
      if (discount_status === 'ACTIVE') return p.discountStatus === 'ACTIVE';
      if (discount_status === 'SCHEDULED') return p.discountStatus === 'SCHEDULED';
      if (discount_status === 'EXPIRED') return p.discountStatus === 'EXPIRED';
      if (discount_status === 'INACTIVE' || discount_status === 'NONE') return p.discountStatus === 'INACTIVE';
      if (discount_status === 'WITH_DISCOUNT') return p.discountStatus !== 'INACTIVE';
      return true;
    });
  }

  return localWithImages;
}

/**
 * Obtiene únicamente los productos activos para la tienda pública con precios promocionales oficiales
 */
export async function getPublicActiveProducts() {
  const pool = getNeonPool();

  if (pool) {
    try {
      const res = await neonQuery('SELECT * FROM products WHERE is_active = TRUE ORDER BY created_at DESC, id ASC');
      if (res.rows && res.rows.length > 0) {
        const publicWithImages = await Promise.all(
          res.rows.map(async (p) => {
            const images = await getProductImages(p.id);
            const defaultImg = p.image || '/images/products/prod-tshirt.jpg';
            const imageUrls = images.length > 0 ? images.map((i) => i.url) : [defaultImg];
            const pricing = computeProductPricing(p);

            return {
              id: p.id,
              name: p.name,
              category: p.category,
              // Precios calculados dinámicamente en servidor
              price: pricing.finalPrice,
              finalPrice: pricing.finalPrice,
              originalPrice: pricing.originalPrice,
              formattedPrice: pricing.formattedPrice,
              formattedOriginalPrice: pricing.formattedOriginalPrice,
              hasDiscount: pricing.hasActiveDiscount,
              hasActiveDiscount: pricing.hasActiveDiscount,
              discountPercent: pricing.discountPercent,
              discountStatus: pricing.discountStatus,
              savings: pricing.savings,
              formattedSavings: pricing.formattedSavings,
              tag: pricing.hasActiveDiscount ? `-${pricing.discountPercent}% OFF` : (p.tag || null),
              image: p.image || imageUrls[0],
              images: imageUrls,
              imagesDetail: images,
              description: p.description,
              sizes: parseSizes(p.sizes),
              composition: p.composition,
              color: p.color,
              stock: Number(p.stock ?? 50)
            };
          })
        );
        return publicWithImages;
      }
    } catch (err) {
      console.warn('[Public Products] Fallback local:', err.message);
    }
  }

  // Fallback local SQLite
  const localRows = sqliteDb.prepare('SELECT * FROM products WHERE is_active = 1').all();
  const localWithImages = await Promise.all(
    localRows.map(async (p) => {
      const images = await getProductImages(p.id);
      const defaultImg = p.image || '/images/products/prod-tshirt.jpg';
      const imageUrls = images.length > 0 ? images.map((i) => i.url) : [defaultImg];
      const pricing = computeProductPricing(p);

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: pricing.finalPrice,
        finalPrice: pricing.finalPrice,
        originalPrice: pricing.originalPrice,
        formattedPrice: pricing.formattedPrice,
        formattedOriginalPrice: pricing.formattedOriginalPrice,
        hasDiscount: pricing.hasActiveDiscount,
        hasActiveDiscount: pricing.hasActiveDiscount,
        discountPercent: pricing.discountPercent,
        discountStatus: pricing.discountStatus,
        savings: pricing.savings,
        formattedSavings: pricing.formattedSavings,
        tag: pricing.hasActiveDiscount ? `-${pricing.discountPercent}% OFF` : (p.tag || null),
        image: p.image || imageUrls[0],
        images: imageUrls,
        imagesDetail: images,
        description: p.description,
        sizes: parseSizes(p.sizes),
        composition: p.composition,
        color: p.color,
        stock: Number(p.stock ?? 50)
      };
    })
  );
  return localWithImages;
}

/**
 * Consulta un producto por ID con imágenes completas y precios promocionales
 */
export async function getProductById(id) {
  const pool = getNeonPool();

  if (pool) {
    try {
      const res = await neonQuery('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
      if (res.rows && res.rows.length > 0) {
        const p = res.rows[0];
        const images = await getProductImages(p.id);
        const defaultImg = p.image || '/images/products/prod-tshirt.jpg';
        const imageUrls = images.length > 0 ? images.map((i) => i.url) : [defaultImg];
        const pricing = computeProductPricing(p);

        return {
          ...p,
          ...pricing,
          image: p.image || imageUrls[0],
          images: images.length > 0 ? images : [{ id: `img-${p.id}-default`, url: defaultImg, is_primary: true }],
          imageUrls,
          sizes: parseSizes(p.sizes),
          isActive: Boolean(p.is_active)
        };
      }
    } catch (err) {
      console.warn('[GetProductById] Fallback local:', err.message);
    }
  }

  const row = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) return null;
  const images = await getProductImages(row.id);
  const defaultImg = row.image || '/images/products/prod-tshirt.jpg';
  const imageUrls = images.length > 0 ? images.map((i) => i.url) : [defaultImg];
  const pricing = computeProductPricing(row);

  return {
    ...row,
    ...pricing,
    image: row.image || imageUrls[0],
    images: images.length > 0 ? images : [{ id: `img-${row.id}-default`, url: defaultImg, is_primary: true }],
    imageUrls,
    sizes: parseSizes(row.sizes),
    isActive: Boolean(row.is_active)
  };
}

/**
 * Valida los parámetros de precios y promociones
 */
export function validateDiscountInput({ price, discount_active, discount_percent, discount_start_at, discount_end_at }) {
  if (price !== undefined) {
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 1000) {
      throw new Error('El precio normal del producto debe ser un número válido mayor o igual a $1.000 COP.');
    }
  }

  const isActive = Boolean(discount_active);
  let percent = 0;
  if (discount_percent !== undefined && discount_percent !== null && discount_percent !== '') {
    percent = Number(discount_percent);
    if (isNaN(percent) || percent < 0 || percent > 99) {
      throw new Error('El porcentaje de descuento debe ser un número entero entre 1% y 99%.');
    }
    if (isActive && (percent < 1 || percent > 99)) {
      throw new Error('Para activar una promoción, el porcentaje de descuento debe estar entre 1% y 99%.');
    }
  } else if (isActive) {
    throw new Error('Debes indicar un porcentaje de descuento válido entre 1% y 99% para activar la promoción.');
  }

  let startDate = null;
  if (discount_start_at) {
    const s = new Date(discount_start_at);
    if (isNaN(s.getTime())) {
      throw new Error('La fecha y hora de inicio del descuento no es válida.');
    }
    startDate = s;
  }

  let endDate = null;
  if (discount_end_at) {
    const e = new Date(discount_end_at);
    if (isNaN(e.getTime())) {
      throw new Error('La fecha y hora de finalización del descuento no es válida.');
    }
    endDate = e;
  }

  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    throw new Error('La fecha y hora de finalización debe ser posterior a la fecha de inicio.');
  }

  return {
    discount_active: isActive,
    discount_percent: Math.round(percent),
    discount_start_at: startDate ? startDate.toISOString() : null,
    discount_end_at: endDate ? endDate.toISOString() : null
  };
}

/**
 * Crea un producto nuevo en Neon PostgreSQL y SQLite
 */
export async function createProduct({
  name,
  category,
  price,
  description = '',
  sizes = ['S', 'M', 'L', 'XL'],
  composition = '100% Algodón Premium',
  color = 'Negro',
  stock = 50,
  is_active = true,
  discount_active = false,
  discount_percent = 0,
  discount_start_at = null,
  discount_end_at = null
}) {
  const numPrice = Math.round(Number(price));
  const numStock = Math.max(0, Math.round(Number(stock) || 0));
  const formattedPrice = formatCOP(numPrice);
  const cleanSizes = parseSizes(sizes);
  const sizesJson = JSON.stringify(cleanSizes);
  const activeBool = Boolean(is_active);

  const discountValidation = validateDiscountInput({
    discount_active,
    discount_percent,
    discount_start_at,
    discount_end_at
  });

  // Generar ID único amigable para URL
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const id = `prod-${slug || Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const defaultImage = '/images/products/prod-tshirt.jpg';

  let savedInNeon = false;

  // 1. Guardar en Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery(
        `INSERT INTO products (
          id, name, category, price, formatted_price, image, description, sizes,
          composition, color, stock, is_active, discount_percent, discount_active,
          discount_start_at, discount_end_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
        [
          id,
          name.trim(),
          category.trim(),
          numPrice,
          formattedPrice,
          defaultImage,
          description.trim(),
          sizesJson,
          composition.trim(),
          color.trim(),
          numStock,
          activeBool,
          discountValidation.discount_percent,
          discountValidation.discount_active,
          discountValidation.discount_start_at,
          discountValidation.discount_end_at
        ]
      );
      savedInNeon = true;
    } catch (err) {
      console.warn('[CreateProduct] Error insertando en Neon:', err.message);
    }
  }

  // 2. Sincronizar en SQLite
  try {
    sqliteDb.prepare(`
      INSERT INTO products (
        id, name, category, price, formatted_price, image, description, sizes,
        composition, color, stock, is_active, discount_percent, discount_active,
        discount_start_at, discount_end_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      category.trim(),
      numPrice,
      formattedPrice,
      defaultImage,
      description.trim(),
      sizesJson,
      composition.trim(),
      color.trim(),
      numStock,
      activeBool ? 1 : 0,
      discountValidation.discount_percent,
      discountValidation.discount_active ? 1 : 0,
      discountValidation.discount_start_at,
      discountValidation.discount_end_at
    );
  } catch (err) {
    console.warn('[CreateProduct] Error insertando localmente:', err.message);
  }

  const created = await getProductById(id);
  return created || {
    id,
    name: name.trim(),
    category: category.trim(),
    price: numPrice,
    formatted_price: formattedPrice,
    image: defaultImage,
    description: description.trim(),
    sizes: cleanSizes,
    composition: composition.trim(),
    color: color.trim(),
    stock: numStock,
    is_active: activeBool,
    savedInNeon
  };
}

/**
 * Actualiza un producto existente en Neon PostgreSQL y SQLite
 */
export async function updateProduct(id, fields) {
  const existing = await getProductById(id);
  if (!existing) {
    throw new Error(`Producto con ID ${id} no encontrado.`);
  }

  const name = fields.name !== undefined ? fields.name.trim() : existing.name;
  const category = fields.category !== undefined ? fields.category.trim() : existing.category;
  const price = fields.price !== undefined ? Math.round(Number(fields.price)) : existing.originalPrice || existing.price;
  if (isNaN(price) || price < 1000) {
    throw new Error('El precio del producto debe ser un número válido mayor o igual a $1.000 COP.');
  }
  const formattedPrice = formatCOP(price);
  const description = fields.description !== undefined ? fields.description.trim() : existing.description;
  const cleanSizes = fields.sizes !== undefined ? parseSizes(fields.sizes) : existing.sizes;
  const sizesJson = JSON.stringify(cleanSizes);
  const composition = fields.composition !== undefined ? fields.composition.trim() : existing.composition;
  const color = fields.color !== undefined ? fields.color.trim() : existing.color;
  const stock = fields.stock !== undefined ? Math.max(0, Math.round(Number(fields.stock))) : existing.stock;
  const isActive = fields.is_active !== undefined ? Boolean(fields.is_active) : existing.isActive;

  // Promociones y Descuentos
  const discountActive = fields.discount_active !== undefined ? Boolean(fields.discount_active) : existing.discountActive;
  const discountPercent = fields.discount_percent !== undefined ? Number(fields.discount_percent) : existing.discountPercent;
  const discountStartAt = fields.discount_start_at !== undefined ? fields.discount_start_at : existing.discountStartAt;
  const discountEndAt = fields.discount_end_at !== undefined ? fields.discount_end_at : existing.discountEndAt;

  const discountValidation = validateDiscountInput({
    price,
    discount_active: discountActive,
    discount_percent: discountPercent,
    discount_start_at: discountStartAt,
    discount_end_at: discountEndAt
  });

  // 1. Actualizar en Neon
  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery(
        `UPDATE products
         SET name = $1, category = $2, price = $3, formatted_price = $4, description = $5,
             sizes = $6, composition = $7, color = $8, stock = $9, is_active = $10,
             discount_percent = $11, discount_active = $12, discount_start_at = $13, discount_end_at = $14
         WHERE id = $15`,
        [
          name,
          category,
          price,
          formattedPrice,
          description,
          sizesJson,
          composition,
          color,
          stock,
          isActive,
          discountValidation.discount_percent,
          discountValidation.discount_active,
          discountValidation.discount_start_at,
          discountValidation.discount_end_at,
          id
        ]
      );
    } catch (err) {
      console.warn('[UpdateProduct] Error actualizando en Neon:', err.message);
    }
  }

  // 2. Actualizar en SQLite
  try {
    sqliteDb.prepare(`
      UPDATE products
      SET name = ?, category = ?, price = ?, formatted_price = ?, description = ?,
          sizes = ?, composition = ?, color = ?, stock = ?, is_active = ?,
          discount_percent = ?, discount_active = ?, discount_start_at = ?, discount_end_at = ?
      WHERE id = ?
    `).run(
      name,
      category,
      price,
      formattedPrice,
      description,
      sizesJson,
      composition,
      color,
      stock,
      isActive ? 1 : 0,
      discountValidation.discount_percent,
      discountValidation.discount_active ? 1 : 0,
      discountValidation.discount_start_at,
      discountValidation.discount_end_at,
      id
    );
  } catch (err) {
    console.warn('[UpdateProduct] Error actualizando en SQLite:', err.message);
  }

  return await getProductById(id);
}

/**
 * Actualiza la configuración de descuento y precio normal de un producto
 */
export async function updateProductDiscount(id, {
  price,
  discount_active,
  discount_percent,
  discount_start_at,
  discount_end_at
}) {
  const existing = await getProductById(id);
  if (!existing) {
    throw new Error(`Producto con ID ${id} no encontrado.`);
  }

  const normalPrice = price !== undefined ? Math.round(Number(price)) : existing.originalPrice || existing.price;
  const formattedPrice = formatCOP(normalPrice);

  const discountValidation = validateDiscountInput({
    price: normalPrice,
    discount_active,
    discount_percent,
    discount_start_at,
    discount_end_at
  });

  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery(
        `UPDATE products
         SET price = $1, formatted_price = $2, discount_active = $3,
             discount_percent = $4, discount_start_at = $5, discount_end_at = $6
         WHERE id = $7`,
        [
          normalPrice,
          formattedPrice,
          discountValidation.discount_active,
          discountValidation.discount_percent,
          discountValidation.discount_start_at,
          discountValidation.discount_end_at,
          id
        ]
      );
    } catch (err) {
      console.warn('[UpdateProductDiscount] Error Neon:', err.message);
    }
  }

  try {
    sqliteDb.prepare(`
      UPDATE products
      SET price = ?, formatted_price = ?, discount_active = ?,
          discount_percent = ?, discount_start_at = ?, discount_end_at = ?
      WHERE id = ?
    `).run(
      normalPrice,
      formattedPrice,
      discountValidation.discount_active ? 1 : 0,
      discountValidation.discount_percent,
      discountValidation.discount_start_at,
      discountValidation.discount_end_at,
      id
    );
  } catch (err) {
    console.warn('[UpdateProductDiscount] Error SQLite:', err.message);
  }

  return await getProductById(id);
}

/**
 * Conmuta rápidamente la activación de un descuento existente
 */
export async function toggleProductDiscount(id, discountActive) {
  const existing = await getProductById(id);
  if (!existing) {
    throw new Error(`Producto con ID ${id} no encontrado.`);
  }

  const activeBool = Boolean(discountActive);
  if (activeBool && existing.discountPercent <= 0) {
    throw new Error('No puedes activar el descuento sin configurar previamente un porcentaje mayor a 0%.');
  }

  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery('UPDATE products SET discount_active = $1 WHERE id = $2', [activeBool, id]);
    } catch (err) {
      console.warn('[ToggleProductDiscount] Error Neon:', err.message);
    }
  }

  try {
    sqliteDb.prepare('UPDATE products SET discount_active = ? WHERE id = ?').run(activeBool ? 1 : 0, id);
  } catch (err) {
    console.warn('[ToggleProductDiscount] Error SQLite:', err.message);
  }

  return await getProductById(id);
}

/**
 * Activa o desactiva un producto rápidamente
 */
export async function toggleProductStatus(id, isActive) {
  const activeBool = Boolean(isActive);

  const pool = getNeonPool();
  if (pool) {
    try {
      await neonQuery('UPDATE products SET is_active = $1 WHERE id = $2', [activeBool, id]);
    } catch (err) {
      console.warn('[ToggleProduct] Error Neon:', err.message);
    }
  }

  try {
    sqliteDb.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(activeBool ? 1 : 0, id);
  } catch (err) {
    console.warn('[ToggleProduct] Error SQLite:', err.message);
  }

  return { id, is_active: activeBool };
}

/**
 * Elimina un producto de forma segura verificando integridad transaccional
 */
export async function deleteProduct(id) {
  // 1. Verificar si el producto tiene órdenes de compra asociadas
  let orderCount = 0;

  const pool = getNeonPool();
  if (pool) {
    try {
      const res = await neonQuery('SELECT count(*) as count FROM order_items WHERE product_id = $1', [id]);
      orderCount = parseInt(res.rows[0].count, 10);
    } catch {
      // Ignorar si la tabla aún no tiene registros
    }
  }

  if (orderCount === 0) {
    try {
      const row = sqliteDb.prepare('SELECT count(*) as count FROM order_items WHERE product_id = ?').get(id);
      if (row) orderCount = row.count;
    } catch {
      // Fallback
    }
  }

  // 2. Si tiene pedidos asociados, no se destruye para preservar el historial contable y trazabilidad
  if (orderCount > 0) {
    await toggleProductStatus(id, false);
    return {
      success: true,
      hardDeleted: false,
      deactivated: true,
      message: `El producto está vinculado a ${orderCount} pedidos anteriores. Por integridad transaccional y fiscal, fue DESACTIVADO del catálogo público en lugar de eliminarse por completo.`
    };
  }

  // 3. Si no tiene pedidos asociados, se puede eliminar de forma definitiva
  if (pool) {
    try {
      await neonQuery('DELETE FROM products WHERE id = $1', [id]);
    } catch (err) {
      console.warn('[DeleteProduct] Error eliminando en Neon:', err.message);
    }
  }

  try {
    sqliteDb.prepare('DELETE FROM products WHERE id = ?').run(id);
  } catch (err) {
    console.warn('[DeleteProduct] Error eliminando en SQLite:', err.message);
  }

  return {
    success: true,
    hardDeleted: true,
    deactivated: false,
    message: 'Producto eliminado permanentemente del catálogo e inventario.'
  };
}
