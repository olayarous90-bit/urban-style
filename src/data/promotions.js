/**
 * Ofertas de demostración para URBAN STYLE
 * Datos claramente identificados como demostrativos.
 * No representan promociones comerciales reales ni vinculantes.
 */

export const PROMO_OFFERS = [
  {
    id: 'promo-1',
    name: "Bomber Jacket 'Cyber Tech'",
    category: 'Chaquetas',
    originalPrice: 389900,
    formattedOriginalPrice: '$389.900 COP',
    promoPrice: 299900,
    formattedPromoPrice: '$299.900 COP',
    discount: '-23% DEMO',
    image: '/images/products/prod-jacket.jpg',
    alt: 'Chaqueta bomber urbana negra en nylon satinado',
    description: 'Nylon técnico impermeable con acabado satinado, forro térmico ligero y bolsillo utilitario en manga.',
    badge: 'DROP DEMO',
    isDemo: true
  },
  {
    id: 'promo-2',
    name: "Sneakers Low-Top 'Apex Monochrome'",
    category: 'Zapatillas',
    originalPrice: 459900,
    formattedOriginalPrice: '$459.900 COP',
    promoPrice: 349900,
    formattedPromoPrice: '$349.900 COP',
    discount: '-24% DEMO',
    image: '/images/products/prod-sneakers.jpg',
    alt: 'Zapatillas urbanas de corte bajo en cuero monocromático con suela chunky',
    description: 'Suela chunky de amortiguación responsiva, confección en cuero genuino y detalles en goma mate.',
    badge: 'FAVORITO DEMO',
    isDemo: true
  },
  {
    id: 'promo-3',
    name: "Hoodie Essential 'Midnight Raw'",
    category: 'Sudaderas',
    originalPrice: 249900,
    formattedOriginalPrice: '$249.900 COP',
    promoPrice: 189900,
    formattedPromoPrice: '$189.900 COP',
    discount: '-24% DEMO',
    image: '/images/products/prod-hoodie.jpg',
    alt: 'Sudadera con capucha negra corte boxy en algodón de alto gramaje',
    description: 'Felpa francesa de 450 gsm de estructura boxy, hombros caídos y capucha de doble capa envolvente.',
    badge: 'BÁSICO DEMO',
    isDemo: true
  }
];

export const PROMO_SECTION_CONFIG = {
  title: 'OFERTAS QUE MARCAN ESTILO',
  description: 'Descubre una selección de productos destacados.',
  disclaimer: 'Precios, descuentos y disponibilidad presentados exclusivamente con fines demostrativos.'
};
