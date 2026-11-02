import React from 'react';

/**
 * ErrorBoundary de URBAN STYLE
 * Previene pantallas en blanco ante cualquier excepción inesperada en el árbol de componentes.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[URBAN STYLE] Error capturado en el árbol de componentes:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#111111',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            backgroundColor: '#FF5A1F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem'
          }}>
            US
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            URBAN STYLE
          </h1>
          <p style={{ color: '#888888', maxWidth: '480px', marginBottom: '2rem', lineHeight: 1.6 }}>
            Ocurrió una interrupción inesperada al cargar la interfaz. Hemos registrado el incidente para solucionarlo.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: '#FF5A1F',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.85rem 2rem',
              borderRadius: '4px',
              fontWeight: '700',
              cursor: 'pointer',
              letterSpacing: '0.05em'
            }}
          >
            RECARGAR PÁGINA
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
