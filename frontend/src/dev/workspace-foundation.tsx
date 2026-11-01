import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  ClipboardList,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

const sections = {
  student: ['activities', 'submissions', 'achievements'],
  organizer: ['reviews', 'progress', 'syllabus'],
  admin: ['applications', 'students', 'roles', 'activities', 'announcements'],
} as const;
const icons = {
  activities: BookOpen,
  submissions: FileCheck,
  achievements: Trophy,
  reviews: ClipboardList,
  progress: GraduationCap,
  syllabus: BookOpen,
  applications: ClipboardList,
  students: Users,
  roles: ShieldCheck,
  announcements: Megaphone,
};
export function WorkspaceFoundation({ role }: { role: keyof typeof sections }) {
  const { t } = useTranslation('preview');
  const { section } = useParams();
  const root = `/_preview/${role}`;
  const selected = sections[role].find((key) => key === section);
  const navigation = [
    { to: root, label: t('workspace.overview'), icon: LayoutDashboard, end: true },
    ...sections[role].map((key) => ({
      to: `${root}/${key}`,
      label: t(`workspace.${key}`),
      icon: icons[key],
    })),
  ];
  return (
    <DashboardShell
      roleLabel={t(`tabs.${role}`)}
      eyebrow={t('workspace.eyebrow')}
      title={selected ? t(`workspace.${selected}`) : t(`workspace.${role}`)}
      description={selected ? t('workspace.sectionDescription') : t(`workspace.${role}Description`)}
      navigation={navigation}
    >
      {selected ? (
        <EmptyState
          title={t(`workspace.${selected}`)}
          description={t('workspace.sectionDescription')}
          action={
            <Button asChild variant="outline">
              <Link to={root}>{t('workspace.back')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="stat-grid">
            {([0, 1, 2] as const).map((index) => (
              <Card key={index}>
                <CardHeader>
                  <CardDescription>
                    {t('workspace.statLabels', { returnObjects: true })[index]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <strong className="stat-value">—</strong>
                  <p className="muted">{t('workspace.placeholder')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="workspace-grid">
            <Card>
              <CardHeader>
                <BookOpen aria-hidden="true" />
                <CardTitle as="h2">{t('workspace.panelTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{t('workspace.panelDescription')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Megaphone aria-hidden="true" />
                <CardTitle as="h2">{t('workspace.announcementTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{t('workspace.announcementDescription')}</p>
              </CardContent>
            </Card>
          </div>
          <section className="privacy-note">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>{t('workspace.privacyTitle')}</h2>
              <p>{t('workspace.privacyDescription')}</p>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
