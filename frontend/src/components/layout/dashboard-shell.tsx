import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { PageHeader } from '@/components/shared/page-header';
import { MixedText } from '@/components/shared/mixed-text';

interface DashboardShellProps {
  roleLabel: string;
  title: string;
  description: string;
  eyebrow: string;
  navigation: readonly { to: string; label: string; icon: LucideIcon; end?: boolean }[];
  children: ReactNode;
}
export function DashboardShell({
  roleLabel,
  title,
  description,
  eyebrow,
  navigation,
  children,
}: DashboardShellProps) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <p className="small-label">{roleLabel}</p>
        <nav aria-label={roleLabel}>
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon aria-hidden="true" />
              <span>
                <MixedText>{label}</MixedText>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dashboard-content">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </div>
  );
}
