const timeZone = 'Asia/Amman';
const dateTimeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsAt(instant: Date) {
  const parts = Object.fromEntries(
    dateTimeParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function toAmmanDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const p = partsAt(new Date(value));
  return `${p.year.toString().padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function fromAmmanDateTimeLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid local date and time');
  const target = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const nominal = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const check = new Date(nominal);
  if (
    check.getUTCFullYear() !== target.year ||
    check.getUTCMonth() + 1 !== target.month ||
    check.getUTCDate() !== target.day ||
    target.hour > 23 ||
    target.minute > 59
  )
    throw new Error('Invalid local date and time');
  let instant = nominal;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsAt(new Date(instant));
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    instant += nominal - represented;
  }
  const actual = partsAt(new Date(instant));
  if (
    Object.keys(target).some(
      (key) => actual[key as keyof typeof actual] !== target[key as keyof typeof target],
    )
  )
    throw new Error('This local time does not exist in Asia/Amman');
  return new Date(instant).toISOString();
}

export function weeklyPeriodForDisplay(startValue: string, exclusiveEndValue: string) {
  const start = Date.parse(startValue);
  const exclusiveEnd = Date.parse(exclusiveEndValue);
  if (!Number.isFinite(start) || !Number.isFinite(exclusiveEnd) || exclusiveEnd <= start)
    return null;
  return {
    start: new Date(start).toISOString(),
    end: new Date(exclusiveEnd - 1).toISOString(),
  };
}
