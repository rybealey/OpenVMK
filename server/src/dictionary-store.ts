/**
 * Staff changes to the chat dictionary (/hk Content > Dictionary), on top of
 * the recovered `dictionary_177` that dictionary.ts expands.
 *
 *   added    appended to the word list players download, so the client
 *            recognises the word instead of sending it as free text (which
 *            the server censors)
 *   blocked  censored by the server even though the dictionary has it
 *
 * ⚠ AN ADDED WORD IS PERMANENT. Chat travels as positions in the expanded
 * list, and every client holds the list it downloaded. Deleting an added word
 * would move every later one, so a client with the old list would show a
 * different word for the same position. "Removing" an added word therefore
 * BLOCKS it; its row, and its place, stay.
 *
 * ⚠ Both servers open this database: the web server serves the list and /hk
 * edits it, the game server censors chat. A change bumps the version, which
 * dictionary.ts compares at most once a second, so it reaches the game server
 * with no restart and no bridge call (the same scheme as catalog-store.ts).
 */
import { db } from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS dictionary_words (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- added words are appended in id order
    word       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    added      INTEGER NOT NULL DEFAULT 0,
    blocked    INTEGER NOT NULL DEFAULT 0,
    staff_id   INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dictionary_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export interface DictionaryEntry {
  id: number;
  word: string;
  added: boolean;
  blocked: boolean;
  staffId: number | null;
  createdAt: number;
  updatedAt: number;
}

function rowToEntry(row: Record<string, unknown>): DictionaryEntry {
  return {
    id: Number(row.id),
    word: String(row.word),
    added: Number(row.added) === 1,
    blocked: Number(row.blocked) === 1,
    staffId: row.staff_id === null ? null : Number(row.staff_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function dictionaryVersion(): number {
  const row = db.prepare("SELECT value FROM dictionary_meta WHERE key = 'version'").get() as { value?: string } | undefined;
  return Number(row?.value ?? 0);
}

let localChanges = 0;

/**
 * Changes made by THIS process. dictionary.ts re-checks the shared version at
 * most once a second; a change made here should not wait for that.
 */
export const localChangeCount = (): number => localChanges;

function bumpVersion(): void {
  localChanges++;
  db.prepare(
    `INSERT INTO dictionary_meta (key, value) VALUES ('version', '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1`,
  ).run();
}

/** Every staff change, added words first in the order they were appended. */
export function dictionaryEntries(): DictionaryEntry[] {
  const rows = db.prepare("SELECT * FROM dictionary_words ORDER BY added DESC, id").all() as Array<Record<string, unknown>>;
  return rows.map(rowToEntry);
}

export function dictionaryEntry(word: string): DictionaryEntry | undefined {
  const row = db.prepare("SELECT * FROM dictionary_words WHERE word = ?").get(word) as Record<string, unknown> | undefined;
  return row ? rowToEntry(row) : undefined;
}

/** Append a word to the players' dictionary (or un-block one already appended). */
export function addWord(word: string, staffId: number): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO dictionary_words (word, added, blocked, staff_id, created_at, updated_at) VALUES (?, 1, 0, ?, ?, ?)
     ON CONFLICT(word) DO UPDATE SET added = 1, blocked = 0, staff_id = excluded.staff_id, updated_at = excluded.updated_at`,
  ).run(word, staffId, now, now);
  bumpVersion();
}

export function blockWord(word: string, staffId: number): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO dictionary_words (word, added, blocked, staff_id, created_at, updated_at) VALUES (?, 0, 1, ?, ?, ?)
     ON CONFLICT(word) DO UPDATE SET blocked = 1, staff_id = excluded.staff_id, updated_at = excluded.updated_at`,
  ).run(word, staffId, now, now);
  bumpVersion();
}

/**
 * Lift a block. A recovered word's row goes away (it is simply allowed again);
 * an added word keeps its row, and its place, and is allowed again.
 */
export function unblockWord(word: string, staffId: number): void {
  db.prepare("DELETE FROM dictionary_words WHERE word = ? AND added = 0").run(word);
  db.prepare("UPDATE dictionary_words SET blocked = 0, staff_id = ?, updated_at = ? WHERE word = ?").run(
    staffId,
    Date.now(),
    word,
  );
  bumpVersion();
}
