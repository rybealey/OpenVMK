/**
 * The park's season, as staff set it in /hk (Overview > Park season). It
 * overrides `VMK_SEASON`; until staff pick one, the environment decides, as
 * before (seasons.ts `seasonFromEnv`).
 *
 * ⚠ Both servers read this. The web server builds each player's room config
 * from it on every request; the game server checks it every few seconds and
 * re-lays out the rooms whose seasonal build has a different floor plan
 * (mus-server.ts `followSeason`). Players see a change the next time they load
 * the game.
 */
import { db } from "./db.js";
import { seasonFromEnv, type Season } from "./seasons.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS server_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    staff_id   INTEGER,
    updated_at INTEGER NOT NULL
  );
`);

/** What staff can pick: a season, or the everyday park. */
export type SeasonChoice = Season | "none";

export function isSeasonChoice(v: unknown): v is SeasonChoice {
  return v === "none" || v === "xmas" || v === "halloween";
}

/** The season staff saved, with who and when; null when none was ever saved. */
export function storedSeason(): { season: SeasonChoice; staffId: number | null; updatedAt: number } | null {
  const row = db.prepare("SELECT value, staff_id, updated_at FROM server_settings WHERE key = 'season'").get() as
    | { value: string; staff_id: number | null; updated_at: number }
    | undefined;
  if (!row || !isSeasonChoice(row.value)) return null;
  return { season: row.value, staffId: row.staff_id === null ? null : Number(row.staff_id), updatedAt: Number(row.updated_at) };
}

export function saveSeason(season: SeasonChoice, staffId: number): void {
  db.prepare(
    `INSERT INTO server_settings (key, value, staff_id, updated_at) VALUES ('season', ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, staff_id = excluded.staff_id, updated_at = excluded.updated_at`,
  ).run(season, staffId, Date.now());
  checkedAt = 0;
}

let cached: Season | null = null;
let checkedAt = 0;

/** The season in force: staff's choice, else `VMK_SEASON`. Re-read at most once a second. */
export function currentSeason(): Season | null {
  const now = Date.now();
  if (now - checkedAt < 1000) return cached;
  checkedAt = now;
  const stored = storedSeason();
  cached = stored ? (stored.season === "none" ? null : stored.season) : seasonFromEnv();
  return cached;
}
