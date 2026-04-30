export const UK_TIME_ZONE = 'Europe/London';
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

export const COMMON_TIME_ZONES = [
  'Asia/Karachi',
  'Europe/London',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const getSupportedTimeZones = () => {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };

  return intlWithSupportedValues.supportedValuesOf?.('timeZone') ?? COMMON_TIME_ZONES;
};

export const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const formatInTimeZone = (date: Date, timeZone: string, hour12 = true) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  }).format(date);

export const formatTimeOnlyInTimeZone = (date: Date, timeZone: string, hour12 = false) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  }).format(date);

export const getDateInTimeZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return (zonedAsUtc - date.getTime()) / 60000;
};

export const zonedTimeToUtc = (date: string, time: string, timeZone = PAKISTAN_TIME_ZONE) => {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number);
  if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) return null;

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60000);
};

export const intervalToMinutes = (interval: unknown, fallbackMinutes = 45) => {
  if (typeof interval === 'number' && Number.isFinite(interval)) return Math.max(0, Math.floor(interval));
  if (typeof interval !== 'string' || !interval.trim()) return fallbackMinutes;

  const timeMatch = interval.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3] ?? 0);
    return Math.max(0, Math.floor(hours * 60 + minutes + seconds / 60));
  }

  const hourMatch = interval.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  const minuteMatch = interval.match(/(\d+(?:\.\d+)?)\s*mins?|(\d+(?:\.\d+)?)\s*minutes?/i);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1] ?? minuteMatch[2]) : 0;
  const total = hours * 60 + minutes;
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : fallbackMinutes;
};

export const minutesToPostgresInterval = (minutes: number) => {
  const safe = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
  return `${safe} minutes`;
};
