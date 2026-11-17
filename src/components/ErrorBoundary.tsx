import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Auditoría A5: sin esto, un error de render dejaba la pantalla en blanco.
 * Muestra un mensaje y deja recargar o volver al tablero. `resetKey` (la ruta)
 * limpia el error al navegar a otra página.
 */
interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de render:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
        <div role="alert" className="glass" style={{ padding: 'var(--space-lg) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: 560 }}>
          <h1 style={{ fontSize: '1.5rem' }}>Algo salió mal en esta pantalla</h1>
          <p style={{ margin: 0 }}>
            Tus datos están a salvo. Recarga la página; si vuelve a pasar, avísale al equipo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Recargar
            </button>
            <a href="#/dashboard" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
              Ir al tablero
            </a>
          </div>
        </div>
      </div>
    );
  }
}
