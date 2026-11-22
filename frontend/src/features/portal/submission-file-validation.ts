const accepted: Record<string, string[]> = {
  pdf: ['application/pdf'],
  csv: ['text/csv', 'application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  ipynb: ['application/x-ipynb+json', 'application/json'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  txt: ['text/plain'],
};

export const activityFileAccept = '.pdf,.csv,.xlsx,.xls,.ipynb,.png,.jpg,.jpeg,.txt';
function hasUnsafeFilenameCharacter(value: string) {
  return Array.from(value).some((character) => {
    const point = character.codePointAt(0)!;
    return (
      character === '/' ||
      character === '\\' ||
      point <= 0x1f ||
      (point >= 0x7f && point <= 0x9f) ||
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069)
    );
  });
}
export function validateSelectedActivityFiles(
  files: File[],
  limits: { maxFiles: number; maxBytes: number },
) {
  if (files.length < 1 || files.length > limits.maxFiles) throw new Error('file-count');
  const normalized = files.map((file) => {
    const name = file.name.normalize('NFC');
    if (!name || Array.from(name).length > 180 || hasUnsafeFilenameCharacter(name))
      throw new Error('filename');
    const extension = name.toLowerCase().split('.').at(-1) ?? '';
    const types = accepted[extension];
    if (!types) throw new Error('type');
    const type = file.type || types[0]!;
    if (!types.includes(type)) throw new Error('type');
    if (file.size < 1 || file.size > limits.maxBytes) throw new Error('size');
    return { file, name, type };
  });
  if (new Set(normalized.map(({ name }) => name.toLocaleLowerCase())).size !== normalized.length)
    throw new Error('duplicate');
  return normalized;
}

export type PendingFileManifestItem = {
  position: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  expected_sha256: string;
};
export type PendingFileSubmission = {
  id: string;
  activity_id: string;
  status: string;
  files: PendingFileManifestItem[];
};
export type SelectedFileManifestItem = {
  name: string;
  type: string;
  size: number;
  sha256: string;
};

export function findResumableActivitySubmission(
  pending: PendingFileSubmission[],
  activityId: string,
  files: SelectedFileManifestItem[],
) {
  return pending.find((submission) => {
    if (
      submission.activity_id !== activityId ||
      submission.status !== 'uploading' ||
      submission.files.length !== files.length
    )
      return false;
    const ordered = [...submission.files].sort((a, b) => a.position - b.position);
    return ordered.every((reserved, index) => {
      const selected = files[index];
      return Boolean(
        selected &&
        reserved.original_name === selected.name &&
        reserved.content_type === selected.type &&
        reserved.size_bytes === selected.size &&
        reserved.expected_sha256 === selected.sha256,
      );
    });
  })?.id;
}
