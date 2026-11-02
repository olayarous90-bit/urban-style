import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { CloseIcon } from '../common/icons';
import { Button } from '../common/Button';
import './OrderSuccessModal.css';

export const OrderSuccessModal = () => {
  const { confirmedOrder, setConfirmedOrder } = useCart();
  const [copied, setCopied] = useState(false);

  if (!confirmedOrder) return null;

  const { order, shipment } = confirmedOrder;

  const handleCopyGuide = () => {
    if (shipment?.guideNumber) {
      navigator.clipboard.writeText(shipment.guideNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleClose = () => {
    setConfirmedOrder(null);
  };

  const guideDownloadUrl = shipment.pdfGuideUrl?.startsWith('http')
    ? shipment.pdfGuideUrl
    : `${window.location.origin}${shipment.pdfGuideUrl}`;

  const emailPreviewUrl = `${window.location.origin}/api/orders/${order.orderNumber}/email-preview`;

  return (
    <div className="success-backdrop" role="dialog" aria-modal="true" aria-labelledby="success-title">
      <div className="success-dialog">
        <button
          type="button"
          className="success-close-btn"
          onClick={handleClose}
          aria-label="Cerrar confirmación"
        >
          <CloseIcon size={20} />
        </button>

        <div className="success-header">
          <div className="success-badge-icon">
            <span className="success-checkmark">✓</span>
          </div>
          <span className="success-tag">Transacción Exitosa</span>
          <h2 className="success-title" id="success-title">
            ¡Tu Pedido ha Sido Confirmado!
          </h2>
          <p className="success-order-num">
            Orden: <strong>#{order.orderNumber}</strong>
          </p>
        </div>

        {/* TARJETA DE GUÍA DE TRANSPORTE GENERADA */}
        <div className="success-guide-card">
          <div className="guide-card-header">
            <div>
              <span className="guide-card-subtitle">Transportadora Oficial</span>
              <h3 className="guide-carrier-name">{shipment.carrierName}</h3>
            </div>
            <div className="guide-status-badge">
              <span className="status-dot-pulse" />
              <span>{shipment.trackingStatus || 'Lista para despacho'}</span>
            </div>
          </div>

          <div className="guide-number-row">
            <div>
              <span className="guide-number-label">Número de Guía de Envío:</span>
              <div className="guide-number-value">{shipment.guideNumber}</div>
            </div>
            <button
              type="button"
              className="guide-copy-btn"
              onClick={handleCopyGuide}
              aria-label="Copiar número de guía"
            >
              {copied ? '✓ Copiado' : 'Copiar Guía'}
            </button>
          </div>

          <div className="guide-actions-box">
            <a
              href={guideDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary guide-download-btn"
            >
              📄 Descargar Guía de Transporte (PDF / Imprimir)
            </a>
          </div>
        </div>

        {/* NOTIFICACIÓN DE CORREO AUTOMÁTICO */}
        <div className="success-email-notice">
          <span className="email-notice-icon">✉️</span>
          <div className="email-notice-content">
            <strong>Confirmación enviada a tu correo:</strong>
            <p className="email-notice-address">{order.customer?.email}</p>
            <p className="email-notice-desc">
              Hemos despachado automáticamente el resumen detallado de tu orden y la guía de Mi Paquete.
            </p>
            <a
              href={emailPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="email-preview-link"
            >
              Ver vista previa oficial del correo en navegador →
            </a>
          </div>
        </div>

        {/* BOTÓN SEGUIR COMPRANDO */}
        <div className="success-footer-actions">
          <Button
            variant="outline"
            className="success-keep-btn"
            onClick={handleClose}
          >
            Seguir Comprando en URBAN STYLE
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
