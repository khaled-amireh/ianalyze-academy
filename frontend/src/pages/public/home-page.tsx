import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PageContainer } from '@/components/shared/page-container';
import { MixedText } from '@/components/shared/mixed-text';
import { Reveal } from '@/components/shared/reveal';
import { HeroChart } from '@/components/shared/hero-chart';
import { TextLink } from '@/components/shared/academy-content';
import { RegisterBand, TeamRow } from '@/components/shared/simple-blocks';

const homeFaq = ['beginner', 'python', 'registration', 'schedule'] as const;

export function HomePage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <section className="s-hero">
        <div className="s-hero-copy">
          <p className="s-eyebrow">
            <MixedText>{t('simple.heroEyebrow')}</MixedText>
          </p>
          <h1 id="page-title" tabIndex={-1}>
            <MixedText>{t('simple.heroTitle')}</MixedText>
          </h1>
          <p className="s-lede">
            <MixedText>{t('simple.heroText')}</MixedText>
          </p>
          <div className="s-actions">
            <Button asChild size="lg">
              <Link to="/join">
                <MixedText>{t('nav.join')}</MixedText>
                <ArrowRight className="directional" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <HeroChart />
      </section>

      <Reveal>
        <section className="s-section s-about">
          <div>
            <h2>{t('simple.aboutTitle')}</h2>
            <p>
              <MixedText>{t('simple.aboutText')}</MixedText>
            </p>
            <TextLink to="/about#team">{t('simple.teamLink')}</TextLink>
          </div>
          <TeamRow />
        </section>
      </Reveal>

      <section className="s-section">
        <div className="s-section-head">
          <h2>{t('simple.faqTitle')}</h2>
          <TextLink to="/contact">{t('simple.faqMore')}</TextLink>
        </div>
        <Accordion type="single" collapsible className="s-faq">
          {homeFaq.map((id) => (
            <AccordionItem value={id} key={id}>
              <AccordionTrigger>
                <MixedText>{t(`academy.faq.${id}.question`)}</MixedText>
              </AccordionTrigger>
              <AccordionContent>
                <MixedText>{t(`academy.faq.${id}.answer`)}</MixedText>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <RegisterBand />
    </PageContainer>
  );
}
