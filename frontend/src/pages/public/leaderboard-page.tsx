import { Trophy, Award, LockKeyhole, ShieldCheck, Medal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/shared/page-container';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SectionHeading } from '@/components/shared/section-heading';
import { TextLink } from '@/components/shared/academy-content';
import { Badge } from '@/components/ui/badge';

export function LeaderboardPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={t('nav.leaderboard')}
        title={t('pages.leaderboard.title')}
        description={t('pages.leaderboard.description')}
        icon={Trophy}
      />
      <div className="leaderboard-status">
        <Badge variant="outline">{t('academy.leaderboard.status')}</Badge>
      </div>
      <section aria-label={t('academy.leaderboard.topThree')} className="podium-grid">
        {[1, 2, 3].map((rank) => (
          <div key={rank} className={`podium-card podium-${rank}`}>
            <span className="podium-number" aria-hidden="true">
              0{rank}
            </span>
            <Medal aria-hidden="true" />
            <h2>{t('academy.leaderboard.position', { rank })}</h2>
            <p>{t('academy.leaderboard.reserved')}</p>
          </div>
        ))}
      </section>
      <section className="ranking-panel">
        <table>
          <caption>{t('academy.leaderboard.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('academy.leaderboard.rank')}</th>
              <th scope="col">{t('academy.leaderboard.alias')}</th>
              <th scope="col">{t('academy.leaderboard.points')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>-</td>
              <td>{t('academy.leaderboard.reserved')}</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
        <EmptyState
          icon={Trophy}
          title={t('academy.leaderboard.emptyTitle')}
          description={t('academy.leaderboard.emptyText')}
          action={<TextLink to="/eda">{t('academy.fullSyllabus')}</TextLink>}
        />
      </section>
      <div className="two-card-grid public-section">
        <section className="content-card detail-card">
          <LockKeyhole className="icon-tile" aria-hidden="true" />
          <div>
            <h2>{t('academy.leaderboard.personalTitle')}</h2>
            <p>{t('academy.leaderboard.personalText')}</p>
          </div>
        </section>
        <section className="content-card detail-card">
          <ShieldCheck className="icon-tile" aria-hidden="true" />
          <div>
            <h2>{t('academy.leaderboard.privacyTitle')}</h2>
            <p>{t('academy.leaderboard.privacyText')}</p>
          </div>
        </section>
      </div>
      <section className="achievement-section">
        <SectionHeading
          title={t('academy.leaderboard.badgesTitle')}
          description={t('academy.leaderboard.badgesText')}
        />
        <div className="future-badge">
          <Award aria-hidden="true" />
          <span>{t('academy.leaderboard.badgePreview')}</span>
          <LockKeyhole aria-hidden="true" />
        </div>
      </section>
    </PageContainer>
  );
}
