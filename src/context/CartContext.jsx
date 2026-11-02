import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

const CART_STORAGE_KEY = 'urban_style_cart';

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('Error reading cart from localStorage', e);
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Persistir carrito en localStorage en cada cambio
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Error writing cart to localStorage', e);
    }
  }, [cartItems]);

  /**
   * Añadir producto al carrito
   */
  const addToCart = (product, size = 'M', color = 'Estándar', quantity = 1) => {
    const itemSize = size || product.sizes?.[0] || 'M';
    const itemColor = color || product.color || 'Estándar';
    const itemKey = `${product.id}-${itemSize}-${itemColor}`;

    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.cartItemId === itemKey);
      if (existingIndex >= 0) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        };
        return updated;
      }

      return [
        ...prevItems,
        {
          cartItemId: itemKey,
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          formattedPrice: product.formattedPrice || `$${product.price.toLocaleString('es-CO')} COP`,
          size: itemSize,
          color: itemColor,
          quantity,
          image: product.image,
          alt: product.alt || product.name
        }
      ];
    });

    setIsCartOpen(true);
  };

  /**
   * Quitar producto del carrito
   */
  const removeFromCart = (cartItemId) => {
    setCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  /**
   * Modificar cantidad de un ítem
   */
  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  /**
   * Vaciar el carrito
   */
  const clearCart = () => {
    setCartItems([]);
  };

  // Cálculos reactivos
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const formattedSubtotal = `$${subtotal.toLocaleString('es-CO')} COP`;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        subtotal,
        formattedSubtotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        isCheckoutOpen,
        setIsCheckoutOpen,
        openCheckout: () => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        },
        closeCheckout: () => setIsCheckoutOpen(false),
        confirmedOrder,
        setConfirmedOrder
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
}
