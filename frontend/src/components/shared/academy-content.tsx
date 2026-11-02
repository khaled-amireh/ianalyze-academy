import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { socialLinks, syllabus } from '@/content/public-content';
import { Button } from '@/components/ui/button';
import { MixedText } from './mixed-text';
import { Reveal } from './reveal';
import { InstagramIcon, LinkedinIcon } from './social-icons';

export function TextLink({ to, children }: { to: string; children: string }) {
  return (
    <Link className="text-link" to={to}>
      <MixedText>{children}</MixedText>
      <ArrowRight className="directional" aria-hidden="true" />
    </Link>
  );
}

export function SocialLinks({ cards = false }: { cards?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cards ? 'social-cards' : 'social-links'}>
      {socialLinks.map((social) => {
        const Icon = social.id === 'instagram' ? InstagramIcon : LinkedinIcon;
        return (
          <a
            key={social.id}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cards ? 'content-card social-card interactive-card' : ''}
            aria-label={`iTeam · ${social.name} · ${t('academy.external')}`}
          >
            <Icon aria-hidden="true" />
            {cards ? (
              <div>
                <p className="small-label">{t('academy.officialSocial')}</p>
                <h2>
                  <bdi dir="ltr">{social.name}</bdi>
                </h2>
                <p>{t(`academy.contact.${social.id}Text`)}</p>
              </div>
            ) : (
              <span>
                <bdi dir="ltr">iTeam · {social.name}</bdi>
              </span>
            )}
            <ExternalLink className="external-icon" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

export function ProgramFacts() {
  const { t } = useTranslation();
  return (
    <div className="program-facts">
      {[syllabus.teachingWeeks, syllabus.plannedHours, syllabus.bufferWeeks].map((value, i) => (
        <div key={value}>
          <strong>{String(value).padStart(2, '0')}</strong>
          <span>{t('home.facts', { returnObjects: true })[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function ModuleCards() {
  const { t } = useTranslation();
  return (
    <div className="module-grid">
      {syllabus.modules.map((module) => (
        <Reveal key={module.id}>
          <article className="content-card module-card interactive-card">
            <p className="module-week">
              <span>{t('academy.week')}</span>
              <bdi dir="ltr">{module.week}</bdi>
            </p>
            <h3>
              <MixedText>{t(`academy.modules.${module.id}.title`)}</MixedText>
            </h3>
            <p>
              <MixedText>{t(`academy.modules.${module.id}.description`)}</MixedText>
            </p>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

export function JoinCallout() {
  const { t } = useTranslation();
  return (
    <Reveal>
      <section className="join-callout">
        <div>
          <h2>{t('academy.cta.title')}</h2>
          <p>{t('academy.cta.text')}</p>
        </div>
        <Button asChild>
          <Link to="/join">
            <MixedText>{t('nav.join')}</MixedText>
            <ArrowRight className="directional" aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </Reveal>
  );
}
