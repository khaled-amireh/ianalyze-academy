import { BookOpen, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { MixedText } from './mixed-text';

export function EmptyState({
  title,
  description,
  icon: Icon = BookOpen,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="icon-tile">
        <Icon aria-hidden="true" />
      </span>
      <h2>
        <MixedText>{title}</MixedText>
      </h2>
      <p>
        <MixedText>{description}</MixedText>
      </p>
      {action}
    </section>
  );
}
