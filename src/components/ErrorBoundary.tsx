import { Component, type ReactNode } from 'react';

/** Affiche une erreur lisible au lieu d'un écran blanc, sans jamais toucher aux données. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-md mx-auto p-6 space-y-3">
        <h1 className="text-xl font-bold">Une erreur est survenue</h1>
        <p className="text-sm text-muted">Tes données sont intactes (elles sont stockées séparément). Recharge la page ; si le problème persiste, fais une sauvegarde depuis « Données ».</p>
        <pre className="text-xs bg-surface2 p-3 rounded-xl overflow-auto">{this.state.error.message}</pre>
        <button className="btn-primary" onClick={() => location.reload()}>Recharger</button>
      </div>
    );
  }
}
