export const MAX_NOTEBOOK_BYTES = 262144;
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) =>
  typeof value === "string" ||
  (Array.isArray(value) && value.every((v) => typeof v === "string"));
export function validateNotebook(bytes: Uint8Array, filename: string) {
  if (
    !filename.endsWith(".ipynb") ||
    filename.length > 180 ||
    /[\\/\x00-\x1f]/.test(filename)
  )
    throw new Error("Invalid filename");
  if (!bytes.length || bytes.length > MAX_NOTEBOOK_BYTES)
    throw new Error("Notebook exceeds size limit");
  let notebook: unknown;
  try {
    notebook = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new Error("Invalid UTF-8 notebook JSON");
  }
  const pending: { value: unknown; depth: number }[] = [
    { value: notebook, depth: 0 },
  ];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++count > 50000 || depth > 24)
      throw new Error("Notebook structure too complex");
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Non-finite number");
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        pending.push({ value: child, depth: depth + 1 });
  }
  if (
    !object(notebook) ||
    notebook.nbformat !== 4 ||
    !Number.isInteger(notebook.nbformat_minor) ||
    Number(notebook.nbformat_minor) < 0 ||
    Number(notebook.nbformat_minor) > 5 ||
    !object(notebook.metadata) ||
    !Array.isArray(notebook.cells) ||
    notebook.cells.length > 1000
  )
    throw new Error("Unsupported notebook structure");
  const ids = new Set<string>();
  for (const cell of notebook.cells) {
    if (
      !object(cell) ||
      !["code", "markdown", "raw"].includes(String(cell.cell_type)) ||
      !text(cell.source) ||
      !object(cell.metadata)
    )
      throw new Error("Invalid cell");
    if (Number(notebook.nbformat_minor) >= 5) {
      if (
        typeof cell.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(cell.id) ||
        ids.has(cell.id)
      )
        throw new Error("Invalid cell ID");
      ids.add(cell.id);
    }
    if (cell.cell_type === "code") {
      if (
        !(
          cell.execution_count === null ||
          (Number.isInteger(cell.execution_count) &&
            Number(cell.execution_count) >= 0)
        ) ||
        !Array.isArray(cell.outputs)
      )
        throw new Error("Invalid code cell");
      for (const output of cell.outputs) {
        if (!object(output)) throw new Error("Invalid output");
        if (output.output_type === "stream") {
          if (
            !["stdout", "stderr"].includes(String(output.name)) ||
            !text(output.text)
          )
            throw new Error("Invalid stream");
        } else if (
          output.output_type === "display_data" ||
          output.output_type === "execute_result"
        ) {
          if (!object(output.data) || !object(output.metadata))
            throw new Error("Invalid display output");
          if (
            output.output_type === "execute_result" &&
            !(
              output.execution_count === null ||
              Number.isInteger(output.execution_count)
            )
          )
            throw new Error("Invalid execution count");
        } else if (output.output_type === "error") {
          if (
            typeof output.ename !== "string" ||
            typeof output.evalue !== "string" ||
            !Array.isArray(output.traceback) ||
            !output.traceback.every((v) => typeof v === "string")
          )
            throw new Error("Invalid error output");
        } else throw new Error("Unknown output");
      }
    }
  }
  return notebook;
}
export async function notebookDigest(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(hash), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Body required");
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_NOTEBOOK_BYTES) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
