/** Keep this contract in sync with app_private.normalize_jordanian_mobile. */
export function normalizeJordanianMobile(input: string): string | null {
  if (input.length > 64) return null;
  const compact = input.replace(/[ \u00a0\u202f().-]/g, '');
  if (/^07[789][0-9]{7}$/.test(compact)) return '+962' + compact.slice(1);
  if (/^\+9627[789][0-9]{7}$/.test(compact)) return compact;
  if (/^009627[789][0-9]{7}$/.test(compact)) return '+' + compact.slice(2);
  return null;
}
