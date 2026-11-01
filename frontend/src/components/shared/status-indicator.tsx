import { Check, Circle, Clock3, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export type StatusTone = 'neutral' | 'pending' | 'success' | 'warning' | 'error';
export function StatusIndicator({ tone = 'neutral' }: { tone?: StatusTone }) {
  const { t } = useTranslation();
  const Icon =
    tone === 'success'
      ? Check
      : tone === 'pending'
        ? Clock3
        : tone === 'warning' || tone === 'error'
          ? TriangleAlert
          : Circle;
  return (
    <Badge variant="outline" className={`status-indicator status-${tone}`}>
      <Icon aria-hidden="true" />
      {t(`status.${tone}`)}
    </Badge>
  );
}
