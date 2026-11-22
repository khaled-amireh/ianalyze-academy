export const ACTIVITY_FILE_LIMIT = 10 * 1024 * 1024;

export async function readBoundedJsonObject(request: Request, maxBytes = 1024): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes))
    throw new Error('Invalid request body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request body');

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Invalid request body');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally {
    bytes.fill(0);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request body');
  return parsed as Record<string, unknown>;
}

const fileTypes: Record<string, string[]> = {
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

export function normalizedActivityFileType(name: string, declaredType: string) {
  if (name.length < 1 || Array.from(name).length > 180 || /[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(name))
    throw new Error('Invalid filename');
  const extension = name.toLowerCase().split('.').at(-1) ?? '';
  const allowed = fileTypes[extension];
  if (!allowed) throw new Error('Unsupported file type');
  const type = declaredType || allowed[0]!;
  if (!allowed.includes(type)) throw new Error('File type mismatch');
  return { extension, type };
}

function contains(bytes: Uint8Array, text: string) {
  const pattern = new TextEncoder().encode(text);
  outer: for (let i = 0; i <= bytes.length - pattern.length; i += 1) {
    for (let j = 0; j < pattern.length; j += 1) if (bytes[i + j] !== pattern[j]) continue outer;
    return true;
  }
  return false;
}

function validateUtf8Text(bytes: Uint8Array) {
  if (bytes.includes(0)) throw new Error('Binary content is not allowed');
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function validateActivityFile(bytes: Uint8Array, filename: string, declaredType: string) {
  const { extension, type } = normalizedActivityFileType(filename, declaredType);
  if (bytes.length < 1 || bytes.length > ACTIVITY_FILE_LIMIT) throw new Error('Invalid file size');
  if (
    extension === 'pdf' &&
    ![0x25, 0x50, 0x44, 0x46, 0x2d].every((value, index) => bytes[index] === value)
  )
    throw new Error('Invalid PDF signature');
  if (extension === 'png' && ![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => bytes[i] === x))
    throw new Error('Invalid PNG signature');
  if ((extension === 'jpg' || extension === 'jpeg') && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff))
    throw new Error('Invalid JPEG signature');
  if (extension === 'xls' && ![0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((x, i) => bytes[i] === x))
    throw new Error('Invalid XLS signature');
  if (extension === 'xlsx' && !(bytes[0] === 0x50 && bytes[1] === 0x4b
    && contains(bytes, '[Content_Types].xml') && contains(bytes, 'xl/workbook.xml')))
    throw new Error('Invalid XLSX container');
  if (extension === 'ipynb') {
    validateUtf8Text(bytes);
    const notebook = JSON.parse(new TextDecoder().decode(bytes));
    if (!notebook || typeof notebook !== 'object' || Array.isArray(notebook)
      || !Array.isArray(notebook.cells) || !notebook.metadata || typeof notebook.metadata !== 'object'
      || !Number.isInteger(notebook.nbformat) || notebook.nbformat < 4)
      throw new Error('Invalid notebook structure');
  }
  if (extension === 'csv' || extension === 'txt') validateUtf8Text(bytes);
  if (extension === 'csv' && type === 'text/csv' && bytes.length < 3) throw new Error('Invalid CSV content');
  return { extension, contentType: type };
}
