import { db } from '../db/database.js';
import { getNeonPool, query as neonQuery } from '../db/neon.js';
import { getPublicActiveProducts, formatCOP } from './productService.js';
import { getSiteSettings } from './siteSettingsService.js';

export const DEFAULT_ASSISTANT_SETTINGS = {
  enabled: true,
  botName: 'Asistente URBAN STYLE',
  welcomeMessage: '¡Hola! 👋 Bienvenido a URBAN STYLE. Estoy aquí para ayudarte a encontrar lo que buscas. ¿Qué te gustaría descubrir hoy?',
  accentColor: '#FF5A1F',
  enableVisualCards: true,
  enableBestsellers: true,
  enableBudgetRecommendations: true,
  enableWhatsappHandoff: true,
  whatsappHandoffMessage: '¡Hola! Estuve conversando con el asistente virtual de URBAN STYLE y me gustaría recibir asesoría humana con mi compra.'
};

const SETTINGS_KEY = 'assistant_settings';

/**
 * Realiza un merge profundo para garantizar que ningún campo quede indefinido
 */
function deepMerge(target, source) {
  const result = { ...target };
  if (!source || typeof source !== 'object') return result;

  for (const key of Object.keys(source)) {
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && typeof target[key] === 'object') {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

/**
 * Obtiene la configuración del Asistente Virtual desde Neon PostgreSQL con fallback en SQLite
 */
export async function getAssistantSettings() {
  let settings = { ...DEFAULT_ASSISTANT_SETTINGS };

  // 1. Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT value FROM store_settings WHERE key = $1', [SETTINGS_KEY]);
      if (res.rows?.[0]?.value) {
        const parsed = JSON.parse(res.rows[0].value);
        return deepMerge(settings, parsed);
      }
    } catch (err) {
      console.warn('[Neon getAssistantSettings Notice]:', err.message);
    }
  }

  // 2. Fallback SQLite
  try {
    const row = db.prepare('SELECT value FROM store_settings WHERE key = ?').get(SETTINGS_KEY);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return deepMerge(settings, parsed);
    }
  } catch (err) {
    console.warn('[SQLite getAssistantSettings Notice]:', err.message);
  }

  return settings;
}

/**
 * Guarda la configuración del Asistente Virtual en Neon PostgreSQL y SQLite
 */
