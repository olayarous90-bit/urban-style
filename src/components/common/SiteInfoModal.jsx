import React, { useState, useEffect } from 'react';
import './SiteInfoModal.css';

/**
 * Preguntas frecuentes oficiales de URBAN STYLE
 */
const FAQS_DATA = [
  {
    question: '¿Cómo puedo saber cuál es mi talla correcta?',
    answer: 'En cada producto encontrarás la tabla de tallas detallada para streetwear (S, M, L, XL) y calzado (38 a 43 COP). Nuestras prendas tienen corte Regular y Oversized según el modelo. Si tienes dudas entre dos tallas, te recomendamos elegir la talla superior para un estilo más relajado o contactarnos por WhatsApp.'
  },
  {
    question: '¿Hacen envíos a toda Colombia y cuánto tardan?',
    answer: 'Sí, despachamos a más de 1.100 municipios de Colombia a través de nuestra alianza logística con Mi Paquete v2 (Coordinadora, Servientrega, TCC y Envía). Los tiempos estimados de entrega son de 1 a 2 días hábiles en Bogotá D.C. y de 2 a 5 días hábiles para el resto de ciudades principales y municipios.'
  },
  {
    question: '¿Puedo pagar contra entrega en efectivo al recibir?',
    answer: 'Sí. Contamos con la opción de Pago Contra Entrega en las principales ciudades y municipios con cobertura de transportadora. Pagas en efectivo al mensajero únicamente cuando recibes tu paquete en la puerta de tu casa.'
  },
  {
    question: '¿Cómo solicito un cambio de prenda o talla?',
    answer: 'Dispones de 30 días calendario desde la fecha de entrega para solicitar cambio por talla o gusto. La prenda debe estar completamente nueva, limpia, sin uso, en su empaque original y con todas las etiquetas intactas. Escríbenos a nuestro canal de WhatsApp o al correo con tu número de orden.'
  },
  {
    question: '¿Qué garantía tienen los productos de URBAN STYLE?',
    answer: 'Todos nuestros productos cuentan con 90 días calendario de garantía por defectos de confección, costuras o materiales, conforme al Estatuto del Consumidor (Ley 1480 de 2011). No cubre desgastes naturales por uso indebido ni lavado en desacuerdo con las instrucciones de la marquilla.'
  },
  {
    question: '¿Cómo puedo rastrear mi pedido?',
    answer: 'Una vez confirmada tu compra, recibirás un correo electrónico con tu número de pedido (ej: US-2026-XXXXX) y tu número de guía de transporte. También puedes ingresar tu número de orden en la sección "Estado de Pedidos" de este sitio web para consultar el estado en tiempo real.'
  }
];

