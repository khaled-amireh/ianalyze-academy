import { UserRoundPlus, ShieldCheck, Clock3, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { registrationFields } from '@/content/public-content';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { MixedText } from '@/components/shared/mixed-text';
import { FormField } from '@/components/shared/form-field';
import { TextLink } from '@/components/shared/academy-content';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function JoinPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.join')}
        title={t('pages.join.title')}
        description={t('pages.join.description')}
        icon={UserRoundPlus}
      />
      <div className="registration-layout">
        <div>
          <section className="registration-notice">
            <Clock3 aria-hidden="true" />
            <div>
              <h2>{t('academy.join.status')}</h2>
              <p>{t('academy.join.explanation')}</p>
              <p>{t('academy.join.access')}</p>
            </div>
          </section>
          <section
            className="registration-preview content-card"
            aria-labelledby="registration-title"
            aria-describedby="registration-description"
          >
            <div className="preview-heading">
              <h2 id="registration-title">{t('academy.join.previewTitle')}</h2>
              <Badge variant="outline">{t('academy.join.status')}</Badge>
            </div>
            <p id="registration-description">{t('academy.join.previewText')}</p>
            <fieldset disabled aria-describedby="registration-description">
              <legend className="sr-only">{t('academy.join.previewTitle')}</legend>
              <div className="field-grid">
                {registrationFields.map((field) => (
                  <FormField
                    key={field.id}
                    id={`registration-${field.id}`}
                    label={`${t(`academy.join.fields.${field.id}`)} · ${t(field.required ? 'academy.join.required' : 'academy.join.optional')}`}
                    hint={field.id === 'whatsapp' ? t('academy.join.privacyText') : undefined}
                  >
                    {field.type === 'select' ? (
                      <select
                        id={`registration-${field.id}`}
                        required={field.required}
                        defaultValue=""
                      >
                        <option value="">{t('academy.join.placeholder')}</option>
                      </select>
                    ) : (
                      <Input
                        id={`registration-${field.id}`}
                        type={field.type}
                        required={field.required}
                        autoComplete="off"
                        placeholder={t('academy.join.placeholder')}
                        aria-describedby={
                          field.id === 'whatsapp' ? `registration-${field.id}-hint` : undefined
                        }
                      />
                    )}
                  </FormField>
                ))}
              </div>
              <label className="consent-preview">
                <input type="checkbox" required />
                <span>
                  <MixedText>{t('academy.join.consent')}</MixedText>
                </span>
              </label>
            </fieldset>
            <Button type="button" disabled aria-describedby="registration-description">
              <Clock3 aria-hidden="true" />
              {t('academy.join.status')}
            </Button>
          </section>
        </div>
        <aside className="registration-aside">
          <section className="content-card">
            <h2>{t('academy.join.stepsTitle')}</h2>
            <ol className="joining-steps">
              {(['account', 'register', 'participate'] as const).map((id, index) => (
                <li key={id}>
                  <bdi dir="ltr">0{index + 1}</bdi>
                  <span>{t(`academy.join.steps.${id}`)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="privacy-note">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>{t('academy.join.privacyTitle')}</h2>
              <p>
                <MixedText>{t('academy.join.privacyText')}</MixedText>
              </p>
            </div>
          </section>
          <section className="content-card prepare-card">
            <BookOpen className="icon-tile" aria-hidden="true" />
            <h2>{t('academy.join.prepareTitle')}</h2>
            <p>{t('academy.join.prepareText')}</p>
            <TextLink to="/eda">{t('academy.fullSyllabus')}</TextLink>
            <TextLink to="/videos">{t('academy.watch')}</TextLink>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
