/**
 * Configuración de navegación y mensajes de URBAN STYLE
 */

export const ANNOUNCEMENT_CONFIG = {
  text: '¡ENVÍOS A TODO COLOMBIA! | REGALA ESTILO, REGALA MODA',
  prefix: '¡ENVÍOS A TODO COLOMBIA!',
  separator: '|',
  suffix: 'REGALA ESTILO, REGALA MODA'
};

export const NAV_LINKS = [
  { id: 'inicio', label: 'Inicio', href: '#inicio', icon: '🏠' },
  { id: 'hombre', label: 'Hombre', href: '#hombre', icon: '👕' },
  { id: 'mujer', label: 'Mujer', href: '#mujer', icon: '👗' },
  { id: 'tenis', label: 'Tenis y zapatillas', href: '#tenis', icon: '👟' },
  { id: 'accesorios', label: 'Accesorios', href: '#accesorios', icon: '🎒' },
  { id: 'ofertas', label: 'Ofertas', href: '#ofertas', isSpecial: true, icon: '🔥' }
];

export default { ANNOUNCEMENT_CONFIG, NAV_LINKS };
