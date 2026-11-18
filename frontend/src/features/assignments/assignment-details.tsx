import type { Row } from '@/features/portal/data';
import { useAssignmentCopy, assignmentTime } from './copy';
import { submissionLink, type Phase } from './domain';
export function AssignmentDetails({ activity }: { activity: Row<'activities'> }) {
  const { c, arabic } = useAssignmentCopy();
  return (
    <>
      <p className="assignment-instructions">
        {arabic ? activity.instructions_ar : activity.instructions_en}
      </p>
      <p>
        {c.deadline}:{' '}
        <time dateTime={activity.due_at!}>{assignmentTime(activity.due_at!, arabic)}</time> ·{' '}
        {c.timezone}
      </p>
      <p>
        {c.submissionType}: {c[activity.submission_type as 'file' | 'link' | 'either']}
      </p>
      <ul>
        {activity.reference_links
          .split('\n')
          .filter(submissionLink)
          .map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noopener noreferrer" dir="ltr">
                {link} ↗
              </a>
            </li>
          ))}
      </ul>
      <details>
        <summary>{c.phases}</summary>
        <p>{c.boundaries}</p>
        <div className="assignment-phases">
          {(activity.phases as unknown as Phase[]).map((phase, i) => (
            <div className="s-card" key={i}>
              <strong dir="auto">{phase.name}</strong>
              <p>
                <time dateTime={phase.start}>{assignmentTime(phase.start, arabic)}</time> –{' '}
                <time dateTime={phase.end}>{assignmentTime(phase.end, arabic)}</time>
              </p>
              <p>
                {c.maximum}: {phase.points}
              </p>
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
