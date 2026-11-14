import React from 'react';
import { t } from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * What shows instead of the broken part. 'app': a full screen with Reload
   * (the last resort around the whole app). Anything else is drawn in place.
   */
  fallback: React.ReactNode | 'app';
  /** A new value (another song, new lyrics…) tries again. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  failed: boolean;
  key: unknown;
}

/**
 * Catches a render error below it so one bad piece of data (a malformed
 * lyric, an odd chart) can't blank the whole app. The error goes to the
 * console only; people see a translated message.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    console.error('[BandWith] render error', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== 'app') return this.props.fallback;
    return (
      <div
        role="alert"
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-background text-foreground"
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <p className="bw-h2">{t('Something went wrong')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 px-5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-button-md"
        >
          {t('Reload')}
        </button>
      </div>
    );
  }
}
