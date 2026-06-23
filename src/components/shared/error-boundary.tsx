import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps extends WithTranslation {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="rounded-full bg-destructive/10 p-6">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">{t('shared.errorBoundary.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || t('shared.errorBoundary.fallbackMessage')}
            </p>
            <Button onClick={() => window.location.reload()}>
              {t('shared.errorBoundary.reload')}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
