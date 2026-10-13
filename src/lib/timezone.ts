export const DEFAULT_RESTAURANT_TIMEZONE = "Asia/Kolkata";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMEZONELESS_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(?:\.\d{1,})?)?$/;

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    });
    return true;
  } catch {
    return false;
  }
}

export function getRestaurantTimeZone(value: unknown): string {
  return isValidTimeZone(value)
    ? value
    : DEFAULT_RESTAURANT_TIMEZONE;
}

/**
 * Application timestamp columns currently use timestamp without time zone.
 * They are written as UTC ISO values, so an offset-less value is explicitly
 * interpreted as UTC rather than as the browser or server's local timezone.
 */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = TIMEZONELESS_TIMESTAMP_PATTERN.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(
  value: string | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = parseTimestamp(value);

  if (!date) {
    return "—";
  }

  const usesGranularOptions = [
    "weekday",
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
  ].some((key) => key in options);

  return new Intl.DateTimeFormat("en-IN", {
    ...(usesGranularOptions
      ? {}
      : { dateStyle: "medium", timeStyle: "short" }),
    ...options,
    timeZone: getRestaurantTimeZone(timeZone),
  }).format(date);
}

export function getLocalDate(
  value: Date | string,
  timeZone: string
): string {
  const date = value instanceof Date ? value : parseTimestamp(value);

  if (!date || Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp.");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: getRestaurantTimeZone(timeZone),
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: getRestaurantTimeZone(timeZone),
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

export function localDateTimeToUtc(
  localDateTime: string,
  timeZone: string
): Date {
  const [datePart, timePart = "00:00:00"] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const second = timePart.split(":")[2] ?? "0";
  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    Number.parseFloat(second)
  );
  let timestamp = localAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    timestamp = localAsUtc - getTimeZoneOffset(new Date(timestamp), timeZone);
  }

  return new Date(timestamp);
}

export function localDateTimeToUtcIso(
  value: string,
  timeZone: string
): string {
  return localDateTimeToUtc(value, timeZone).toISOString();
}

export function formatDateTimeLocal(
  value: string | null | undefined,
  timeZone: string
): string {
  const date = parseTimestamp(value);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: getRestaurantTimeZone(timeZone),
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function getZonedDayRange(
  date: Date,
  timeZone: string
): { start: string; end: string } {
  const localDate = getLocalDate(date, timeZone);
  return getZonedDateRange(localDate, localDate, timeZone);
}

export function getZonedDateRange(
  startDate: string,
  endDate: string,
  timeZone: string
): { start: string; end: string } {
  if (
    !DATE_ONLY_PATTERN.test(startDate) ||
    !DATE_ONLY_PATTERN.test(endDate) ||
    startDate > endDate
  ) {
    throw new Error("Invalid local date range.");
  }

  const exclusiveEndDate = addCalendarDays(endDate, 1);

  return {
    start: localDateTimeToUtc(`${startDate}T00:00:00`, timeZone).toISOString(),
    end: localDateTimeToUtc(
      `${exclusiveEndDate}T00:00:00`,
      timeZone
    ).toISOString(),
  };
}
