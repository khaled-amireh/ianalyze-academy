import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { faqIds } from '@/content/public-content';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { SectionHeading } from '@/components/shared/section-heading';
import { SocialLinks } from '@/components/shared/academy-content';
import { MixedText } from '@/components/shared/mixed-text';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function ContactPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.contact')}
        title={t('pages.contact.title')}
        description={t('pages.contact.description')}
        icon={CircleHelp}
      />
      <section>
        <SectionHeading
          title={t('academy.contact.socialTitle')}
          description={t('academy.contact.socialText')}
        />
        <SocialLinks cards />
      </section>
      <section className="public-section faq-section">
        <SectionHeading
          eyebrow={t('academy.contact.faqEyebrow')}
          title={t('academy.contact.faqTitle')}
        />
        <Accordion type="single" collapsible>
          {faqIds.map((id) => (
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
    </PageContainer>
  );
}