export const SiteInfoModal = ({
  isOpen,
  activeSection = 'privacy', // 'privacy', 'cookies', 'terms', 'shipping', 'returns', 'payments', 'contact', 'faqs', 'order-tracking'
  onClose,
  siteSettings = {},
  onOpenCookiePreferences = () => {}
}) => {
  const [currentTab, setCurrentTab] = useState(activeSection);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Estado del rastreador de pedidos
  const [trackingOrderNumber, setTrackingOrderNumber] = useState('');
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [trackedOrderResult, setTrackedOrderResult] = useState(null);
  const [trackingError, setTrackingError] = useState(null);

  useEffect(() => {
    if (activeSection) {
      setCurrentTab(activeSection);
    }
  }, [activeSection]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const storeName = siteSettings.storeName || 'URBAN STYLE';
  const contactEmail = siteSettings.contactEmail || 'contacto@urbanstyle.com.co';
  const contactPhone = siteSettings.contactPhone || '[Teléfono oficial configurable en admin]';
  const contactWhatsapp = siteSettings.contactWhatsapp || '';
  const contactHours = siteSettings.contactHours || 'Lunes a Sábado: 9:00 AM – 7:00 PM (Hora Colombia)';
  const city = siteSettings.city || 'Bogotá D.C., Colombia';
  const businessName = siteSettings.businessName || '[Razón Social / Titular de URBAN STYLE configurable en admin]';
  const nit = siteSettings.nit || '[NIT / Documento fiscal configurable en admin]';
  const address = siteSettings.address || '[Dirección de notificaciones configurable en admin]';

  // Buscar estado de orden
  const handleSearchOrder = async (e) => {
    e.preventDefault();
    const query = trackingOrderNumber.trim();
    if (!query) return;

    setIsSearchingOrder(true);
    setTrackingError(null);
    setTrackedOrderResult(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.order) {
          setTrackedOrderResult(json);
        } else {
          setTrackingError('No se encontró ningún pedido con ese número de orden.');
        }
      } else {
        setTrackingError('Pedido no encontrado. Verifica que el número de orden coincida con el recibido en tu correo (ejemplo: US-2026-61510).');
      }
    } catch {
      setTrackingError('Error al consultar el pedido. Intenta nuevamente.');
    } finally {
      setIsSearchingOrder(false);
    }
  };

  // Pestañas de grupo legal
  const legalTabs = [
    { id: 'privacy', label: 'Política de Privacidad' },
    { id: 'cookies', label: 'Política de Cookies' },
    { id: 'terms', label: 'Términos y Condiciones' },
    { id: 'shipping', label: 'Envíos y Entregas' },
    { id: 'returns', label: 'Cambios y Garantías' },
    { id: 'payments', label: 'Medios de Pago' }
  ];

  // Pestañas de atención al cliente
  const supportTabs = [
    { id: 'contact', label: 'Contacto y Horarios' },
    { id: 'faqs', label: 'Preguntas Frecuentes' },
    { id: 'order-tracking', label: 'Estado de Pedidos' }
  ];

  const isLegalGroup = legalTabs.some((t) => t.id === currentTab);

  return (
    <div
      className="site-info-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-info-modal-title"
    >
      <div
        className="site-info-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA */}
        <div className="site-info-modal-header">
          <div className="header-titles">
            <span className="modal-category-chip">
              {isLegalGroup ? 'DOCUMENTACIÓN LEGAL & NORMATIVA' : 'ATENCIÓN AL CLIENTE & SOPORTE'}
            </span>
            <h2 id="site-info-modal-title" className="modal-main-title">
              {currentTab === 'privacy' && 'Política de Privacidad y Tratamiento de Datos Personales'}
              {currentTab === 'cookies' && 'Política de Cookies y Consentimiento Informado'}
              {currentTab === 'terms' && 'Términos y Condiciones Generales de Compra'}
              {currentTab === 'shipping' && 'Política y Tiempos de Envío Nacional'}
              {currentTab === 'returns' && 'Política de Cambios, Devoluciones y Garantías'}
              {currentTab === 'payments' && 'Información de Medios de Pago y Seguridad'}
              {currentTab === 'contact' && 'Canales Oficiales de Contacto y Atención'}
              {currentTab === 'faqs' && 'Preguntas Frecuentes (FAQ)'}
              {currentTab === 'order-tracking' && 'Rastreo y Consulta de Estado de Pedidos'}
            </h2>
          </div>

          <button
            type="button"
            className="site-info-close-btn"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* NAVEGACIÓN RÁPIDA ENTRE SECCIONES */}
        <div className="site-info-nav-bar">
          <div className="nav-group">
            <span className="nav-group-label">Legal:</span>
            {legalTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`site-info-nav-btn ${currentTab === t.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="nav-group">
            <span className="nav-group-label">Ayuda:</span>
            {supportTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`site-info-nav-btn ${currentTab === t.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* CUERPO PRINCIPAL DEL CONTENIDO */}
        <div className="site-info-modal-body">
          {/* AVISO DE DATOS CONFIGURABLES PARA TRANSPARENCIA */}
          <div className="site-info-notice-banner">
            <span>
              ℹ️ <strong>Información corporativa:</strong> {storeName} opera conforme a la legislación de la República de Colombia. Los datos empresariales específicos se administran desde el panel de control.
            </span>
          </div>

          {/* 1. POLÍTICA DE PRIVACIDAD */}
          {currentTab === 'privacy' && (
            <div className="site-info-article">
              <p className="article-lead">
                En cumplimiento de la <strong>Ley Estatutaria 1581 de 2012</strong>, el <strong>Decreto Reglamentario 1377 de 2013</strong> y demás normas concordantes sobre protección de datos personales (Habeas Data) en la República de Colombia, <strong>{storeName}</strong> informa a sus clientes, usuarios y visitantes los lineamientos bajo los cuales realiza el tratamiento de su información.
              </p>

              <h3>1. Responsable del Tratamiento</h3>
              <p>
                El responsable del tratamiento de los datos personales recolectados a través de esta tienda virtual es <strong>{businessName}</strong>, con <strong>{nit}</strong>, domicilio en <strong>{city}</strong>, dirección física <strong>{address}</strong> y correo electrónico de contacto <strong>{contactEmail}</strong>.
              </p>

              <h3>2. Finalidades de la Recolección de Datos</h3>
              <p>Los datos solicitados durante el proceso de compra, registro o navegación son utilizados exclusivamente para:</p>
              <ul>
                <li>Procesar, despachar, facturar y entregar los pedidos realizados en la tienda virtual.</li>
                <li>Generar las guías de transporte nacional a través de transportadoras aliadas mediante la plataforma logística de Mi Paquete.</li>
                <li>Enviar notificaciones electrónicas obligatorias sobre el estado del pedido, confirmación de compra y número de seguimiento vía correo transaccional.</li>
                <li>Gestionar cambios, devoluciones, garantías y requerimientos de servicio al cliente.</li>
                <li>Prevenir fraudes informáticos y verificar la veracidad de las transacciones comerciales.</li>
                <li>Remitir ofertas, promociones y novedades comerciales, siempre y cuando medie autorización expresa del titular.</li>
              </ul>

              <h3>3. Derechos de los Titulares</h3>
              <p>
                Como titular de sus datos personales, usted tiene derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos de nuestras bases de datos, así como a revocar la autorización otorgada, dirigiéndose a nuestro correo oficial: <strong>{contactEmail}</strong>.
              </p>
            </div>
          )}

          {/* 2. POLÍTICA DE COOKIES */}
          {currentTab === 'cookies' && (
            <div className="site-info-article">
              <p className="article-lead">
                Esta política explica de forma clara y transparente qué son las cookies, qué tipos utiliza <strong>{storeName}</strong> en su tienda virtual y cómo puede el usuario administrarlas o revocar su consentimiento.
              </p>

              <h3>1. ¿Qué es una cookie?</h3>
              <p>
                Una cookie es un pequeño archivo de texto que un sitio web descarga en su computador, teléfono o tablet al acceder a determinadas páginas. Permite recordar información sobre su visita, como los artículos en su carrito o sus preferencias de navegación.
              </p>

              <h3>2. Categorías de cookies utilizadas</h3>
              <ul>
                <li><strong>Cookies Estrictamente Necesarias:</strong> Imprescindibles para el funcionamiento técnico de la tienda (sesión de compra, carrito persistente y seguridad de transacciones). No pueden desactivarse.</li>
                <li><strong>Cookies de Preferencias:</strong> Recuerdan configuraciones de interfaz elegidas por el visitante (como el tema visual o moneda).</li>
                <li><strong>Cookies Estadísticas o Analíticas:</strong> Analizan de manera anónima y agregada el tráfico de la tienda para optimizar la velocidad y rendimiento.</li>
                <li><strong>Cookies de Marketing y Publicidad:</strong> Permiten ofrecer campañas comerciales pertinentes sin saturar al usuario.</li>
              </ul>

              <h3>3. Control y Configuración de Preferencias</h3>
              <p>
                Usted puede configurar o modificar en cualquier momento las cookies autorizadas haciendo clic en el siguiente botón:
              </p>
              <div style={{ margin: '1rem 0' }}>
                <button
                  type="button"
                  className="site-info-action-btn"
                  onClick={() => {
                    onClose();
                    onOpenCookiePreferences();
                  }}
                >
                  ⚙️ Abrir Configuración de Cookies
                </button>
              </div>
            </div>
          )}

          {/* 3. TÉRMINOS Y CONDICIONES */}
          {currentTab === 'terms' && (
            <div className="site-info-article">
              <p className="article-lead">
                Los presentes Términos y Condiciones regulan el acceso, navegación y compras efectuadas por los usuarios en la tienda en línea de <strong>{storeName}</strong> dentro del territorio de la República de Colombia.
              </p>

              <h3>1. Aceptación y Capacidad Legal</h3>
              <p>
                Al realizar una orden en este sitio web, el cliente declara ser mayor de 18 años y contar con la capacidad legal suficiente para obligarse según las leyes comerciales de Colombia.
              </p>

              <h3>2. Precios, Moneda e Inventario</h3>
              <p>
                Todos los precios de los productos están expresados en <strong>Pesos Colombianos (COP)</strong> e incluyen los tributos aplicables de ley. Los precios y descuentos vigentes son los publicados en la tienda al momento de confirmar el pedido. En caso de agotamiento imprevisto de inventario, se informará de inmediato al cliente para cambio de prenda o reversión total del pago.
              </p>

              <h3>3. Perfeccionamiento de la Compra</h3>
              <p>
                El contrato de compraventa se perfecciona una vez el cliente completa el formulario de checkout, selecciona el medio de pago (incluyendo Pago Contra Entrega) y el sistema emite el número único de orden (ej: US-2026-XXXXX).
              </p>

              <h3>4. Propiedad Intelectual</h3>
              <p>
                El contenido de este sitio web, incluyendo textos, logotipos, imágenes promocionales, esquemas y código de programación, está protegido por las normas vigentes de propiedad intelectual y derechos de autor. Queda prohibida su reproducción o explotación no autorizada.
              </p>
            </div>
          )}

          {/* 4. POLÍTICA DE ENVÍOS */}
          {currentTab === 'shipping' && (
            <div className="site-info-article">
              <p className="article-lead">
                En <strong>{storeName}</strong> gestionamos nuestros despachos con tecnología logística de punta para garantizar entregas puntuales y seguras en todo el país.
              </p>

              <h3>1. Cobertura Nacional</h3>
              <p>
                Realizamos envíos a más de 1.100 municipios de Colombia en convenio con transportadoras de primer nivel (Coordinadora, Servientrega, TCC y Envía) a través de la plataforma <strong>Mi Paquete v2</strong>.
              </p>

              <h3>2. Tiempos Estimados de Entrega</h3>
              <ul>
                <li><strong>Bogotá D.C. y Sabana:</strong> 1 a 2 días hábiles.</li>
                <li><strong>Ciudades principales (Medellín, Cali, Barranquilla, Bucaramanga, Pereira, etc.):</strong> 2 a 4 días hábiles.</li>
                <li><strong>Municipios y trayectos especiales:</strong> 3 a 6 días hábiles.</li>
              </ul>

              <h3>3. Notificación y Trazabilidad</h3>
              <p>
                Una vez generado el despacho, el sistema remitirá un correo electrónico con el número de guía de transporte y el enlace de rastreo oficial para consultar el avance del paquete en tiempo real.
              </p>

              <h3>4. Intentos de Entrega y Novedades</h3>
              <p>
                La transportadora realiza hasta dos (2) intentos de entrega en la dirección consignada. En caso de no contactar al destinatario, el paquete permanecerá en custodia en la sede local de la transportadora antes de iniciar proceso de devolución.
              </p>
            </div>
          )}

          {/* 5. CAMBIOS, DEVOLUCIONES Y GARANTÍAS */}
          {currentTab === 'returns' && (
            <div className="site-info-article">
              <p className="article-lead">
                Nuestra política de cambios y garantías se rige con estricto apego al <strong>Estatuto del Consumidor (Ley 1480 de 2011)</strong> de Colombia.
              </p>

              <h3>1. Derecho de Retracto (Ventas a Distancia)</h3>
              <p>
                Conforme al artículo 47 de la Ley 1480 de 2011, el consumidor podrá ejercer el derecho de retracto dentro de los <strong>cinco (5) días hábiles</strong> siguientes a la fecha de entrega del producto. El cliente deberá devolver el producto en las mismas condiciones en que lo recibió, sin haberlo usado, con sus etiquetas y empaques originales. Los costos de transporte por retracto serán asumidos conforme a la ley.
              </p>

              <h3>2. Cambios por Talla o Gusto</h3>
              <p>
                Otorgamos un plazo de <strong>treinta (30) días calendario</strong> contados a partir de la entrega para solicitar cambio por talla o por otra referencia disponible en catálogo. Las prendas íntimas o accesorios que por higiene no admitan cambio están excluidos salvo por defecto de fábrica.
              </p>

              <h3>3. Garantía Legal por Defectos de Fábrica</h3>
              <p>
                Nuestras prendas y calzado cuentan con una garantía legal de <strong>noventa (90) días calendario</strong> por defectos de confección, costuras o materiales. La garantía no aplica para daños originados por mal lavado, rasgaduras accidentales, quemaduras o desgaste normal del uso.
              </p>
            </div>
          )}

          {/* 6. MEDIOS DE PAGO */}
          {currentTab === 'payments' && (
            <div className="site-info-article">
              <p className="article-lead">
                Ofrecemos opciones de pago cómodas, verificadas y transparentes para que elijas la que mejor se adapte a ti:
              </p>

              <div className="payment-methods-grid">
                <div className="payment-method-card">
                  <span className="pay-icon">💵</span>
                  <h4>Pago Contra Entrega</h4>
                  <p>Paga en efectivo directamente al mensajero de la transportadora cuando recibas tu paquete en la puerta de tu domicilio. Disponible en las principales ciudades de Colombia.</p>
                </div>

                <div className="payment-method-card">
                  <span className="pay-icon">📱</span>
                  <h4>Transferencia Bancaria & Billeteras</h4>
                  <p>Aceptamos pagos por transferencia a Bancolombia, Nequi y Daviplata. Recibes la confirmación automática inmediatamente verificado el comprobante.</p>
                </div>

                <div className="payment-method-card">
                  <span className="pay-icon">💳</span>
                  <h4>Tarjetas & Pasarelas Digitales</h4>
                  <p>Procesamiento cifrado bajo estándares SSL y certificación bancaria nacional. No almacenamos datos sensibles de tarjetas ni números de cuenta.</p>
                </div>
              </div>
            </div>
          )}

          {/* 7. CONTACTO Y HORARIOS */}
          {currentTab === 'contact' && (
            <div className="site-info-article">
              <p className="article-lead">
                Estamos atentos para resolver cualquier inquietud antes, durante y después de tu compra en <strong>{storeName}</strong>.
              </p>

              <div className="contact-details-grid">
                <div className="contact-card">
                  <span className="contact-icon">✉️</span>
                  <h4>Correo Electrónico</h4>
                  <p><a href={`mailto:${contactEmail}`} className="contact-link">{contactEmail}</a></p>
                  <span className="contact-sub">Respuesta promedio en menos de 24 horas</span>
                </div>

                <div className="contact-card">
                  <span className="contact-icon">💬</span>
                  <h4>Atención por WhatsApp</h4>
                  <p>
                    {contactWhatsapp ? (
                      <a
                        href={`https://wa.me/${contactWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(siteSettings.whatsappMessage || 'Hola URBAN STYLE')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-link highlight"
                      >
                        {contactWhatsapp} (Chatear ahora ↗)
                      </a>
                    ) : (
                      <span>Canal oficial en configuración</span>
                    )}
                  </p>
                  <span className="contact-sub">Asesoría directa en tallas y pedidos</span>
                </div>

                <div className="contact-card">
                  <span className="contact-icon">⏰</span>
                  <h4>Horarios de Atención</h4>
                  <p>{contactHours}</p>
                  <span className="contact-sub">Zona horaria: Colombia (UTC-5)</span>
                </div>

                <div className="contact-card">
                  <span className="contact-icon">📍</span>
                  <h4>Ubicación y Despachos</h4>
                  <p>{city}</p>
                  <span className="contact-sub">Envíos directos a todo el territorio nacional</span>
                </div>
              </div>
            </div>
          )}

          {/* 8. PREGUNTAS FRECUENTES */}
          {currentTab === 'faqs' && (
            <div className="site-info-article">
              <p className="article-lead">
                Encuentra respuestas rápidas a las consultas más habituales de nuestra comunidad de clientes:
              </p>

              <div className="faqs-accordion">
                {FAQS_DATA.map((faq, index) => {
                  const isOpenItem = openFaqIndex === index;
                  return (
                    <div key={index} className={`faq-item ${isOpenItem ? 'faq-open' : ''}`}>
                      <button
                        type="button"
                        className="faq-question-btn"
                        onClick={() => setOpenFaqIndex(isOpenItem ? -1 : index)}
                        aria-expanded={isOpenItem}
                      >
                        <span className="faq-q-text">{faq.question}</span>
                        <span className="faq-chevron">{isOpenItem ? '−' : '+'}</span>
                      </button>
                      {isOpenItem && (
                        <div className="faq-answer-pane">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 9. ESTADO DE PEDIDOS (RASTREADOR REAL) */}
          {currentTab === 'order-tracking' && (
            <div className="site-info-article">
              <p className="article-lead">
                Ingresa tu número de orden oficial para consultar el estado de tu pedido, despacho y guía en tiempo real:
              </p>

              <form onSubmit={handleSearchOrder} className="order-tracker-form">
                <div className="tracker-input-row">
                  <input
                    type="text"
                    className="tracker-input font-numeric"
                    placeholder="Ej: US-2026-61510"
                    value={trackingOrderNumber}
                    onChange={(e) => setTrackingOrderNumber(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="tracker-submit-btn"
                    disabled={isSearchingOrder}
                  >
                    {isSearchingOrder ? 'Buscando...' : '🔍 Consultar Estado'}
                  </button>
                </div>
                <span className="tracker-hint">
                  El número de pedido fue enviado a tu correo al momento de la compra (inicia con US-2026-...).
                </span>
              </form>

              {trackingError && (
                <div className="tracker-error-box">
                  <span>⚠️ {trackingError}</span>
                </div>
              )}

              {trackedOrderResult && (
                <div className="tracker-result-card">
                  <div className="tracker-result-header">
                    <div>
                      <span className="tracker-badge-status">
                        {trackedOrderResult.order.status === 'LABEL_GENERATED' && '📦 Guía de Envío Generada'}
                        {trackedOrderResult.order.status === 'PENDING_PAYMENT' && '⏳ En Preparación'}
                        {trackedOrderResult.order.status === 'PAID' && '✓ Pago Confirmado'}
                        {trackedOrderResult.order.status === 'SHIPPED' && '🚚 En Camino'}
                        {trackedOrderResult.order.status === 'DELIVERED' && '✓ Entregado'}
                      </span>
                      <h4 className="tracker-order-title font-numeric">
                        Pedido: {trackedOrderResult.order.order_number}
                      </h4>
                    </div>
                    <span className="tracker-date font-numeric">
                      {new Date(trackedOrderResult.order.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="tracker-details-grid font-numeric">
                    <p><strong>Destinatario:</strong> {trackedOrderResult.order.customer_name} {trackedOrderResult.order.customer_surname}</p>
                    <p><strong>Ciudad de destino:</strong> {trackedOrderResult.order.delivery_city}, {trackedOrderResult.order.delivery_department}</p>
                    <p><strong>Dirección:</strong> {trackedOrderResult.order.delivery_address}</p>
                    <p><strong>Total de la compra:</strong> ${Number(trackedOrderResult.order.total).toLocaleString('es-CO')}</p>
                  </div>

                  {trackedOrderResult.shipment && (
                    <div className="tracker-shipment-box">
                      <div className="shipment-badge-row">
                        <span className="carrier-name">🚚 Transportadora: {trackedOrderResult.shipment.carrier_name}</span>
                        {trackedOrderResult.shipment.guide_number && (
                          <span className="guide-number font-numeric">
                            Guía: <strong>{trackedOrderResult.shipment.guide_number}</strong>
                          </span>
                        )}
                      </div>
                      <p className="shipment-status-desc">
                        Estado del envío: <strong>{trackedOrderResult.shipment.tracking_status || 'En preparación y alistamiento'}</strong>
                      </p>
                      {trackedOrderResult.shipment.tracking_url && (
                        <a
                          href={trackedOrderResult.shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-track-external"
                        >
                          Rastrear en transportadora oficial ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div className="site-info-modal-footer">
          <span className="footer-copyright-note">
            © {currentYear} {storeName}. Todos los derechos reservados.
          </span>
          <button
            type="button"
            className="site-info-modal-btn-close"
            onClick={onClose}
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
