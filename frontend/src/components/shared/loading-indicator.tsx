import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LoadingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="loading-icon" aria-hidden="true" />
      <span>{t('common.loading')}</span>
    </div>
  );
}
