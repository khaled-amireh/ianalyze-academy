import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { BrowserRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n';
import { App } from './app/app';
import { ThemeProvider } from './app/theme-provider';
import { ErrorBoundary } from './app/error-boundary';
import { AuthProvider } from './features/auth/auth-provider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
);
