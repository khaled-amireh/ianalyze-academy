// PostgREST caps a single response. Never silently truncate Team review/grade data.
export async function fetchAll<T>(
  page: (
    start: number,
    end: number,
  ) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
) {
  const rows: T[] = [];
  let total: number | undefined;
  do {
    const result = await page(rows.length, rows.length + 499);
    if (result.error || !result.data || result.count === null)
      throw new Error('Incomplete data response');
    total = result.count;
    if (total > 200000) throw new Error('Use a more selective query');
    if (!result.data.length && rows.length < total) throw new Error('Data changed; refresh');
    rows.push(...result.data);
  } while (rows.length < total);
  return rows;
}