export async function saveAssistantSettings(newSettings) {
  const current = await getAssistantSettings();
  const merged = deepMerge(current, newSettings);
  const jsonStr = JSON.stringify(merged);
  const now = new Date().toISOString();

  // 1. Persistir en Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO store_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [SETTINGS_KEY, jsonStr]
      );
    } catch (err) {
      console.error('[Neon saveAssistantSettings Error]:', err.message);
    }
  }

  // 2. Persistir en SQLite
  try {
    db.prepare(
      `INSERT INTO store_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(SETTINGS_KEY, jsonStr, now);
  } catch (err) {
    console.error('[SQLite saveAssistantSettings Error]:', err.message);
  }

  return merged;
}

/**
 * Normaliza texto eliminando tildes, signos de puntuación y espacios redundantes
 */
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extrae presupuesto numérico en pesos colombianos de un texto de consulta
 * Soporta expresiones como: "menos de 100000", "hasta 150 mil", "100k", "menos de $120.000"
 */
function extractBudget(text) {
  const norm = normalizeText(text);

  // Buscar formato: "100k", "150 k"
  const kMatch = norm.match(/(\d+)\s*k\b/i);
  if (kMatch) {
    return parseInt(kMatch[1], 10) * 1000;
  }

  // Buscar formato: "100 mil", "200 mil"
  const milMatch = norm.match(/(\d+)\s*mil\b/i);
  if (milMatch) {
    return parseInt(milMatch[1], 10) * 1000;
  }

  // Buscar números con puntos o directos precedidos de "menos de", "hasta", "máximo", "debajo de"
  const underMatch = norm.match(/(?:menos de|hasta|maximo|debajo de|presupuesto de|por menos de|\$)\s*([\d\.,]+)/i);
  if (underMatch) {
    const rawNum = underMatch[1].replace(/\./g, '').replace(/,/g, '');
    const val = parseInt(rawNum, 10);
    if (!isNaN(val) && val > 1000) return val;
  }

  // Cualquier número de 5 o 6 dígitos presente en la consulta
  const anyNumMatch = norm.match(/\b(\d{5,7})\b/);
  if (anyNumMatch) {
    return parseInt(anyNumMatch[1], 10);
  }

  return null;
}

/**
 * Extrae tallas consultadas en el texto (ej: talla 40, talla M, talla L, 38)
 */
function extractSize(text) {
  const norm = normalizeText(text);

  // Formato: talla 40, talla m, talle 38, etc.
  const sizeMatch = norm.match(/(?:talla|talle|tamano|size)\s*([a-z0-9]+)/i);
  if (sizeMatch) {
    return sizeMatch[1].toUpperCase();
  }

  // Números típicos de calzado: 37, 38, 39, 40, 41, 42, 43
  const shoeSize = norm.match(/\b(3[6-9]|4[0-5])\b/);
  if (shoeSize) {
    return shoeSize[1];
  }

  // Tallas de ropa: xs, s, m, l, xl, xxl
  const clothingSize = norm.match(/\b(xs|s|m|l|xl|xxl)\b/i);
  if (clothingSize) {
    return clothingSize[1].toUpperCase();
  }

  return null;
}

/**
 * Consulta los productos más vendidos desde Neon PostgreSQL a partir de órdenes reales no canceladas
 */
export async function getBestsellerProducts(limit = 4) {
  const allActive = await getPublicActiveProducts();
  const activeMap = new Map();
  allActive.forEach((p) => {
    activeMap.set(String(p.id), p);
    activeMap.set(normalizeText(p.name), p);
  });

  const bestsellers = [];
  const seenIds = new Set();

  // 1. Consultar agregación en Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      const sql = `
        SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY oi.product_id, oi.product_name
        ORDER BY units_sold DESC
        LIMIT 10
      `;
      const res = await pool.query(sql);
      if (res.rows && res.rows.length > 0) {
        for (const row of res.rows) {
          const match = activeMap.get(String(row.product_id)) || activeMap.get(normalizeText(row.product_name));
          if (match && !seenIds.has(match.id) && match.stock > 0) {
            seenIds.add(match.id);
            bestsellers.push({
              ...match,
              unitsSold: parseInt(row.units_sold || 0, 10)
            });
            if (bestsellers.length >= limit) break;
          }
        }
      }
    } catch (err) {
      console.warn('[Neon Bestsellers Notice]:', err.message);
    }
  }

  // 2. Si no hay suficientes órdenes aún, complementar con productos activos con descuento o destacados
  if (bestsellers.length < limit) {
    const fallbackSorted = [...allActive]
      .filter((p) => !seenIds.has(p.id) && p.stock > 0)
      .sort((a, b) => {
        // Priorizar productos con descuento activo
        if (a.hasActiveDiscount && !b.hasActiveDiscount) return -1;
        if (!a.hasActiveDiscount && b.hasActiveDiscount) return 1;
        return (b.stock || 0) - (a.stock || 0);
      });

    for (const p of fallbackSorted) {
      bestsellers.push(p);
      if (bestsellers.length >= limit) break;
    }
  }

  return bestsellers;
}

/**
 * Consulta productos filtrando por criterios semánticos
 */
export async function searchStoreProducts({ query = '', category = '', gender = '', maxPrice = null, minPrice = null, size = null, onlyDiscounts = false, limit = 4 } = {}) {
  const allActive = await getPublicActiveProducts();
  const normQuery = normalizeText(query);
  const normCategory = normalizeText(category);
  const normGender = normalizeText(gender);

  let filtered = allActive.filter((p) => p.stock > 0);

  // Filtro por descuentos
  if (onlyDiscounts) {
    filtered = filtered.filter((p) => p.hasActiveDiscount || (p.discountPercent && p.discountPercent > 0));
  }

  // Filtro por presupuesto
  if (maxPrice !== null && !isNaN(maxPrice)) {
    filtered = filtered.filter((p) => (p.price || p.finalPrice) <= maxPrice);
  }
  if (minPrice !== null && !isNaN(minPrice)) {
    filtered = filtered.filter((p) => (p.price || p.finalPrice) >= minPrice);
  }

  // Filtro por categoría o departamento
  if (normCategory) {
    filtered = filtered.filter((p) => {
      const pCat = normalizeText(p.category || '');
      const pDept = normalizeText(p.department || '');
      return pCat.includes(normCategory) || pDept.includes(normCategory) || normCategory.includes(pCat);
    });
  }

  // Filtro por género / departamento
  if (normGender) {
    filtered = filtered.filter((p) => {
      const pDept = normalizeText(p.department || '');
      const pDesc = normalizeText(p.description || '');
      const pName = normalizeText(p.name || '');
      if (normGender.includes('hombre') || normGender.includes('caballero')) {
        return pDept.includes('hombre') || pDept.includes('men') || pDept.includes('unisex') || (!pDept.includes('mujer') && !pDesc.includes('mujer'));
      }
      if (normGender.includes('mujer') || normGender.includes('dama')) {
        return pDept.includes('mujer') || pDept.includes('women') || pDept.includes('unisex') || pDesc.includes('mujer') || pName.includes('mujer');
      }
      return true;
    });
  }

  // Filtro por talla
  if (size) {
    const targetSize = normalizeText(size);
    filtered = filtered.filter((p) => {
      if (!Array.isArray(p.sizes) || p.sizes.length === 0) return true;
      return p.sizes.some((s) => normalizeText(String(s)) === targetSize || normalizeText(String(s)).includes(targetSize));
    });
  }

  // Filtro de texto libre si hay consulta
  if (normQuery) {
    const keywords = normQuery.split(/\s+/).filter((w) => w.length > 2);
    filtered = filtered.filter((p) => {
      const pText = normalizeText(`${p.name} ${p.category} ${p.description || ''} ${p.brand || ''} ${p.color || ''}`);
      return keywords.some((kw) => pText.includes(kw));
    });
  }

  // Si después de todos los filtros quedó vacío y había búsqueda de texto, relajar para dar alternativas reales
  if (filtered.length === 0 && (normQuery || normCategory || maxPrice)) {
    // Si buscaba por presupuesto, devolver los más económicos
    if (maxPrice !== null) {
      filtered = [...allActive]
        .filter((p) => p.stock > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, limit);
    } else {
      // Devolver los más populares o con descuento
      filtered = allActive.filter((p) => p.stock > 0).slice(0, limit);
    }
  }

  return filtered.slice(0, limit);
}

/**
 * Consulta disponibilidad y stock específico de un producto o categoría y talla
 */
export async function checkProductAvailability(productQuery, sizeQuery) {
  const allActive = await getPublicActiveProducts();
  const normProd = normalizeText(productQuery);
  const normSize = sizeQuery ? normalizeText(sizeQuery) : null;

  // 1. Buscar coincidencia por nombre de producto
  let matched = allActive.filter((p) => {
    const pName = normalizeText(p.name);
    return pName.includes(normProd) || normProd.includes(pName);
  });

  // 2. Si no hubo coincidencia por nombre, buscar por categoría, sinónimos o descripción
  if (matched.length === 0) {
    matched = allActive.filter((p) => {
      const pCat = normalizeText(p.category || '');
      const pDept = normalizeText(p.department || '');
      const pDesc = normalizeText(p.description || '');

      // Mapeo semántico de términos urbanos
      const isShoe = /zapatilla|tenis|sneaker|calzado|bota/i.test(normProd) && /zapatilla|calzado/i.test(`${pCat} ${pDept}`);
      const isShirt = /camiseta|remera|tshirt/i.test(normProd) && /camiseta/i.test(`${pCat} ${pDept}`);
      const isHoodie = /hoodie|sudadera|buzo/i.test(normProd) && /sudadera/i.test(`${pCat} ${pDept}`);
      const isPants = /pantalon|cargo|jogger/i.test(normProd) && /pantalon/i.test(`${pCat} ${pDept}`);
      const isJacket = /chaqueta|bomber|jacket/i.test(normProd) && /chaqueta/i.test(`${pCat} ${pDept}`);
      const isCap = /gorra|cap/i.test(normProd) && /gorra/i.test(`${pCat} ${pDept}`);
      const isAccessory = /cadena|collar|accesorio/i.test(normProd) && /accesorio/i.test(`${pCat} ${pDept}`);

      return isShoe || isShirt || isHoodie || isPants || isJacket || isCap || isAccessory || pCat.includes(normProd) || pDesc.includes(normProd);
    });
  }

  if (matched.length === 0) {
    return {
      found: false,
      message: `No encontré en nuestro inventario actual una prenda que coincida con "${productQuery}". Te invito a ver nuestras piezas disponibles:`,
      alternatives: allActive.filter((p) => p.stock > 0).slice(0, 3)
    };
  }

  // Si se consultó una talla específica
  if (normSize) {
    const withSize = matched.filter((p) => {
      if (!Array.isArray(p.sizes) || p.sizes.length === 0) return false;
      return p.sizes.some((s) => normalizeText(String(s)) === normSize || normalizeText(String(s)).includes(normSize));
    });

    if (withSize.length > 0) {
      const productNames = withSize.map((p) => `**${p.name}** (${formatCOP(p.price)})`).join(', ');
      return {
        found: true,
        inStock: true,
        sizeAvailable: true,
        products: withSize,
        product: withSize[0],
        message: `¡Sí! Tenemos disponibilidad en talla **${sizeQuery.toUpperCase()}** en las siguientes opciones: ${productNames}. ¿Te gustaría que te ayude a ordenar alguna de ellas?`
      };
    } else {
      // Mostrar las tallas disponibles de los productos encontrados
      const allSizesFound = [...new Set(matched.flatMap((p) => p.sizes || []))];
      return {
        found: true,
        inStock: true,
        sizeAvailable: false,
        products: matched.slice(0, 3),
        product: matched[0],
        message: `En este momento no nos queda la talla **${sizeQuery.toUpperCase()}** para esa categoría, pero tenemos disponibles estas tallas: **${allSizesFound.join(', ')}**. Aquí tienes las prendas disponibles:`
      };
    }
  }

  // Sin talla específica, dar el resumen del primer producto coincidente
  const target = matched[0];
  const sizes = Array.isArray(target.sizes) ? target.sizes : [];
  return {
    found: true,
    inStock: target.stock > 0,
    products: matched.slice(0, 3),
    product: target,
    message: `**${target.name}** está disponible con un stock de ${target.stock} unidades. Tallas disponibles: **${sizes.join(', ')}**. Precio: **${formatCOP(target.price)}**${target.hasActiveDiscount ? ` (Descuento especial de -${target.discountPercent}%)` : ''}.`
  };
}

/**
 * Registra una conversación de forma asíncrona para métricas del panel administrativo
 */
async function logConversation({ sessionId, userMessage, assistantResponse, intent, productsSuggested }) {
  const jsonProducts = JSON.stringify((productsSuggested || []).map((p) => ({ id: p.id, name: p.name, price: p.price })));

  // 1. Neon PostgreSQL
  const pool = getNeonPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO assistant_conversations (session_id, user_message, assistant_response, intent, products_suggested, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sessionId || 'anon', userMessage, assistantResponse, intent, jsonProducts]
      );
    } catch (e) {
      // Ignorar para no bloquear respuesta al cliente
    }
  }

  // 2. SQLite
  try {
    db.prepare(
      `INSERT INTO assistant_conversations (session_id, user_message, assistant_response, intent, products_suggested, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(sessionId || 'anon', userMessage, assistantResponse, intent, jsonProducts);
  } catch (e) {
    // Ignorar
  }
}

/**
 * Procesa la consulta del usuario con el motor conversacional contextual de URBAN STYLE
 */
export async function processUserMessage({ message, sessionId = 'default' }) {
  const settings = await getAssistantSettings();
  if (!settings.enabled) {
    return {
      text: 'El asistente virtual se encuentra temporalmente en mantenimiento. Puedes contactar directamente a nuestro equipo por WhatsApp.',
      products: [],
      intent: 'DISABLED',
      suggestedReplies: []
    };
  }

  const siteSettings = await getSiteSettings();
  const rawMsg = (message || '').trim();
  const norm = normalizeText(rawMsg);

  if (!norm) {
    return {
      text: settings.welcomeMessage || '¡Hola! ¿En qué prenda o estilo te gustaría que te asesore hoy?',
      products: [],
      intent: 'WELCOME',
      suggestedReplies: ['🔥 Más vendidos', '🏷️ Ofertas activas', '👟 Ver zapatillas', '💬 Hablar por WhatsApp']
    };
  }

  let textResponse = '';
  let products = [];
  let intent = 'UNKNOWN';
  let suggestedReplies = [];

  // =========================================================================
  // 1. INTENCIÓN: SALUDO O BIENVENIDA
  // =========================================================================
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos|hello|hi)\b/i.test(norm) && norm.length < 25) {
    intent = 'GREETING';
    textResponse = '¡Hola! 👋 ¡Qué gusto saludarte! Soy tu asesor virtual en URBAN STYLE. Estoy conectado en tiempo real con nuestra tienda para ayudarte a encontrar prendas streetwear exclusivas, consultar tallas, precios, ofertas y disponibilidad. ¿Qué tipo de prenda o outfit estás buscando hoy?';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '👟 Zapatillas urbanas', '👕 Camisetas Oversize'];
  }

  // =========================================================================
  // 2. INTENCIÓN: CONTACTO HUMANO O DERIVACIÓN A WHATSAPP
  // =========================================================================
  else if (/whatsapp|asesor humano|persona real|humano|atencion al cliente|numero|telefono|contactar|hablar con alguien/i.test(norm)) {
    intent = 'WHATSAPP_HANDOFF';
    const phone = siteSettings.contactWhatsapp || siteSettings.contactPhone || '3001234567';
    textResponse = `¡Por supuesto! Si prefieres una atención 100% personalizada con uno de nuestros asesores de moda humanos, puedes escribirnos directamente a nuestra línea oficial de WhatsApp (${phone}). Te responderemos de inmediato para ayudarte con pedidos, medidas personalizadas o envíos.`;
    suggestedReplies = ['🔥 Ver más vendidos', '🏷️ Ver ofertas', '💳 ¿Cómo comprar?'];
  }

  // =========================================================================
  // 3. INTENCIÓN: PRODUCTOS MÁS VENDIDOS / TENDENCIAS / POPULARES
  // =========================================================================
  else if (/mas vendido|bestseller|mas popular|tendencia|lo que mas se vende|lo mas vendido|lo mas pedido|favorito/i.test(norm)) {
    intent = 'BESTSELLERS';
    if (settings.enableBestsellers) {
      products = await getBestsellerProducts(4);
      textResponse = '🔥 ¡Aquí tienes los productos más vendidos y populares en URBAN STYLE! Son las prendas favoritas de nuestra comunidad urbana por su diseño, calidad y estilo:';
    } else {
      products = await searchStoreProducts({ limit: 4 });
      textResponse = 'Aquí tienes algunas de nuestras piezas destacadas de la colección actual:';
    }
    suggestedReplies = ['🏷️ ¿Hay promociones?', '👟 Ver zapatillas', '💬 Contactar a un asesor'];
  }

  // =========================================================================
  // 4. INTENCIÓN: OFERTAS, DESCUENTOS Y REBAJAS
  // =========================================================================
  else if (/descuento|oferta|rebaja|promocion|promo|liquidacion|sale|barato/i.test(norm)) {
    intent = 'DISCOUNTS';
    products = await searchStoreProducts({ onlyDiscounts: true, limit: 4 });
    if (products.length > 0) {
      textResponse = `🎉 ¡Buenas noticias! Tenemos promociones exclusivas con hasta un ${Math.max(...products.map((p) => p.discountPercent || 0))}% de descuento en prendas seleccionadas. Aquí tienes las mejores ofertas activas hoy:`;
    } else {
      products = await searchStoreProducts({ limit: 3 });
      textResponse = 'En este momento todos nuestros productos tienen sus precios oficiales más competitivos con envío a toda Colombia. Te comparto nuestras piezas destacadas:';
    }
    suggestedReplies = ['🔥 Ver más vendidos', '👟 Ver calzado', '📦 ¿Cuánto cuesta el envío?'];
  }

  // =========================================================================
  // 5. INTENCIÓN: BÚSQUEDA POR PRESUPUESTO
  // =========================================================================
  else if (extractBudget(rawMsg) !== null && /menos de|hasta|debajo de|presupuesto|por menos|maximo|\$|\d+k|\d+ mil/i.test(norm)) {
    intent = 'BUDGET_SEARCH';
    const budget = extractBudget(rawMsg);
    products = await searchStoreProducts({ maxPrice: budget, limit: 4 });

    if (products.length > 0) {
      textResponse = `🎯 Encontré estas excelentes opciones dentro de tu presupuesto de **${formatCOP(budget)}** o menos:`;
    } else {
      const affordable = await searchStoreProducts({ limit: 4 });
      textResponse = `No encontré artículos por debajo de ${formatCOP(budget)}, pero aquí tienes nuestras opciones con mejor relación estilo-precio en la tienda:`;
      products = affordable;
    }
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '💳 Métodos de pago'];
  }

  // =========================================================================
  // 6. INTENCIÓN: CONSULTA DE DISPONIBILIDAD Y TALLAS ESPECÍFICAS
  // =========================================================================
  else if (/talla|talle|disponible|disponibilidad|queda en|tienen en|tienen la/i.test(norm) && extractSize(rawMsg)) {
    intent = 'SIZE_AVAILABILITY';
    const targetSize = extractSize(rawMsg);

    // Intentar extraer el tipo de producto
    let prodQuery = '';
    if (/zapatilla|tenis|sneaker|air force|zapato/i.test(norm)) prodQuery = 'zapatillas';
    else if (/camiseta|remera|tshirt|urban artifacts/i.test(norm)) prodQuery = 'camiseta';
    else if (/hoodie|sudadera|buzo|midnight raw/i.test(norm)) prodQuery = 'hoodie';
    else if (/pantalon|cargo|tactical/i.test(norm)) prodQuery = 'pantalon';
    else if (/chaqueta|bomber|jacket/i.test(norm)) prodQuery = 'bomber';
    else if (/gorra|cap/i.test(norm)) prodQuery = 'gorra';
    else if (/cadena|collar|joya|accesorios/i.test(norm)) prodQuery = 'cadena';

    if (prodQuery) {
      const avail = await checkProductAvailability(prodQuery, targetSize);
      textResponse = avail.message;
      if (avail.products && avail.products.length > 0) {
        products = avail.products;
      } else if (avail.product) {
        products = [avail.product];
      } else if (avail.alternatives) {
        products = avail.alternatives;
      }
    } else {
      // Búsqueda general de productos en esa talla
      products = await searchStoreProducts({ size: targetSize, limit: 4 });
      if (products.length > 0) {
        textResponse = `✅ ¡Sí! Tenemos disponibilidad en talla **${targetSize}** en las siguientes prendas:`;
      } else {
        textResponse = `En este momento no contamos con prendas disponibles en talla ${targetSize}, pero te recomiendo explorar nuestra colección disponible:`;
        products = await searchStoreProducts({ limit: 3 });
      }
    }
    suggestedReplies = ['🔥 Ver más vendidos', '🏷️ Ver ofertas', '📦 Información de envíos'];
  }

  // =========================================================================
  // 7. INTENCIÓN: RECOMENDACIÓN DE OUTFIT / ESTILO
  // =========================================================================
  else if (/outfit|combinar|pinta|estilo|streetwear|ropa completa|conjunto/i.test(norm)) {
    intent = 'OUTFIT_RECOMMENDATION';
    const allProds = await getPublicActiveProducts();
    const tops = allProds.filter((p) => /camisetas|sudaderas|chaquetas/i.test(p.category) && p.stock > 0);
    const bottoms = allProds.filter((p) => /pantalones/i.test(p.category) && p.stock > 0);
    const shoes = allProds.filter((p) => /zapatillas|calzado/i.test(p.category) && p.stock > 0);

    products = [tops[0], bottoms[0], shoes[0]].filter(Boolean);
    textResponse = '✨ ¡Te tengo una combinación de outfit streetwear espectacular! Combina comodidad, volumen y actitud urbana auténtica:';
    suggestedReplies = ['👟 Ver zapatillas', '🔥 Más vendidos', '🏷️ Ver ofertas'];
  }

  // =========================================================================
  // 8. INTENCIÓN: ENVÍOS, COSTOS Y COBERTURA
  // =========================================================================
  else if (/envio|cuanto demora|tiempo de entrega|flete|despacho|cobertura|servientrega|coordinadora|interrapidisimo/i.test(norm)) {
    intent = 'SHIPPING_INFO';
    textResponse = '📦 **Información de Envíos en URBAN STYLE:**\n\n' +
      '• **Cobertura:** Realizamos envíos a toda Colombia a través de transportadoras líderes (Servientrega, Coordinadora, Inter Rapidísimo y TCC vía Mi Paquete).\n' +
      '• **Tiempos de entrega:** De 24 a 48 horas hábiles para ciudades principales (Bogotá, Medellín, Cali, Barranquilla) y 3 a 5 días para trayectos especiales.\n' +
      '• **Guía con seguimiento:** Al confirmar tu pedido te enviamos el número de guía para rastrear tu paquete en tiempo real.\n' +
      '• **Envío Contra Entrega:** Puedes pagar en efectivo cuando recibas en la puerta de tu casa.';
    suggestedReplies = ['💳 Métodos de pago', '🔥 Ver productos', '💬 Hablar por WhatsApp'];
  }

  // =========================================================================
  // 9. INTENCIÓN: MEDIOS DE PAGO Y PAGO CONTRA ENTREGA
  // =========================================================================
  else if (/pago|contraentrega|contra entrega|efectivo|nequi|daviplata|tarjeta|bancolombia|como pago/i.test(norm)) {
    intent = 'PAYMENT_INFO';
    textResponse = '💳 **Medios de Pago Disponibles:**\n\n' +
      '1. **Pago Contra Entrega (Paga en Casa):** Recibe tu paquete y paga en efectivo al mensajero en la puerta de tu domicilio.\n' +
      '2. **Transferencias Digitales:** Nequi, Daviplata y Bancolombia directo.\n' +
      '3. **Tarjetas Débito y Crédito:** Procesamiento seguro con confirmación inmediata.\n\n' +
      'El proceso es 100% confiable y seguro.';
    suggestedReplies = ['📦 ¿Cuánto cuesta el envío?', '🔥 Ver más vendidos', '💬 Chatear con un asesor'];
  }

  // =========================================================================
  // 10. INTENCIÓN: CAMBIOS, DEVOLUCIONES Y GARANTÍA
  // =========================================================================
  else if (/cambio|devolucion|garantia|si no me queda|talla incorrecta|defectuoso/i.test(norm)) {
    intent = 'RETURNS_WARRANTY';
    textResponse = '🛡️ **Garantía y Política de Cambios:**\n\n' +
      '• Cuentas con **30 días calendario** para solicitar cambio de talla o referencia.\n' +
      '• La prenda debe estar sin uso, con sus etiquetas y empaque original.\n' +
      '• Garantía de calidad de 90 días por defectos de fabricación o confección.\n' +
      '• Puedes gestionar tu cambio fácil y rápido comunicándote con nuestro equipo por WhatsApp.';
    suggestedReplies = ['💬 Hablar con soporte', '🔥 Ver catálogo', '👟 Ver zapatillas'];
  }

  // =========================================================================
  // 11. INTENCIÓN: CÓMO COMPRAR / PEDIR
  // =========================================================================
  else if (/como comprar|como hago el pedido|como pido|quiero comprar|pasos para comprar/i.test(norm)) {
    intent = 'HOW_TO_BUY';
    textResponse = '🛒 **Comprar en URBAN STYLE es muy fácil:**\n\n' +
      '1. Explora nuestras colecciones y selecciona tu prenda favorita.\n' +
      '2. Elige tu talla y pulsa **"Añadir al Carrito"**.\n' +
      '3. Abre tu carrito y pulsa **"Finalizar Compra"**.\n' +
      '4. Ingresa tus datos de envío, selecciona si deseas **Pago Contra Entrega** o transferencia, ¡y listo!\n\n' +
      'Recibirás confirmación inmediata y número de seguimiento en tu correo.';
    suggestedReplies = ['🔥 Ver productos', '👟 Ver zapatillas', '🏷️ Ver ofertas'];
  }

  // =========================================================================
  // 12. INTENCIÓN: BÚSQUEDA POR CATEGORÍA O PRENDA ESPECÍFICA
  // =========================================================================
  else if (/zapatilla|tenis|sneaker|calzado|bota/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ category: 'zapatillas', limit: 4 });
    textResponse = '👟 ¡Aquí tienes nuestras zapatillas urbanas y sneakers disponibles! Diseñadas para destacar en la calle con máximo confort:';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '📏 Guía de tallas'];
  } else if (/camiseta|tshirt|remera/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ category: 'camisetas', limit: 4 });
    textResponse = '👕 Aquí tienes nuestras camisetas streetwear de alto gramaje y corte contemporáneo:';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '📦 Tiempos de entrega'];
  } else if (/hoodie|sudadera|buzo/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ category: 'sudaderas', limit: 4 });
    textResponse = '🧥 Aquí tienes nuestros hoodies y sudaderas premium con silueta oversize y confort térmico:';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '💬 Asesoría por WhatsApp'];
  } else if (/pantalon|cargo|jogger/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ category: 'pantalones', limit: 4 });
    textResponse = '👖 Aquí tienes nuestros pantalones estilo cargo y joggers tácticos:';
    suggestedReplies = ['🔥 Más vendidos', '👟 Ver zapatillas', '💳 Formas de pago'];
  } else if (/chaqueta|jacket|bomber/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ category: 'chaquetas', limit: 4 });
    textResponse = '🧥 Aquí tienes nuestras chaquetas bomber y prendas de abrigo con actitud urbana:';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '💬 Contactar a un asesor'];
  } else if (/gorra|cap|cadena|accesorio/i.test(norm)) {
    intent = 'CATEGORY_SEARCH';
    products = await searchStoreProducts({ query: 'accesorio gorra cadena', limit: 4 });
    textResponse = '🧢 Accesorios y complementos para llevar tu look al siguiente nivel:';
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ver ofertas', '📦 Costo de envío'];
  }

  // =========================================================================
  // 13. INTENCIÓN: GÉNERO (HOMBRES / MUJERES)
  // =========================================================================
  else if (/hombre|caballero|para el|chico/i.test(norm)) {
    intent = 'GENDER_SEARCH';
    products = await searchStoreProducts({ gender: 'hombre', limit: 4 });
    textResponse = '⚡ Aquí tienes prendas seleccionadas de nuestra línea masculina y unisex:';
    suggestedReplies = ['🔥 Más vendidos', '👟 Zapatillas', '👕 Camisetas'];
  } else if (/mujer|dama|para ella|chica/i.test(norm)) {
    intent = 'GENDER_SEARCH';
    products = await searchStoreProducts({ gender: 'mujer', limit: 4 });
    textResponse = '🔥 Aquí tienes prendas recomendadas con siluetas versátiles para mujer:';
    suggestedReplies = ['🔥 Más vendidos', '👟 Zapatillas', '🧥 Hoodies'];
  }

  // =========================================================================
  // 14. FALLBACK GENERAL CON BÚSQUEDA INTELIGENTE
  // =========================================================================
  else {
    intent = 'GENERAL_QUERY';
    // Buscar si coincide con alguna palabra del catálogo
    products = await searchStoreProducts({ query: rawMsg, limit: 4 });

    if (products.length > 0) {
      textResponse = `Encontré estas prendas en nuestra tienda que se ajustan a lo que buscas ("${rawMsg}"):`;
    } else {
      products = await getBestsellerProducts(3);
      textResponse = `No encontré una coincidencia exacta para "${rawMsg}", pero aquí tienes lo más destacado y solicitado en URBAN STYLE. También puedes preguntarme por una prenda específica (zapatillas, hoodies, camisetas, pantalones) o consultar a un asesor por WhatsApp.`;
    }
    suggestedReplies = ['🔥 Más vendidos', '🏷️ Ofertas', '💬 Hablar por WhatsApp'];
  }

  // Si las tarjetas visuales están desactivadas en los ajustes, no enviar array de productos para renderizado visual
  const finalProducts = settings.enableVisualCards ? products : [];

  // Registrar en la base de datos en segundo plano
  logConversation({
    sessionId,
    userMessage: rawMsg,
    assistantResponse: textResponse,
    intent,
    productsSuggested: products
  }).catch(() => {});

  return {
    text: textResponse,
    products: finalProducts,
    intent,
    suggestedReplies
  };
}

