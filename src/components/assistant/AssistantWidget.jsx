import React, { useState, useEffect } from 'react';
import { RobotFloatingButton } from './RobotFloatingButton';
import { AssistantChatModal } from './AssistantChatModal';

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    enabled: true,
    botName: 'Asistente URBAN STYLE',
    welcomeMessage: '¡Hola! 👋 Bienvenido a URBAN STYLE. Estoy aquí para ayudarte a encontrar lo que buscas. ¿Qué te gustaría descubrir hoy?',
    accentColor: '#FF5A1F',
    enableVisualCards: true,
    enableBestsellers: true,
    enableBudgetRecommendations: true,
    enableWhatsappHandoff: true,
    whatsappHandoffMessage: '¡Hola! Estuve conversando con el asistente virtual de URBAN STYLE y me gustaría recibir asesoría humana con mi compra.'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Cargar configuración en tiempo real desde la API
  useEffect(() => {
    let isMounted = true;
    fetch('/api/assistant/settings')
      .then((res) => (res.ok ? res.json() : Promise.reject('No settings')))
      .then((data) => {
        if (isMounted && data?.success && data?.data) {
          setSettings(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Permitir apertura programática mediante evento global
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('urban:open-assistant', handleOpenEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('urban:open-assistant', handleOpenEvent);
    };
  }, []);

  if (!settings.enabled && !isLoading) {
    return null;
  }

  return (
    <>
      {/* 1. BOTÓN FLOTANTE CON SILUETA EXCLUSIVA DE ROBOT (UBICADO INMEDIATAMENTE SOBRE WHATSAPP) */}
      <RobotFloatingButton
        isOpen={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        isEnabled={settings.enabled}
      />

      {/* 2. VENTANA DE CHAT ASISTENTE CON TARJETAS VISUALES Y CONEXIÓN A NEON POSTGRESQL */}
      <AssistantChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        settings={settings}
      />
    </>
  );
}

export default AssistantWidget;
