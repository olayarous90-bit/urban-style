import React from 'react';
import { BRAND_BENEFITS } from '../data/benefits';
import {
  SparklesIcon,
  UsersIcon,
  ChatIcon,
  SimpleBagCheckIcon
} from '../components/common/icons';
import './BrandBenefits.css';

/**
 * Mapeo de iconos a los identificadores de beneficios
 */
const ICONS_MAP = {
  sparkles: SparklesIcon,
  users: UsersIcon,
  chat: ChatIcon,
  bag: SimpleBagCheckIcon
};

/**
 * Sección Beneficios de la Marca (Brand Benefits Strip)
 * Franja de cuatro pilares de valor:
 * 1. Estilo para cada ocasión.
 * 2. Colecciones para hombre y mujer.
 * 3. Atención personalizada.
 * 4. Experiencia de compra sencilla.
 */
export const BrandBenefits = () => {
  return (
    <section
      id="beneficios"
      className="brand-benefits-section"
      aria-label="Beneficios y propuesta de valor de URBAN STYLE"
    >
      <div className="container">
        <div className="benefits-grid">
          {BRAND_BENEFITS.map((benefit, index) => {
            const IconComponent = ICONS_MAP[benefit.iconKey] || SparklesIcon;

            return (
              <div
                key={benefit.id}
                className={`benefit-card reveal-on-scroll stagger-${index + 1}`}
              >
                <div className="benefit-icon-wrapper" aria-hidden="true">
                  <IconComponent size={26} className="benefit-icon" />
                </div>
                <div className="benefit-text-wrapper">
                  <h3 className="benefit-title">{benefit.title}</h3>
                  <p className="benefit-desc">{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BrandBenefits;
