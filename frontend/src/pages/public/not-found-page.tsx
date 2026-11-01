import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/shared/page-container';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <section className="error-page">
        <span className="icon-tile">
          <Compass aria-hidden="true" />
        </span>
        <p className="eyebrow" dir="ltr">
          404
        </p>
        <h1 id="page-title" tabIndex={-1}>
          {t('error.notFoundTitle')}
        </h1>
        <p className="lede">{t('error.notFoundDescription')}</p>
        <Button asChild>
          <Link to="/">{t('common.backHome')}</Link>
        </Button>
      </section>
    </PageContainer>
  );
}
