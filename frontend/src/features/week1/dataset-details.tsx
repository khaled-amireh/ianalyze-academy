import { ExternalLink } from 'lucide-react';
import type { Row } from '@/features/portal/data';
import { formatTime, useWeek1Copy } from './copy';
export function DatasetDetails({ attempt }: { attempt: Row<'week1_datasets'> }) {
  const { c, arabic } = useWeek1Copy();
  return (
    <div className="week1-dataset-details">
      <h3 dir="auto">{attempt.title}</h3>
      <p>
        {c.attemptReference}: <bdi>{attempt.id}</bdi>
      </p>
      <a href={attempt.url} target="_blank" rel="noopener noreferrer">
        <bdi dir="ltr">{attempt.url}</bdi> <ExternalLink size={16} aria-hidden="true" />
      </a>
      <p>
        {c.status}: {attempt.status === 'submitted' ? c.submitted : c.draft}
      </p>
      {attempt.submitted_at && (
        <p>
          {c.timestamp}:{' '}
          <time dateTime={attempt.submitted_at}>{formatTime(attempt.submitted_at, arabic)}</time>
        </p>
      )}
      <dl className="week1-details">
        {(['topic', 'description', 'column1', 'column2', 'column3', 'question'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{c.fields[key]}</dt>
              <dd dir="auto">{attempt[key]}</dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}
