/**
 * Operating hours, as staff set them in /hk (Server > Operations): the game
 * opens and closes at the same time every day, in a time zone staff pick.
 * While it is closed, players cannot get in (staff can); at closing time the
 * game server warns, then removes, everyone still playing (mus-server.ts
 * `followOperations`), and the website says when it opens again.
 *
 * Off until staff switch it on: an unset schedule means always open.
 *
 * ⚠ Both servers read this, from the same `server_settings` table as the park
 * season (season-store.ts), re-read at most once a second.
 */
import { db } from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS server_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    staff_id   INTEGER,
    updated_at INTEGER NOT NULL
  );
`);

export interface Schedule {
  /** false: always open, whatever the times say. */
  enabled: boolean;
  /** "HH:MM", 24-hour, in `timeZone`. */
  open: string;
  close: string;
  /** IANA name, e.g. "America/New_York". */
  timeZone: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT: Schedule = { enabled: false, open: "08:00", close: "23:00", timeZone: "UTC" };

export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A schedule from staff input, or the reason it isn't one. */
export function parseSchedule(input: Record<string, unknown>): Schedule | string {
  const open = String(input.open ?? "");
  const close = String(input.close ?? "");
  if (!TIME.test(open) || !TIME.test(close)) return "Times are HH:MM, 24-hour.";
  if (open === close) return "Opening and closing can't be the same time.";
  if (!isTimeZone(input.timeZone)) return "Pick a time zone.";
  return { enabled: input.enabled === true, open, close, timeZone: input.timeZone as string };
}

export function storedSchedule(): { schedule: Schedule; staffId: number | null; updatedAt: number } | null {
  const row = db.prepare("SELECT value, staff_id, updated_at FROM server_settings WHERE key = 'operations'").get() as
    | { value: string; staff_id: number | null; updated_at: number }
    | undefined;
  if (!row) return null;
  try {
    const parsed = parseSchedule(JSON.parse(row.value) as Record<string, unknown>);
    if (typeof parsed === "string") return null;
    return { schedule: parsed, staffId: row.staff_id === null ? null : Number(row.staff_id), updatedAt: Number(row.updated_at) };
  } catch {
    return null;
  }
}

export function saveSchedule(schedule: Schedule, staffId: number): void {
  db.prepare(
    `INSERT INTO server_settings (key, value, staff_id, updated_at) VALUES ('operations', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, staff_id = excluded.staff_id, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(schedule), staffId, Date.now());
  checkedAt = 0;
}

let cached: Schedule = DEFAULT;
let checkedAt = 0;

/** The schedule in force. Re-read at most once a second. */
export function schedule(): Schedule {
  const now = Date.now();
  if (now - checkedAt >= 1000) {
    checkedAt = now;
    cached = storedSchedule()?.schedule ?? DEFAULT;
  }
  return cached;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** One formatter per zone: building one costs far more than using it, and `nextChange` uses it thousands of times. */
const clocks = new Map<string, Intl.DateTimeFormat>();

/** Minutes past midnight at `at`, on the wall clock of `zone`. */
function wallMinutes(at: number, zone: string): number {
  let clock = clocks.get(zone);
  if (!clock) {
    clock = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    clocks.set(zone, clock);
  }
  const parts = clock.formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

/** Open at this wall-clock minute? A close earlier than the open runs overnight. */
function openAtMinute(minute: number, s: Schedule): boolean {
  const open = toMinutes(s.open);
  const close = toMinutes(s.close);
  return open < close ? minute >= open && minute < close : minute >= open || minute < close;
}

export function isOpen(at = Date.now(), s = schedule()): boolean {
  return !s.enabled || openAtMinute(wallMinutes(at, s.timeZone), s);
}

/**
 * The next moment the game opens or closes after `at`, or null when the
 * schedule is off. Found by stepping a minute at a time (at most two days), so
 * daylight-saving changes need no special case.
 */
export function nextChange(at = Date.now(), s = schedule()): { opens: boolean; at: number } | null {
  if (!s.enabled) return null;
  const now = isOpen(at, s);
  const start = Math.floor(at / 60_000) * 60_000;
  for (let t = start + 60_000; t <= start + 2 * 86_400_000; t += 60_000) {
    if (isOpen(t, s) !== now) return { opens: !now, at: t };
  }
  return null;
}

/** "8:00 AM EST": a moment on the schedule's own clock, for players and staff. */
export function clockTime(at: number, s = schedule()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(at);
}
