import React, { useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { CloseIcon, BagIcon } from '../common/icons';
import { Button } from '../common/Button';
import './CartDrawer.css';

export const CartDrawer = () => {
  const {
    cartItems,
    cartCount,
    formattedSubtotal,
    isCartOpen,
    closeCart,
    removeFromCart,
    updateQuantity,
    openCheckout
  } = useCart();

  // Cerrar con Escape y bloquear scroll del body mientras esté abierto
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isCartOpen) {
        closeCart();
      }
    };

    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  const handleExploreProducts = () => {
    closeCart();
    const target = document.getElementById('productos');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="cart-drawer-backdrop" onClick={closeCart} role="dialog" aria-modal="true" aria-label="Bolsa de compras">
      <aside
        className="cart-drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA DEL CARRITO */}
        <div className="cart-drawer-header">
          <div className="cart-header-title-box">
            <BagIcon size={20} />
            <h2 className="cart-header-title">Bolsa de Compra</h2>
            <span className="cart-count-badge" aria-label={`${cartCount} productos`}>
              {cartCount}
            </span>
          </div>

          <button
            type="button"
            className="cart-close-btn"
            onClick={closeCart}
            aria-label="Cerrar bolsa de compras"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* CUERPO DEL CARRITO */}
        <div className="cart-drawer-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon">
                <BagIcon size={44} />
              </div>
              <h3 className="cart-empty-title">Tu bolsa está vacía</h3>
              <p className="cart-empty-desc">
                Explora nuestras colecciones urbanas y encuentra las piezas clave para tu estilo.
              </p>
              <Button
                variant="primary"
                onClick={handleExploreProducts}
                className="cart-empty-cta"
              >
                Explorar Prendas
              </Button>
            </div>
          ) : (
            <div className="cart-items-list">
              {cartItems.map((item) => (
                <article key={item.cartItemId} className="cart-item-card">
                  {/* Imagen */}
                  <div className="cart-item-image-wrapper">
                    <img
                      src={item.image}
                      alt={item.alt}
                      className="cart-item-image"
                      loading="lazy"
                    />
                  </div>

                  {/* Información */}
                  <div className="cart-item-details">
                    <div className="cart-item-main">
                      <span className="cart-item-category">{item.category}</span>
                      <h4 className="cart-item-name">{item.name}</h4>
                      
                      <div className="cart-item-variants">
                        <span className="cart-variant-badge">Talla: {item.size}</span>
                        {item.color && (
                          <span className="cart-variant-badge">{item.color}</span>
                        )}
                      </div>
                    </div>

                    <div className="cart-item-actions-row">
                      {/* Control de cantidad */}
                      <div className="cart-qty-control" aria-label="Cantidad de producto">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          aria-label={`Disminuir cantidad de ${item.name}`}
                        >
                          -
                        </button>
                        <span className="cart-qty-number">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          aria-label={`Aumentar cantidad de ${item.name}`}
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal del ítem */}
                      <div className="cart-item-price-box">
                        <span className="cart-item-price">
                          ${(item.price * item.quantity).toLocaleString('es-CO')} COP
                        </span>
                      </div>

                      {/* Botón eliminar */}
                      <button
                        type="button"
                        className="cart-item-remove-btn"
                        onClick={() => removeFromCart(item.cartItemId)}
                        aria-label={`Eliminar ${item.name} de la bolsa`}
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* PIE DEL CARRITO */}
        {cartItems.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-footer-summary">
              <div className="cart-subtotal-row">
                <span className="cart-subtotal-label">Subtotal estimado</span>
                <span className="cart-subtotal-amount">{formattedSubtotal}</span>
              </div>
              <p className="cart-shipping-notice">
                🚚 Envíos a toda Colombia cotizados en tiempo real con Mi Paquete (Coordinadora, Servientrega, TCC).
              </p>
            </div>

            <div className="cart-footer-actions">
              <Button
                variant="primary"
                onClick={openCheckout}
                className="cart-checkout-btn"
              >
                Continuar con la Compra
              </Button>
              <button
                type="button"
                className="cart-keep-shopping-btn"
                onClick={closeCart}
              >
                Seguir Explorando
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default CartDrawer;
