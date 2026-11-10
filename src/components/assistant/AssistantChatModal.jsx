import React, { useState, useEffect, useRef } from 'react';
import './AssistantChatModal.css';

const DEFAULT_WELCOME =
  '¡Hola! 👋 Bienvenido a URBAN STYLE. Estoy aquí para ayudarte a encontrar lo que buscas. ¿Qué te gustaría descubrir hoy?';

const DEFAULT_SUGGESTIONS = [
  '🔥 Más vendidos',
  '🏷️ Ofertas',
  '👟 Zapatillas',
  '👕 Camisetas',
  '💬 Hablar por WhatsApp'
];

/**
 * Formatea precios en pesos colombianos para tarjetas visuales
 */
function formatPrice(amount) {
  if (typeof amount !== 'number') return amount || '$0 COP';
  return `$${amount.toLocaleString('es-CO')} COP`;
}

export function AssistantChatModal({ isOpen, onClose, settings = {} }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('urban_assistant_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    return [
      {
        id: 'welcome',
        sender: 'bot',
        text: settings?.welcomeMessage || DEFAULT_WELCOME,
        products: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedReplies: DEFAULT_SUGGESTIONS
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll al final al recibir nuevos mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isTyping]);

  // Persistir historial en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('urban_assistant_chat_history', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  if (!isOpen) return null;

  // Manejar envío de mensaje
  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isTyping) return;

    const userMsgId = 'usr_' + Date.now();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Agregar mensaje del usuario a la conversación
    const newHistory = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        products: [],
        timestamp: timeStr
      }
    ];
    setMessages(newHistory);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });

      const data = await response.json();

      if (data && data.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            text: data.text,
            products: Array.isArray(data.products) ? data.products : [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedReplies: Array.isArray(data.suggestedReplies) && data.suggestedReplies.length > 0
              ? data.suggestedReplies
              : DEFAULT_SUGGESTIONS
          }
        ]);
      } else {
        throw new Error('Respuesta inválida');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'bot_err_' + Date.now(),
          sender: 'bot',
          text: 'Disculpa, tuve un breve inconveniente de conexión. Puedes volver a preguntarme o comunicarte con nuestro equipo por WhatsApp.',
          products: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedReplies: ['🔥 Más vendidos', '🏷️ Ofertas', '💬 Hablar por WhatsApp']
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Navegar suavemente a la sección de productos o emitir evento de selección
  const handleViewProduct = (product) => {
    onClose();
    const element = document.getElementById('productos') || document.querySelector('.featured-products');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Enlace directo a WhatsApp si se requiere soporte humano
  const whatsappNumber = (settings?.whatsappNumber || '3001234567').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    settings?.whatsappHandoffMessage || '¡Hola! Estuve conversando con el asistente de compras de URBAN STYLE y me gustaría recibir asesoría humana con mi pedido.'
  )}`;

  // Obtener sugerencias del último mensaje del bot
  const lastBotMessage = [...messages].reverse().find((m) => m.sender === 'bot');
  const activeSuggestions = lastBotMessage?.suggestedReplies || DEFAULT_SUGGESTIONS;

  return (
    <div className="assistant-modal-dock" role="dialog" aria-label="Asistente Virtual de Compras">
      {/* 1. CABECERA DEL ASISTENTE */}
      <header className="assistant-header">
        <div className="assistant-header-left">
          <div className="assistant-avatar-badge">
            <svg viewBox="0 0 48 48" className="assistant-avatar-svg" fill="none">
              <rect x="8" y="11" width="32" height="26" rx="6" fill="#1E1E1E" stroke="#FF5A1F" strokeWidth="2" />
              <rect x="12" y="16" width="24" height="11" rx="3" fill="#0A0A0A" />
              <rect x="15" y="19" width="5" height="5" rx="1.5" fill="#FF5A1F" />
              <rect x="28" y="19" width="5" height="5" rx="1.5" fill="#FF5A1F" />
              <line x1="24" y1="11" x2="24" y2="4" stroke="#FF5A1F" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="4" r="2.5" fill="#FF5A1F" />
            </svg>
            <span className="assistant-avatar-dot" />
          </div>
          <div className="assistant-header-titles">
            <h3 className="assistant-title">Tu asesor de compras</h3>
            <p className="assistant-subtitle">
              <span className="live-indicator" /> En línea 24/7 · {settings?.storeName || 'URBAN STYLE'}
            </p>
          </div>
        </div>

        <div className="assistant-header-actions">
          <button
            type="button"
            className="assistant-control-btn"
            onClick={onClose}
            title="Minimizar asistente"
            aria-label="Minimizar"
          >
            —
          </button>
          <button
            type="button"
            className="assistant-control-btn"
            onClick={onClose}
            title="Cerrar chat"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. CUERPO DE MENSAJES */}
      <div className="assistant-messages-body">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message-row is-${msg.sender}`}>
            <div className="chat-bubble">
              <div className="chat-bubble-text">{msg.text}</div>

              {/* TARJETAS VISUALES DE PRODUCTOS EN EL CHAT */}
              {Array.isArray(msg.products) && msg.products.length > 0 && (
                <div className="chat-products-carousel" aria-label="Recomendaciones de productos">
                  {msg.products.map((prod) => (
                    <article key={prod.id} className="chat-product-card">
                      <div className="chat-product-img-wrap">
                        <img
                          src={prod.image || '/images/products/prod-tshirt.jpg'}
                          alt={prod.name}
                          className="chat-product-img"
                          loading="lazy"
                        />
                        {prod.hasActiveDiscount && prod.discountPercent > 0 && (
                          <span className="chat-discount-badge">-{prod.discountPercent}% OFF</span>
                        )}
                        {typeof prod.stock === 'number' && prod.stock <= 3 && prod.stock > 0 && (
                          <span className="chat-stock-badge">¡Últimas {prod.stock}!</span>
                        )}
                      </div>

                      <div className="chat-product-info">
                        <h4 className="chat-product-name" title={prod.name}>
                          {prod.name}
                        </h4>

                        <div className="chat-product-pricing">
                          <span className="chat-product-price">
                            {formatPrice(prod.price || prod.finalPrice)}
                          </span>
                          {prod.hasActiveDiscount && prod.originalPrice && (
                            <span className="chat-product-old-price">
                              {formatPrice(prod.originalPrice)}
                            </span>
                          )}
                        </div>

                        {Array.isArray(prod.sizes) && prod.sizes.length > 0 && (
                          <div className="chat-product-sizes" title="Tallas disponibles">
                            {prod.sizes.slice(0, 4).map((sz, i) => (
                              <span key={i} className="chat-size-tag">
                                {sz}
                              </span>
                            ))}
                            {prod.sizes.length > 4 && (
                              <span className="chat-size-tag">+{prod.sizes.length - 4}</span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          className="chat-view-prod-btn"
                          onClick={() => handleViewProduct(prod)}
                        >
                          Ver producto ➔
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <span className="chat-timestamp">{msg.timestamp}</span>
          </div>
        ))}

        {/* INDICADOR DE GENERACIÓN DE RESPUESTA */}
        {isTyping && (
          <div className="chat-message-row is-bot">
            <div className="chat-typing-indicator" aria-label="El asistente está redactando una respuesta">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. SUGERENCIAS RÁPIDAS (PASTILLAS CLICKEABLES) */}
      <div className="chat-suggestions-dock" aria-label="Sugerencias rápidas">
        {activeSuggestions.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            className="chat-suggestion-chip"
            onClick={() => handleSendMessage(sug)}
            disabled={isTyping}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* BANNER OPCIONAL PARA ESCALAMIENTO DIRECTO A WHATSAPP */}
      {settings?.enableWhatsappHandoff !== false && (
        <div className="chat-whatsapp-handoff-banner">
          <p className="chat-whatsapp-handoff-text">¿Prefieres asesoría humana por chat?</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-whatsapp-handoff-btn"
          >
            <span>💬</span> WhatsApp
          </a>
        </div>
      )}

      {/* 4. CAMPO DE ENTRADA Y ENVÍO */}
      <footer className="assistant-input-footer">
        <form
          className="assistant-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="assistant-input"
            placeholder="Escribe tu consulta o pide una recomendación..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            maxLength={300}
            aria-label="Mensaje para el asistente"
          />
          <button
            type="submit"
            className="assistant-send-btn"
            disabled={!inputMessage.trim() || isTyping}
            aria-label="Enviar mensaje"
          >
            <svg viewBox="0 0 24 24" className="assistant-send-icon">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}

export default AssistantChatModal;
