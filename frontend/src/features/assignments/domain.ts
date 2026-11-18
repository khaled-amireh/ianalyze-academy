export type Phase = { name: string; start: string; end: string; points: number };
export type AssignmentError =
  | 'phaseWindow'
  | 'overlappingPhases'
  | 'invalidDates'
  | 'invalidConfiguration'
  | 'invalidLinks'
  | 'unauthorized'
  | 'expiredSession'
  | 'networkError'
  | 'conflict'
  | 'error';
export function assignmentValidation(value: {
  publish_at: string | null;
  due_at: string | null;
  phases: Phase[];
  reference_links: string;
}): AssignmentError | null {
  const start = Date.parse(value.publish_at ?? ''),
    end = Date.parse(value.due_at ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return 'invalidDates';
  if (
    value.reference_links
      .split('\n')
      .filter((s) => s.trim())
      .some((s) => !submissionLink(s.trim()))
  )
    return 'invalidLinks';
  if (!value.phases.length) return 'invalidConfiguration';
  let prior = -Infinity;
  for (const phase of [...value.phases].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const a = Date.parse(phase.start),
      b = Date.parse(phase.end);
    if (
      !phase.name.trim() ||
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      a >= b ||
      !Number.isFinite(phase.points) ||
      phase.points < 0 ||
      phase.points > 999999 ||
      phase.points !== Math.round(phase.points * 100) / 100
    )
      return 'invalidConfiguration';
    if (a < start || b > end) return 'phaseWindow';
    if (a < prior) return 'overlappingPhases';
    prior = b;
  }
  return null;
}
export function assignmentError(error: unknown): AssignmentError {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code) : '',
      status = 'status' in error ? Number(error.status) : 0,
      message = 'message' in error ? String(error.message) : '';
    if (code === '40001' || code === '23505') return 'conflict';
    if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(code))
      return 'expiredSession';
    if (code === '42501' || status === 403) return 'unauthorized';
    if (/Phases must fit/.test(message)) return 'phaseWindow';
    if (/overlapping phases/.test(message)) return 'overlappingPhases';
    if (['22023', '23502', '23514', '22007', '22008'].includes(code)) return 'invalidConfiguration';
    if (error instanceof TypeError || /fetch|network|timeout/i.test(message)) return 'networkError';
  }
  return 'error';
}
export function submissionLink(value: string) {
  try {
    const url = new URL(value);
    return (
      value.length <= 2000 &&
      !/\s/.test(value) &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function ammanInput(iso: string | null) {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export function fromAmmanInput(value: string) {
  if (!value) throw Error('Date required');
  const instant = Date.parse(value + 'Z');
  const offset = Date.parse(ammanInput(new Date(instant).toISOString()) + 'Z') - instant;
  return new Date(instant - offset).toISOString();
}
export function educationalFile(file: Pick<File, 'name' | 'size' | 'type'>) {
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pbix: 'application/octet-stream',
    zip: 'application/zip',
  };
  const mime = types[ext ?? ''];
  if (!mime || file.size < 1 || file.size > 20971520) throw Error('Unsupported file');
  // The reservation and Storage API enforce the same extension/MIME/size rules.
  return { name: file.name, mime, bytes: file.size };
}
