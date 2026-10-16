const TIME_ZONE = 'Europe/Budapest';

const logFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Formats as `YYYY-MM-DD HH:mm:ss.SSS` in Europe/Budapest */
export const formatLogTimestamp = (date: Date = new Date()): string => {
  const parts: Record<string, string> = {};
  for (const { type, value } of logFormatter.formatToParts(date)) parts[type] = value;
  const ms = String(date.getTime() % 1000).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${ms}`;
};

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** Human-readable time relative to now, e.g. "5 minutes ago" */
export const fromNow = (date: Date, now: number = Date.now()): string => {
  const diffSeconds = (date.getTime() - now) / 1000;
  const abs = Math.abs(diffSeconds);
  for (const [unit, size] of UNITS) {
    if (abs >= size) return relativeFormatter.format(Math.trunc(diffSeconds / size), unit);
  }
  return relativeFormatter.format(Math.trunc(diffSeconds), 'second');
};
