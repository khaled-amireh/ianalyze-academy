import type { Json } from '@/types/database';
export type FormPayload = {
  fields: Record<string, string | boolean | string[]>;
  extra: Json;
  fileSelected: boolean;
};
export function draftEqual(a: unknown, b: unknown): boolean {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, sorted(v)]),
          )
        : v;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}
export const forbiddenField =
  /(password|confirmation|token|authorization|credential|secret|cache_key)/i;
export function captureFields(form: HTMLFormElement, extra: Json): FormPayload {
  const fields: FormPayload['fields'] = {};
  let fileSelected = false;
  for (const control of form.elements) {
    if (!(
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLSelectElement
    ))
      continue;
    if (control instanceof HTMLInputElement && control.type === 'file') {
      fileSelected ||= !!control.files?.length;
      continue;
    }
    if (!control.name || forbiddenField.test(control.name) || control.type === 'password') continue;
    if (control instanceof HTMLInputElement && control.type === 'radio') {
      if (control.checked) fields[control.name] = control.value;
    } else if (control instanceof HTMLInputElement && control.type === 'checkbox')
      fields[control.name] = control.checked;
    else if (control instanceof HTMLSelectElement && control.multiple)
      fields[control.name] = [...control.selectedOptions].map((option) => option.value);
    else fields[control.name] = control.value;
  }
  return { fields, extra, fileSelected };
}
export function restoreFields(form: HTMLFormElement, fields: FormPayload['fields']) {
  for (const control of form.elements) {
    if (
      !(
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement
      ) ||
      !control.name ||
      !(control.name in fields) ||
      forbiddenField.test(control.name) ||
      ['password', 'file'].includes(control.type)
    )
      continue;
    const value = fields[control.name];
    if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
      const checked = control.type === 'checkbox' ? value === true : control.value === value;
      if (control.checked !== checked) control.click();
      continue;
    }
    if (control instanceof HTMLSelectElement && Array.isArray(value)) {
      for (const option of control.options) option.selected = value.includes(option.value);
    } else {
      const prototype =
        control instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : control instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, String(value ?? ''));
    }
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
