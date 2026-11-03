/**
 * Utilidades para manejo, parseo y formateo de moneda en Pesos Colombianos (COP).
 * 
 * En Colombia, los precios en COP son comúnmente ingresados con separadores de miles
 * mediante puntos (ej: "100.000", "1.000", "249.900"), con símbolos de moneda ("$ 100.000 COP")
 * o con formato estándar sin puntuación ("100000").
 * 
 * Esta función normaliza de forma segura cualquier entrada numérica humana a un número entero limpio en COP.
 */

/**
 * Convierte y normaliza de forma robusta cualquier valor o texto a un número entero en COP.
 * @param {string|number} val - Valor a parsear (ej: "100.000", "$ 120.000 COP", "1,000", 100000)
 * @returns {number} Número entero en COP o NaN si es inválido
 */
export function parseCOP(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : Math.round(val);

  let s = String(val).trim();
  if (!s) return NaN;

  // Limpiar signos de moneda ($), texto ("COP"), espacios y caracteres no numéricos al inicio (excepto -)
  s = s.replace(/[\$\sCOPcop]/gi, '').replace(/^[^\d\-]+/, '');
  if (!s) return NaN;

  // Si incluye tanto punto como coma (ej. 100.000,00 o 100,000.00)
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato latino: 100.000,50 -> quitar puntos de miles y usar coma como decimal
      const integerPart = s.slice(0, lastComma).replace(/\./g, '');
      const decimalPart = s.slice(lastComma + 1);
      s = `${integerPart}.${decimalPart}`;
    } else {
      // Formato anglo: 100,000.50 -> quitar comas de miles y usar punto como decimal
      const integerPart = s.slice(0, lastDot).replace(/,/g, '');
      const decimalPart = s.slice(lastDot + 1);
      s = `${integerPart}.${decimalPart}`;
    }
    const num = parseFloat(s);
    return isNaN(num) ? NaN : Math.round(num);
  }

  // Múltiples puntos o múltiples comas (ej. 1.000.000 o 1,000,000) -> son separadores de miles
  const dotCount = (s.match(/\./g) || []).length;
  const commaCount = (s.match(/,/g) || []).length;

  if (dotCount > 1) {
    s = s.replace(/\./g, '');
    const num = parseFloat(s);
    return isNaN(num) ? NaN : Math.round(num);
  }
  if (commaCount > 1) {
    s = s.replace(/,/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? NaN : Math.round(num);
  }

  // Exactamente un punto o una coma (ej. "100.000", "1.000", "249.900", "100,000")
  if (dotCount === 1) {
    const parts = s.split('.');
    // En Colombia, 3 dígitos tras el punto (ej: .000, .500, .900) es siempre separador de miles
    if (parts[1].length === 3) {
      s = parts[0] + parts[1];
    } else if (parts[1].length === 1 || parts[1].length === 2) {
      // Si la parte entera ya es >= 1000 (ej: 1500.50), redondear la parte entera
      if (Number(parts[0]) >= 1000) {
        s = parts[0];
      } else {
        s = s.replace('.', '');
      }
    } else {
      s = s.replace('.', '');
    }
  } else if (commaCount === 1) {
    const parts = s.split(',');
    // 3 dígitos tras la coma es separador de miles
    if (parts[1].length === 3) {
      s = parts[0] + parts[1];
    } else if (parts[1].length === 1 || parts[1].length === 2) {
      if (Number(parts[0]) >= 1000) {
        s = parts[0];
      } else {
        s = s.replace(',', '');
      }
    } else {
      s = s.replace(',', '');
    }
  }

  const result = Math.round(Number(s));
  return isNaN(result) ? NaN : result;
}

/**
 * Formatea un valor numérico a moneda colombiana estándar ($ COP).
 * @param {string|number} price - Precio a formatear
 * @returns {string} Texto formateado (ej: "$100.000 COP")
 */
export function formatCOP(price) {
  const num = parseCOP(price);
  if (isNaN(num) || num === 0) return '$0 COP';
  return `$${num.toLocaleString('es-CO')} COP`;
}
