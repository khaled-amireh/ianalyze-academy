import type { CSSProperties } from 'react';
import { ArrowRight, CalendarDays, Clock, GraduationCap } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { leaders, syllabus } from '@/content/public-content';
import { LinkedinIcon } from './social-icons';
import { MixedText } from './mixed-text';

/** Small building blocks shared by the simplified home, study plan and about pages. */

export function CourseFacts({ wide = false }: { wide?: boolean }) {
  const { t } = useTranslation();
  const facts = [
    { id: 'duration', icon: Clock },
    { id: 'when', icon: CalendarDays },
    { id: 'level', icon: GraduationCap },
  ] as const;
  return (
    <dl className={wide ? 's-facts s-facts-wide' : 's-facts'}>
      {facts.map(({ id, icon: Icon }) => (
        <div key={id} className="s-fact">
          <Icon aria-hidden="true" />
          <dt>{t(`simple.${id}Label`)}</dt>
          <dd>{t(`simple.${id}Value`)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WeekList() {
  const { t } = useTranslation();
  return (
    <ol className="s-weeks">
      {syllabus.modules.map((module, index) => (
        <li key={module.id} style={{ '--i': index } as CSSProperties}>
          <span className="s-week-number" dir="ltr">
            {module.week}
          </span>
          <div>
            <h3>
              <MixedText>{t(`academy.modules.${module.id}.title`)}</MixedText>
            </h3>
            <p>
              <MixedText>{t(`academy.modules.${module.id}.description`)}</MixedText>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TeamRow() {
  const { t } = useTranslation();
  return (
    <div className="s-team">
      {leaders.map((leader) => {
        const name = t(`academy.team.${leader.id}`);
        return (
          <figure key={leader.id} className={`s-person leader-${leader.id}`}>
            <img
              src={leader.photo}
              alt={t('academy.team.portrait', { name })}
              width={leader.width}
              height={leader.height}
              loading="lazy"
            />
            <figcaption>
              <strong>
                <MixedText>{name}</MixedText>
              </strong>
              <span>
                {t(
                  leader.id === 'yomna' ? 'academy.team.educationFemale' : 'academy.team.education',
                )}
              </span>
              <a
                className="s-person-link"
                href={leader.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`LinkedIn · ${name}`}
              >
                <LinkedinIcon />
              </a>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function RegisterBand() {
  const { t } = useTranslation();
  return (
    <section className="s-register">
      <div>
        <h2>{t('academy.cta.title')}</h2>
        <p>{t('academy.cta.text')}</p>
      </div>
      <Button asChild size="lg">
        <Link to="/join">
          <MixedText>{t('nav.join')}</MixedText>
          <ArrowRight className="directional" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
