import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <main className="error-page page-container">
      <AlertTriangle aria-hidden="true" />
      <h1>{t('error.title')}</h1>
      <p>{t('error.description')}</p>
      <Button asChild>
        <a href="/">{t('common.backHome')}</a>
      </Button>
    </main>
  );
}
export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Interface render failed.', error, info.componentStack);
  }
  render() {
    return this.state.failed ? <ErrorFallback /> : this.props.children;
  }
}
