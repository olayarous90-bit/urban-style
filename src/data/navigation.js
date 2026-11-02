/**
 * Configuración de navegación y mensajes de URBAN STYLE
 * Permite modificar fácilmente textos, enlaces y promociones futuras.
 */

export const ANNOUNCEMENT_CONFIG = {
  // Mensaje oficial configurable
  text: 'NUEVA COLECCIÓN DISPONIBLE | DESCUBRE TU PRÓXIMO LOOK',
  prefix: 'NUEVA COLECCIÓN DISPONIBLE',
  separator: '|',
  suffix: 'DESCUBRE TU PRÓXIMO LOOK'
};

export const NAV_LINKS = [
  { id: 'inicio', label: 'Inicio', href: '#inicio' },
  { id: 'hombre', label: 'Hombre', href: '#hombre' },
  { id: 'mujer', label: 'Mujer', href: '#mujer' },
  { id: 'zapatillas', label: 'Zapatillas', href: '#zapatillas' },
  { id: 'accesorios', label: 'Accesorios', href: '#accesorios' },
  { id: 'ofertas', label: 'Ofertas', href: '#ofertas', isSpecial: true }
];
