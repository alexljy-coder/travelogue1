export function tripDates(start: string | null, end: string | null): string {
  if (!start && !end) return 'Dates unknown';
  if (!start) return `Until ${end}`;
  if (!end) return `From ${start}`;
  return start === end ? start : `${start} – ${end}`;
}
export function listPage(value: string | undefined): number {
  return value && /^\d+$/.test(value) ? Math.min(Math.max(Number(value), 1), 100000) : 1;
}
