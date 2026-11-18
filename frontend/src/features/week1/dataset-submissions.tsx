import { useState } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { useRemote } from '@/features/portal/data';
import { FormNotice } from '@/features/portal/form-feedback';
import { Button } from '@/components/ui/button';
import { loadDatasetSubmissions } from './data';
import { useWeek1Copy } from './copy';
import { DatasetDetails } from './dataset-details';
import { datasetStatistics } from './domain';
import { useWeek1Sync } from './use-week1-sync';
import { ParticipationApproval } from '@/features/assignments/participation-approval';

// Do not mount the loader until the existing administrative role is verified.
export function DatasetSubmissions() {
  const auth = useAuth();
  return auth.status === 'signed-in' && auth.role === 'team' ? <SubmissionList /> : null;
}

function SubmissionList() {
  const { c, arabic } = useWeek1Copy();
  const remote = useRemote(loadDatasetSubmissions);
  useWeek1Sync(remote.refresh, 'dataset', true);
  const [page, setPage] = useState(0);
  const data = remote.data;
  const current = Math.min(page, Math.max(0, Math.ceil((data?.datasets.length ?? 0) / 20) - 1));
  const number = new Intl.NumberFormat(arabic ? 'ar-JO' : 'en-GB');
  const stats = datasetStatistics(data?.datasets ?? []);
  return (
    <section
      className="content-card"
      id="dataset-student-submissions"
      dir={arabic ? 'rtl' : 'ltr'}
      aria-labelledby="dataset-submissions-title"
    >
      <div className="portal-actions">
        <h2 id="dataset-submissions-title">{c.studentSubmissions}</h2>
      </div>
      {remote.error && <FormNotice message={c.unavailable} kind="error" />}
      {!data ? (
        !remote.error && <p role="status">{c.loading}</p>
      ) : (
        <>
          <dl className="s-facts week1-dataset-stats" aria-label={c.submissionStatistics}>
            <div className="s-fact">
              <dt>{c.totalSubmissions}</dt>
              <dd data-stat="total">{number.format(stats.total)}</dd>
            </div>
            <div className="s-fact">
              <dt>{c.uniqueStudents}</dt>
              <dd data-stat="students">{number.format(stats.students)}</dd>
            </div>
          </dl>
          {!data.datasets.length && <p role="status">{c.noDatasetSubmissions}</p>}
          <div className="week1-submissions-list">
            {data.datasets.slice(current * 20, current * 20 + 20).map((item) => {
              const profile = data.profiles.find((profile) => profile.id === item.student_id);
              return (
                <article
                  className="s-card week1-submission-card"
                  key={item.id}
                  data-student-id={item.student_id}
                  data-attempt-id={item.id}
                >
                  <p>
                    <strong>
                      <bdi dir="auto">{profile?.full_name || c.student}</bdi>
                    </strong>
                  </p>
                  <DatasetDetails attempt={item} />
                  <ParticipationApproval
                    attemptId={item.id}
                    approved={data.awards.some((award) => award.student_id === item.student_id)}
                    onApproved={remote.refresh}
                  />
                </article>
              );
            })}
          </div>
          {data.datasets.length > 20 && (
            <nav className="portal-actions" aria-label={c.studentSubmissions}>
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                {c.previous}
              </Button>
              <bdi>
                {number.format(current + 1)} / {number.format(Math.ceil(data.datasets.length / 20))}
              </bdi>
              <Button
                variant="outline"
                disabled={(current + 1) * 20 >= data.datasets.length}
                onClick={() => setPage(current + 1)}
              >
                {c.next}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
