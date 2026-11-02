import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { CloseIcon, ChevronRightIcon } from '../common/icons';
import { Button } from '../common/Button';
import './CheckoutModal.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CheckoutModal = () => {
  const {
    cartItems,
    subtotal,
    isCheckoutOpen,
    closeCheckout,
    openCart,
    clearCart,
    setConfirmedOrder
  } = useCart();

  // Estados de datos del formulario
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    docNumber: '',
    deliveryDepartment: 'BOGOTÁ D.C.',
    deliveryCity: 'BOGOTÁ D.C.',
    deliveryDaneCode: '11001000',
    address: '',
    neighborhood: '',
    deliveryNotes: '',
    paymentMethod: 'COD',
    termsAccepted: false
  });

  // Departamentos y ciudades colombianas
  const [departments, setDepartments] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);

  // Cotización de Mi Paquete
  const [shippingQuotes, setShippingQuotes] = useState([]);
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(null);

  // Estado del proceso de confirmación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCheckoutOpen && !isSubmitting) {
        closeCheckout();
      }
    };

    if (isCheckoutOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCheckoutOpen, closeCheckout, isSubmitting]);

  // Cargar lista oficial de ubicaciones desde la API
  useEffect(() => {
    let isMounted = true;
    async function loadLocations() {
      try {
        const res = await fetch('/api/locations');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.data) {
            setDepartments(data.data);
            const bogota = data.data.find((d) => d.department === 'BOGOTÁ D.C.') || data.data[0];
            if (bogota) {
              setAvailableCities(bogota.cities);
            }
          }
        }
      } catch (err) {
        console.warn('Error cargando ubicaciones desde API, usando respaldo.', err);
      }
    }

    if (isCheckoutOpen) {
      loadLocations();
    }

    return () => {
      isMounted = false;
    };
  }, [isCheckoutOpen]);

  // Al cambiar departamento, actualizar ciudades y seleccionar la primera
  const handleDepartmentChange = (e) => {
    const deptName = e.target.value;
    const deptObj = departments.find((d) => d.department === deptName);
    const cities = deptObj ? deptObj.cities : [];
    const firstCity = cities[0] || { name: deptName, daneCode: '11001000' };

    setAvailableCities(cities);
    setFormData((prev) => ({
      ...prev,
      deliveryDepartment: deptName,
      deliveryCity: firstCity.name,
      deliveryDaneCode: firstCity.daneCode
    }));

    // Re-cotizar automáticamente para el nuevo destino
    triggerShippingQuote(firstCity.daneCode);
  };

  // Al cambiar municipio/ciudad, re-cotizar con su código DANE
  const handleCityChange = (e) => {
    const selectedCityName = e.target.value;
    const cityObj = availableCities.find((c) => c.name === selectedCityName);
    const daneCode = cityObj ? cityObj.daneCode : '11001000';

    setFormData((prev) => ({
      ...prev,
      deliveryCity: selectedCityName,
      deliveryDaneCode: daneCode
    }));

    triggerShippingQuote(daneCode);
  };

  // Cotizar tarifas con Mi Paquete
  const triggerShippingQuote = async (destinyDaneCode) => {
    if (!destinyDaneCode || cartItems.length === 0) return;

    setIsQuoting(true);
    setQuoteError(null);

    try {
      const response = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinyDaneCode,
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          })),
          totalValue: subtotal
        })
      });

      const data = await response.json();
      if (response.ok && data.quotes && data.quotes.length > 0) {
        setShippingQuotes(data.quotes);
        // Seleccionar por defecto la primera opción o la recomendada
        const recommended = data.quotes.find((q) => q.isRecommended) || data.quotes[0];
        setSelectedCarrier(recommended);
      } else {
        setQuoteError(data.message || 'No fue posible obtener cotización de transporte.');
      }
    } catch (err) {
      setQuoteError('Error de conexión al cotizar el flete.');
    } finally {
      setIsQuoting(false);
    }
  };

  // Cotización inicial al abrir checkout si aún no hay transportadoras
  useEffect(() => {
    if (isCheckoutOpen && shippingQuotes.length === 0 && formData.deliveryDaneCode) {
      triggerShippingQuote(formData.deliveryDaneCode);
    }
  }, [isCheckoutOpen, formData.deliveryDaneCode]);

  // Manejo de cambios en los inputs
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validación previa al envío
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'El nombre es requerido.';
    if (!formData.email.trim()) {
      errors.email = 'El correo electrónico es obligatorio para enviarte la guía de despacho.';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      errors.email = 'Ingresa un correo electrónico con formato válido (ejemplo@correo.com).';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'El teléfono es obligatorio para la entrega de la transportadora.';
    } else if (formData.phone.replace(/\D/g, '').length < 7) {
      errors.phone = 'Ingresa un número telefónico válido (mínimo 7 dígitos).';
    }

    if (!formData.docNumber.trim()) {
      errors.docNumber = 'La cédula o NIT es obligatoria para la emisión de la guía de transporte.';
    }

    if (!formData.address.trim()) {
      errors.address = 'La dirección de entrega es requerida.';
    }

    if (!selectedCarrier) {
      errors.carrier = 'Debes seleccionar una transportadora para el envío.';
    }

    if (!formData.termsAccepted) {
      errors.termsAccepted = 'Debes aceptar los términos y condiciones de compra.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Envío del pedido y generación de guía
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        customer: {
          name: formData.name.trim(),
          surname: formData.surname.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          docNumber: formData.docNumber.trim(),
          deliveryDepartment: formData.deliveryDepartment,
          deliveryCity: formData.deliveryCity,
          deliveryDaneCode: formData.deliveryDaneCode,
          address: formData.address.trim(),
          neighborhood: formData.neighborhood.trim(),
          deliveryNotes: formData.deliveryNotes.trim()
        },
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          price: item.price
        })),
        shippingSelection: selectedCarrier,
        paymentMethod: formData.paymentMethod
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Pedido confirmado con éxito
        clearCart();
        closeCheckout();
        setConfirmedOrder({
          order: data.order,
          shipment: data.shipment,
          items: cartItems,
          emailNotification: data.emailNotification
        });
      } else {
        setSubmitError(data.message || 'No fue posible completar tu pedido. Intenta nuevamente.');
      }
    } catch (err) {
      setSubmitError('Ocurrió un error de red al procesar tu compra. Verifica tu conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCheckoutOpen) return null;

  const shippingCost = selectedCarrier ? selectedCarrier.shippingCost : 0;
  const grandTotal = subtotal + shippingCost;

  return (
    <div className="checkout-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="checkout-dialog">
        {/* CABECERA */}
        <div className="checkout-header">
          <div>
            <span className="checkout-tag">Compra Segura y Despacho Nacional</span>
            <h2 className="checkout-title" id="checkout-title">
              Finalizar Pedido URBAN STYLE
            </h2>
          </div>
          <button
            type="button"
            className="checkout-close-btn"
            onClick={closeCheckout}
            disabled={isSubmitting}
            aria-label="Cerrar proceso de compra"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* CUERPO DEL CHECKOUT CON 2 COLUMNAS */}
        <div className="checkout-body">
          <form className="checkout-form" onSubmit={handleSubmitOrder} noValidate>
            
            {/* SECCIÓN 1: DATOS DEL DESTINATARIO */}
            <div className="checkout-section">
              <div className="section-header">
                <span className="section-number">1</span>
                <h3 className="section-title">Datos Personales y Contacto</h3>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="name" className="field-label">Nombre *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className={`field-input ${validationErrors.name ? 'field-error' : ''}`}
                    placeholder="Ej. Juan"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  {validationErrors.name && (
                    <span className="field-error-msg">{validationErrors.name}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="surname" className="field-label">Apellidos</label>
                  <input
                    id="surname"
                    name="surname"
                    type="text"
                    className="field-input"
                    placeholder="Ej. Gómez Restrepo"
                    value={formData.surname}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="email" className="field-label">Correo Electrónico (Para recibir la guía) *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={`field-input ${validationErrors.email ? 'field-error' : ''}`}
                    placeholder="tucorreo@ejemplo.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  {validationErrors.email && (
                    <span className="field-error-msg">{validationErrors.email}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="phone" className="field-label">Teléfono / WhatsApp Móvil *</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className={`field-input ${validationErrors.phone ? 'field-error' : ''}`}
                    placeholder="310 123 4567"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                  {validationErrors.phone && (
                    <span className="field-error-msg">{validationErrors.phone}</span>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="docNumber" className="field-label">Cédula de Ciudadanía o NIT (Requerido por transportadora) *</label>
                <input
                  id="docNumber"
                  name="docNumber"
                  type="text"
                  className={`field-input ${validationErrors.docNumber ? 'field-error' : ''}`}
                  placeholder="Número de identificación sin puntos"
                  value={formData.docNumber}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                {validationErrors.docNumber && (
                  <span className="field-error-msg">{validationErrors.docNumber}</span>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: DIRECCIÓN DE ENTREGA EN COLOMBIA */}
            <div className="checkout-section">
              <div className="section-header">
                <span className="section-number">2</span>
                <h3 className="section-title">Dirección de Entrega en Colombia</h3>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="deliveryDepartment" className="field-label">Departamento *</label>
                  <select
                    id="deliveryDepartment"
                    name="deliveryDepartment"
                    className="field-select"
                    value={formData.deliveryDepartment}
                    onChange={handleDepartmentChange}
                    disabled={isSubmitting}
                  >
                    {departments.map((dept) => (
                      <option key={dept.department} value={dept.department}>
                        {dept.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="deliveryCity" className="field-label">Municipio / Ciudad *</label>
                  <select
                    id="deliveryCity"
                    name="deliveryCity"
                    className="field-select"
                    value={formData.deliveryCity}
                    onChange={handleCityChange}
                    disabled={isSubmitting}
                  >
                    {availableCities.map((c) => (
                      <option key={c.daneCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="address" className="field-label">Dirección Completa (Calle, Carrera, N°, Apto, Casa) *</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  className={`field-input ${validationErrors.address ? 'field-error' : ''}`}
                  placeholder="Ej. Calle 85 # 13-45 Apto 402"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                {validationErrors.address && (
                  <span className="field-error-msg">{validationErrors.address}</span>
                )}
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="neighborhood" className="field-label">Barrio</label>
                  <input
                    id="neighborhood"
                    name="neighborhood"
                    type="text"
                    className="field-input"
                    placeholder="Ej. El Poblado / Chapinero"
                    value={formData.neighborhood}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="deliveryNotes" className="field-label">Notas para el mensajero</label>
                  <input
                    id="deliveryNotes"
                    name="deliveryNotes"
                    type="text"
                    className="field-input"
                    placeholder="Ej. Dejar en portería o timbrar al 402"
                    value={formData.deliveryNotes}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: COTIZACIÓN MI PAQUETE */}
            <div className="checkout-section">
              <div className="section-header">
                <span className="section-number">3</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <h3 className="section-title">Opciones de Envío (Mi Paquete v2)</h3>
                  {isQuoting && <span className="quoting-indicator">Cotizando flete...</span>}
                </div>
              </div>

              {quoteError && (
                <div className="quote-error-banner">{quoteError}</div>
              )}

              <div className="carrier-cards-grid">
                {shippingQuotes.map((carrier) => {
                  const isSelected = selectedCarrier?.carrierName === carrier.carrierName;
                  return (
                    <div
                      key={carrier.carrierName}
                      className={`carrier-card ${isSelected ? 'carrier-selected' : ''}`}
                      onClick={() => setSelectedCarrier(carrier)}
                    >
                      <div className="carrier-card-radio">
                        <span className={`radio-dot ${isSelected ? 'active' : ''}`} />
                      </div>

                      <div className="carrier-card-info">
                        <div className="carrier-card-top">
                          <span className="carrier-name">{carrier.carrierName}</span>
                          {carrier.isRecommended && (
                            <span className="carrier-tag-rec">Recomendada</span>
                          )}
                        </div>
                        <span className="carrier-time">⏱️ {carrier.estimatedDays}</span>
                      </div>

                      <div className="carrier-price-box">
                        <span className="carrier-price">{carrier.formattedCost}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {validationErrors.carrier && (
                <span className="field-error-msg">{validationErrors.carrier}</span>
              )}
            </div>

            {/* SECCIÓN 4: MÉTODO DE PAGO */}
            <div className="checkout-section">
              <div className="section-header">
                <span className="section-number">4</span>
                <h3 className="section-title">Método de Pago</h3>
              </div>

              <div className="payment-options-grid">
                {/* Pago Contra Entrega */}
                <label className={`payment-card ${formData.paymentMethod === 'COD' ? 'payment-selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={formData.paymentMethod === 'COD'}
                    onChange={handleInputChange}
                    className="payment-radio"
                  />
                  <div className="payment-content">
                    <div className="payment-header">
                      <strong className="payment-title">Pago Contra Entrega (Pagas al Recibir)</strong>
                      <span className="payment-badge">RECOMENDADO COLOMBIA</span>
                    </div>
                    <p className="payment-desc">
                      Pagas en efectivo o transferencia a la transportadora una vez el repartidor llegue con tu paquete a tu dirección.
                    </p>
                  </div>
                </label>

                {/* Pago Anticipado */}
                <label className={`payment-card ${formData.paymentMethod === 'PREPAID' ? 'payment-selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PREPAID"
                    checked={formData.paymentMethod === 'PREPAID'}
                    onChange={handleInputChange}
                    className="payment-radio"
                  />
                  <div className="payment-content">
                    <div className="payment-header">
                      <strong className="payment-title">Pago Anticipado / Transferencia</strong>
                    </div>
                    <p className="payment-desc">
                      Transfiere a nuestras cuentas autorizadas (Bancolombia, Nequi o Daviplata) antes del despacho de tu orden.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* CHECKBOX DE TÉRMINOS */}
            <div className="terms-checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleInputChange}
                  className="terms-checkbox"
                />
                <span>
                  Acepto los términos de servicio, política de privacidad y autorizo el tratamiento de mis datos para el despacho logístico de mi pedido.
                </span>
              </label>
              {validationErrors.termsAccepted && (
                <span className="field-error-msg">{validationErrors.termsAccepted}</span>
              )}
            </div>

            {submitError && (
              <div className="submit-error-banner">{submitError}</div>
            )}

            {/* BOTÓN CONFIRMAR */}
            <div className="checkout-submit-box">
              <Button
                variant="primary"
                type="submit"
                disabled={isSubmitting || cartItems.length === 0}
                className="checkout-submit-btn"
              >
                {isSubmitting ? (
                  <span>Generando Guía Mi Paquete...</span>
                ) : (
                  <span>Confirmar Pedido y Generar Guía (${grandTotal.toLocaleString('es-CO')} COP)</span>
                )}
              </Button>

              <button
                type="button"
                className="checkout-back-btn"
                onClick={() => {
                  closeCheckout();
                  openCart();
                }}
                disabled={isSubmitting}
              >
                ← Volver a la Bolsa de Compras
              </button>
            </div>
          </form>

          {/* COLUMNA DERECHA: RESUMEN DE COMPRA */}
          <aside className="checkout-sidebar">
            <h3 className="summary-title">Resumen de la Orden</h3>

            <div className="summary-items-list">
              {cartItems.map((item) => (
                <div key={item.cartItemId} className="summary-item">
                  <img src={item.image} alt={item.alt} className="summary-item-img" />
                  <div className="summary-item-info">
                    <span className="summary-item-name">{item.name}</span>
                    <span className="summary-item-meta">
                      Talla: {item.size} | Cant: {item.quantity}
                    </span>
                    <span className="summary-item-price">
                      ${(item.price * item.quantity).toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="summary-totals">
              <div className="summary-row">
                <span>Subtotal Prendas</span>
                <span>${subtotal.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="summary-row">
                <span>Flete ({selectedCarrier?.carrierName || 'Por seleccionar'})</span>
                <span>${shippingCost.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="summary-row summary-total-row">
                <span>Total a Pagar</span>
                <span className="summary-total-amount">
                  ${grandTotal.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            <div className="summary-guarantee-box">
              <span className="guarantee-icon">🛡️</span>
              <div>
                <strong className="guarantee-title">Garantía URBAN STYLE</strong>
                <p className="guarantee-text">
                  Emisión inmediata de número de guía, rastreo en vivo y correo de confirmación oficial.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
