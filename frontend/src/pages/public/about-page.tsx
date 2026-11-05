import { Lightbulb, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { SocialLinks } from '@/components/shared/academy-content';
import { ParentLogo } from '@/components/layout/brand-logo';
import { RegisterBand, TeamRow } from '@/components/shared/simple-blocks';

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <header className="s-page-head">
        <h1 id="page-title" tabIndex={-1}>
          {t('simple.aboutPageTitle')}
        </h1>
        <p className="s-lede">
          <MixedText>{t('simple.aboutText')}</MixedText>
        </p>
      </header>

      <div className="s-cards s-cards-3">
        <section className="s-card s-parent">
          <ParentLogo transparent />
          <h2>{t('simple.parentTitle')}</h2>
          <p>
            <MixedText>{t('simple.parentText')}</MixedText>
          </p>
        </section>
        <section className="s-card">
          <Lightbulb className="s-card-icon" aria-hidden="true" />
          <h2>{t('simple.howTitle')}</h2>
          <p>{t('simple.howText')}</p>
        </section>
        <section className="s-card">
          <Megaphone className="s-card-icon" aria-hidden="true" />
          <h2>{t('simple.newsTitle')}</h2>
          <p>
            <MixedText>{t('simple.newsText')}</MixedText>
          </p>
          <SocialLinks />
        </section>
      </div>

      <section className="s-section" id="team">
        <div className="s-section-head">
          <h2>{t('nav.team')}</h2>
        </div>
        <TeamRow />
      </section>

      <RegisterBand />
    </PageContainer>
  );
}
