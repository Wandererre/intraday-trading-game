import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Arena ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: 'var(--bg-page, #f8fafc)',
          color: 'var(--text-primary, #0f172a)',
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-hairline, #e2e8f0)',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0' }}>
              Trading Session Recovery
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              A UI rendering hiccup was caught and prevented from closing your session.
              Click below to restore the live trading dashboard.
            </p>

            {this.state.error && (
              <pre style={{
                textAlign: 'left',
                backgroundColor: 'var(--bg-page, #f1f5f9)',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#ef4444',
                overflowX: 'auto',
                marginBottom: '20px',
                maxHeight: '100px'
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: 'var(--accent, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Resume Trading
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary, #64748b)',
                  border: '1px solid var(--border-hairline, #cbd5e1)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
