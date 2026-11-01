import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PageHeader } from '@/components/shared/page-header';
import { SectionHeading } from '@/components/shared/section-heading';
import { ResponsiveGrid } from '@/components/shared/page-container';
import { FormField } from '@/components/shared/form-field';
import { StatusIndicator } from '@/components/shared/status-indicator';
import { LoadingIndicator } from '@/components/shared/loading-indicator';
import { EmptyState } from '@/components/shared/empty-state';
import { MixedText } from '@/components/shared/mixed-text';
import { Reveal } from '@/components/shared/reveal';

export function ComponentGallery() {
  const { t } = useTranslation('preview');
  const id = useId();
  return (
    <div className="component-gallery">
      <PageHeader
        eyebrow={t('components.eyebrow')}
        title={t('components.title')}
        description={t('components.description')}
        icon={Sparkles}
      />
      <section>
        <SectionHeading title={t('components.buttons')} />
        <div className="action-row">
          <Dialog>
            <DialogTrigger asChild>
              <Button>{t('components.primary')}</Button>
            </DialogTrigger>
            <DialogContent closeLabel={t('components.dialogClose')}>
              <DialogHeader>
                <DialogTitle>{t('components.dialogTitle')}</DialogTitle>
                <DialogDescription>{t('components.dialogDescription')}</DialogDescription>
              </DialogHeader>
              <p>
                <MixedText>{t('components.dialogBody')}</MixedText>
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t('components.dialogClose')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline">{t('components.secondary')}</Button>
          <Button variant="ghost">{t('components.quiet')}</Button>
          <Button disabled>{t('components.disabled')}</Button>
        </div>
      </section>
      <Reveal>
        <section>
          <SectionHeading title={t('components.cards')} />
          <ResponsiveGrid>
            {[0, 1, 2].map((i) => (
              <Card key={i} className="interactive-card">
                <CardHeader>
                  <span className="card-number" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <CardTitle>{t('components.cardTitle')}</CardTitle>
                  <CardDescription>{t('components.cardDescription')}</CardDescription>
                </CardHeader>
                <CardContent>{t('components.cardBody')}</CardContent>
              </Card>
            ))}
          </ResponsiveGrid>
        </section>
      </Reveal>
      <section>
        <SectionHeading title={t('components.statuses')} />
        <div className="action-row">
          {(['neutral', 'pending', 'success', 'warning', 'error'] as const).map((tone) => (
            <StatusIndicator key={tone} tone={tone} />
          ))}
        </div>
      </section>
      <section>
        <SectionHeading title={t('components.fields')} />
        <div className="field-grid">
          <FormField
            id={`${id}-goal`}
            label={t('components.fieldLabel')}
            hint={t('components.fieldHint')}
          >
            <Input
              id={`${id}-goal`}
              aria-describedby={`${id}-goal-hint`}
              placeholder={t('components.fieldPlaceholder')}
              autoComplete="off"
            />
          </FormField>
          <FormField id={`${id}-notes`} label={t('components.notesLabel')}>
            <Textarea id={`${id}-notes`} autoComplete="off" />
          </FormField>
          <FormField
            id={`${id}-error`}
            label={t('components.errorLabel')}
            error={t('components.errorText')}
          >
            <Input
              id={`${id}-error`}
              aria-invalid="true"
              aria-describedby={`${id}-error-error`}
              autoComplete="off"
            />
          </FormField>
        </div>
      </section>
      <section>
        <SectionHeading title={t('components.disclosures')} />
        <Accordion type="single" collapsible>
          <AccordionItem value="direction">
            <AccordionTrigger>{t('components.disclosureTitle')}</AccordionTrigger>
            <AccordionContent>
              <MixedText>{t('components.disclosureBody')}</MixedText>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="motion">
            <AccordionTrigger>{t('components.motionTitle')}</AccordionTrigger>
            <AccordionContent>{t('components.motionBody')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
      <section>
        <SectionHeading title={t('components.states')} />
        <LoadingIndicator />
        <EmptyState
          title={t('components.emptyTitle')}
          description={t('components.emptyDescription')}
        />
      </section>
      <section>
        <SectionHeading title={t('components.code')} />
        <pre dir="ltr" lang="en">
          <code>
            {
              'import pandas as pd\n\ndata = pd.DataFrame({"value": [3, 7, 12]})\nprint(data.describe())'
            }
          </code>
        </pre>
      </section>
    </div>
  );
}
