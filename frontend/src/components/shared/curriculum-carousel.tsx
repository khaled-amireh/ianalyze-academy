import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Database,
  Eraser,
  ChartNoAxesCombined,
  FolderCheck,
} from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { syllabus } from '@/content/public-content';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { MixedText } from './mixed-text';

const icons = [Code2, Code2, Database, Eraser, ChartNoAxesCombined, FolderCheck];

export function CurriculumCarousel() {
  const { t, i18n } = useTranslation();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [viewport, api] = useEmblaCarousel({
    align: 'start',
    direction: i18n.resolvedLanguage === 'ar' ? 'rtl' : 'ltr',
    loop: false,
    slidesToScroll: 1,
  });
  const [position, setPosition] = useState({ index: 0, previous: false, next: true });
  const sync = useCallback(() => {
    if (api)
      setPosition({
        index: api.selectedScrollSnap(),
        previous: api.canScrollPrev(),
        next: api.canScrollNext(),
      });
  }, [api]);
  useEffect(() => {
    if (!api) return;
    api.on('select', sync).on('reInit', sync);
    api.reInit();
    return () => {
      api.off('select', sync).off('reInit', sync);
    };
  }, [api, sync]);
  return (
    <div
      className="curriculum-carousel"
      role="region"
      aria-roledescription={t('redesign.carouselRole')}
      aria-label={t('academy.syllabus.weeklyTitle')}
    >
      <div
        className="curriculum-viewport"
        ref={viewport}
        id="curriculum-slides"
        onFocusCapture={(event) => {
          const slide = (event.target as HTMLElement).closest<HTMLElement>('[data-slide]');
          if (slide) api?.scrollTo(Number(slide.dataset.slide), true);
        }}
      >
        <div className="curriculum-track">
          {syllabus.modules.map((module, index) => {
            const Icon = icons[index] ?? Code2;
            return (
              <article
                className="curriculum-slide"
                key={module.id}
                data-slide={index}
                role="group"
                aria-roledescription={t('redesign.slideRole')}
                aria-label={t('redesign.slideLabel', {
                  current: index + 1,
                  total: syllabus.modules.length,
                })}
              >
                <div className="curriculum-card">
                  <div className="curriculum-card-top">
                    <Icon aria-hidden="true" />
                    <span>
                      {t('academy.week')} <bdi dir="ltr">{module.week}</bdi>
                    </span>
                  </div>
                  <h3>
                    <Link to="/eda#weekly-modules">
                      <MixedText>{t(`academy.modules.${module.id}.title`)}</MixedText>
                    </Link>
                  </h3>
                  <p>
                    <MixedText>{t(`academy.modules.${module.id}.description`)}</MixedText>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="carousel-controls">
        <p className="carousel-status" aria-live="polite" aria-atomic="true">
          {t('redesign.slideLabel', {
            current: position.index + 1,
            total: syllabus.modules.length,
          })}
        </p>
        <div>
          <Button
            variant="outline"
            size="icon"
            aria-controls="curriculum-slides"
            aria-label={t('redesign.previous')}
            disabled={!position.previous}
            onClick={() => api?.scrollPrev(reduced)}
          >
            <ArrowLeft className="directional" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-controls="curriculum-slides"
            aria-label={t('redesign.next')}
            disabled={!position.next}
            onClick={() => api?.scrollNext(reduced)}
          >
            <ArrowRight className="directional" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
