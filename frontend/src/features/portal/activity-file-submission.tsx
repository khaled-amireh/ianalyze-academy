import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormNotice } from './form-feedback';
import { usePortalCopy } from './copy';
import { checked, client, type Row } from './data';
import { readSupabaseConfiguration } from '@/lib/supabase-config';
import {
  activityFileAccept,
  findResumableActivitySubmission,
  validateSelectedActivityFiles,
} from './submission-file-validation';

type ReservedFile = { id: string; path: string; name: string; size: number };
type Reservation = { id: string; status: string; files: ReservedFile[] };

function uploadFile(path: string, file: File, type: string, progress: (loaded: number) => void) {
  const configuration = readSupabaseConfiguration(import.meta.env);
  if (configuration.status !== 'configured') throw new Error('Backend unavailable');
  return client()
    .auth.getSession()
    .then(({ data, error }) => {
      const accessToken = data.session?.access_token;
      if (error || !accessToken) throw new Error('Verified session required');
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const endpoint = new URL(
        `/storage/v1/object/activity-submissions/${encodedPath}`,
        configuration.url,
      );
      return new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', endpoint);
        request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        request.setRequestHeader('apikey', configuration.publishableKey);
        request.setRequestHeader('Content-Type', type);
        request.setRequestHeader('x-upsert', 'false');
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) progress(event.loaded);
        };
        request.onerror = () => reject(new Error('Upload failed'));
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) resolve();
          else reject(new Error('Upload failed'));
        };
        request.send(file);
      });
    });
}

async function digest(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  bytes.fill(0);
  return Array.from(result, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function ActivityFileSubmission({
  activity,
  enabled,
  reload,
  pendingSubmissions,
  submissionFiles,
}: {
  activity: Row<'activities'>;
  enabled: boolean;
  reload: () => void;
  pendingSubmissions: Row<'submissions'>[];
  submissionFiles: Row<'activity_submission_files'>[];
}) {
  const { c } = usePortalCopy();
  const inputId = `activity-files-${activity.id}`;
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<keyof ReturnType<typeof usePortalCopy>['c'] | ''>('');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  function choose(next: FileList | File[]) {
    const selected = Array.from(next);
    try {
      validateSelectedActivityFiles(selected, {
        maxFiles: activity.max_submission_files,
        maxBytes: activity.max_submission_file_bytes,
      });
      setFiles(selected);
      setMessage('');
      requestRef.current = null;
    } catch {
      setFiles([]);
      setMessage('error');
    }
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (enabled && !busy) choose(event.dataTransfer.files);
  }
  async function submit() {
    if (inFlight.current || !enabled || !files.length) return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    setProgress({ loaded: 0, total: totalBytes });
    try {
      const selected = validateSelectedActivityFiles(files, {
        maxFiles: activity.max_submission_files,
        maxBytes: activity.max_submission_file_bytes,
      });
      const metadata = await Promise.all(
        selected.map(async ({ file, name, type }) => ({
          name,
          type,
          size: file.size,
          sha256: await digest(file),
        })),
      );
      const fingerprint = JSON.stringify(metadata);
      if (!requestRef.current || requestRef.current.fingerprint !== fingerprint) {
        const resumableId = findResumableActivitySubmission(
          pendingSubmissions.map((submission) => ({
            id: submission.id,
            activity_id: submission.activity_id,
            status: submission.status,
            files: submissionFiles
              .filter((file) => file.submission_id === submission.id)
              .map((file) => ({
                position: file.position,
                original_name: file.original_name,
                content_type: file.content_type,
                size_bytes: file.size_bytes,
                expected_sha256: file.expected_sha256,
              })),
          })),
          activity.id,
          metadata,
        );
        requestRef.current = { fingerprint, id: resumableId ?? crypto.randomUUID() };
      }
      const reserved = checked(
        await client().rpc('reserve_activity_submission', {
          p_activity_id: activity.id,
          p_request_id: requestRef.current.id,
          p_files: metadata,
        }),
      ) as unknown as Reservation;
      if (reserved.status === 'submitted') {
        setMessage('submitted');
        reload();
        return;
      }
      if (!Array.isArray(reserved.files) || reserved.files.length !== files.length)
        throw new Error('Invalid reservation');
      let completedBytes = 0;
      for (let index = 0; index < files.length; index += 1) {
        const selectedFile = selected[index]!;
        const reservedFile = reserved.files[index]!;
        if (reservedFile.name !== selectedFile.name || reservedFile.size !== selectedFile.file.size)
          throw new Error('Reservation does not match selected files');
        const folder = reservedFile.path.split('/').slice(0, -1).join('/');
        const fileName = reservedFile.path.split('/').at(-1)!;
        const existing = await client()
          .storage.from('activity-submissions')
          .list(folder, { search: fileName });
        if (existing.error) throw new Error('Upload status unavailable');
        if (existing.data.some((item) => item.name === fileName)) {
          completedBytes += selectedFile.file.size;
          setProgress({ loaded: completedBytes, total: totalBytes });
          continue;
        }
        await uploadFile(reservedFile.path, selectedFile.file, selectedFile.type, (loaded) => {
          setProgress({ loaded: completedBytes + loaded, total: totalBytes });
        });
        completedBytes += selectedFile.file.size;
      }
      const finalized = await client().functions.invoke('activity-submit', {
        body: { submissionId: reserved.id },
      });
      if (finalized.error) throw finalized.error;
      setMessage('submitted');
      requestRef.current = null;
      setFiles([]);
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function cancel(submissionId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await client().functions.invoke('activity-submit', {
        body: { submissionId, action: 'cancel' },
      });
      if (result.error) throw result.error;
      reload();
    } catch {
      setMessage('error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="activity-file-submission" aria-busy={busy}>
      <p>{c.activityFilesHint}</p>
      <p>
        {c.acceptedFiles} · {c.maxFiles}: {activity.max_submission_files} · {c.maxFileSize}:{' '}
        {activity.max_submission_file_bytes / 1048576}
      </p>
      <label
        className="activity-file-drop"
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        aria-disabled={!enabled || busy}
      >
        {c.chooseFiles}
        <input
          id={inputId}
          type="file"
          multiple
          accept={activityFileAccept}
          disabled={!enabled || busy}
          aria-label={c.chooseFiles}
          onChange={(event) => choose(event.currentTarget.files ?? [])}
        />
      </label>
      {!enabled && <p>{c.uploadClosed}</p>}
      {files.length > 0 && (
        <>
          <h4>{c.selectedFiles}</h4>
          <ul>
            {files.map((file) => (
              <li key={`${file.name}:${file.size}`}>
                <bdi dir="auto">{file.name}</bdi> — {Math.ceil(file.size / 1024)} KiB
              </li>
            ))}
          </ul>
        </>
      )}
      {busy && progress.total > 0 && (
        <div>
          <label htmlFor={`${inputId}-progress`}>{c.uploadProgress}</label>
          <progress id={`${inputId}-progress`} max={progress.total} value={progress.loaded} />
          <bdi dir="ltr">{Math.floor((progress.loaded / progress.total) * 100)}%</bdi>
        </div>
      )}
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={!enabled || busy || !files.length}
      >
        {busy ? c.uploading : c.fileUpload}
      </Button>
      {pendingSubmissions.map((submission) => (
        <div key={submission.id} className="portal-actions">
          <span>{c.uploadPending}</span>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void cancel(submission.id)}
          >
            {c.cancelUpload}
          </Button>
        </div>
      ))}
      <FormNotice
        message={message ? c[message] : ''}
        kind={message === 'submitted' ? 'success' : 'error'}
      />
    </section>
  );
}
