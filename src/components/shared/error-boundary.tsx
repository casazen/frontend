import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryInner extends React.Component<
  { children: React.ReactNode; fallbackRender?: (error: Error) => React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallbackRender?: (error: Error) => React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(this.state.error);
      }
      return <ErrorFallback error={this.state.error} onReload={() => window.location.reload()} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReload }: { error: Error; onReload: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">{t('shared.errorBoundary.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || t('shared.errorBoundary.fallbackMessage')}
        </p>
        <Button onClick={onReload}>{t('shared.errorBoundary.reload')}</Button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundaryInner>{children}</ErrorBoundaryInner>;
}