/**
 * Obtiene métricas y estadísticas de uso del Asistente Virtual para el Panel Administrativo
 */
export async function getAssistantStats() {
  let totalConversations = 0;
  let totalToday = 0;
  let topIntents = [];
  let recentLogs = [];

  const pool = getNeonPool();
  if (pool) {
    try {
      const countRes = await pool.query('SELECT count(*) as count FROM assistant_conversations');
      totalConversations = parseInt(countRes.rows[0]?.count || 0, 10);

      const todayRes = await pool.query("SELECT count(*) as count FROM assistant_conversations WHERE created_at >= CURRENT_DATE");
      totalToday = parseInt(todayRes.rows[0]?.count || 0, 10);

      const intentsRes = await pool.query(`
        SELECT intent, count(*) as count
        FROM assistant_conversations
        WHERE intent IS NOT NULL
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 5
      `);
      topIntents = intentsRes.rows.map((r) => ({ intent: r.intent, count: parseInt(r.count, 10) }));

      const recentRes = await pool.query(`
        SELECT id, session_id, user_message, assistant_response, intent, created_at
        FROM assistant_conversations
        ORDER BY created_at DESC
        LIMIT 10
      `);
      recentLogs = recentRes.rows;
      return { totalConversations, totalToday, topIntents, recentLogs };
    } catch (err) {
      console.warn('[Neon Assistant Stats Notice]:', err.message);
    }
  }

  // Fallback SQLite
  try {
    const row = db.prepare('SELECT count(*) as count FROM assistant_conversations').get();
    totalConversations = row?.count || 0;

    const todayRow = db.prepare("SELECT count(*) as count FROM assistant_conversations WHERE date(created_at) = date('now')").get();
    totalToday = todayRow?.count || 0;

    const intentsRows = db.prepare(`
      SELECT intent, count(*) as count
      FROM assistant_conversations
      WHERE intent IS NOT NULL
      GROUP BY intent
      ORDER BY count DESC
      LIMIT 5
    `).all();
    topIntents = intentsRows;

    const recentRows = db.prepare(`
      SELECT id, session_id, user_message, assistant_response, intent, created_at
      FROM assistant_conversations
      ORDER BY id DESC
      LIMIT 10
    `).all();
    recentLogs = recentRows;
  } catch (err) {
    console.warn('[SQLite Assistant Stats Notice]:', err.message);
  }

  return { totalConversations, totalToday, topIntents, recentLogs };
}
