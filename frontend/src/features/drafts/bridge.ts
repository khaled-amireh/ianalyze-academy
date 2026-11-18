export const controllers = new WeakMap<HTMLFormElement, { complete: () => Promise<void> }>();
export async function completeFormDraft(form: HTMLFormElement) {
  await controllers.get(form)?.complete();
}
export function hasLocalFormDraft(owner: string, form: string) {
  try {
    return localStorage.getItem('ianalyze.draft-open.' + owner + ':' + form) === 'true';
  } catch {
    return false;
  }
}
