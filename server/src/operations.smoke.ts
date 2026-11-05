/**
 * Smoke test for operating hours. Run: npx tsx server/src/operations.smoke.ts
 * Uses a throwaway database so it never touches data/vmk.db.
 */
const { dirname, join } = await import("node:path");
const { fileURLToPath } = await import("node:url");
process.env.VMK_DB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "smoke-operations.db");

const { unlinkSync, existsSync, mkdirSync } = await import("node:fs");
mkdirSync(dirname(process.env.VMK_DB), { recursive: true });
if (existsSync(process.env.VMK_DB)) unlinkSync(process.env.VMK_DB);

const o = await import("./operations.js");

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};
const at = (iso: string) => Date.parse(iso);
const day = { enabled: true, open: "08:00", close: "23:00", timeZone: "America/New_York" };
const night = { enabled: true, open: "18:00", close: "02:00", timeZone: "America/New_York" };

check("unset: always open", o.isOpen() && o.nextChange() === null);
check("day: open at noon", o.isOpen(at("2026-11-05T12:00:00-05:00"), day));
check("day: closed at 23:30", !o.isOpen(at("2026-11-05T23:30:00-05:00"), day));
check("day: closed at 07:59, open at 08:00", !o.isOpen(at("2026-11-05T07:59:00-05:00"), day) && o.isOpen(at("2026-11-05T08:00:00-05:00"), day));
check("overnight: open at 01:00", o.isOpen(at("2026-11-06T01:00:00-05:00"), night));
check("overnight: closed at noon", !o.isOpen(at("2026-11-05T12:00:00-05:00"), night));

const reopen = o.nextChange(at("2026-11-05T23:30:00-05:00"), day);
check("after closing, the next change is the 08:00 opening", reopen?.opens === true && reopen.at === at("2026-11-06T08:00:00-05:00"));
check("it reads as 8:00 AM EST", reopen ? o.clockTime(reopen.at, day) === "8:00 AM EST" : false);
const closing = o.nextChange(at("2026-11-05T22:59:30-05:00"), day);
check("a minute before closing, the next change is the closing", closing?.opens === false && closing.at === at("2026-11-05T23:00:00-05:00"));
// US daylight saving starts 2027-03-14 at 02:00: the opening stays 08:00 local.
const dst = o.nextChange(at("2027-03-14T00:30:00-05:00"), day);
check("across a DST change the opening stays 8:00 local", dst?.at === at("2027-03-14T08:00:00-04:00"));

check("off: always open, never changes", o.isOpen(at("2026-11-05T03:00:00-05:00"), { ...day, enabled: false }) && o.nextChange(Date.now(), { ...day, enabled: false }) === null);
check("rejects equal times", typeof o.parseSchedule({ open: "08:00", close: "08:00", timeZone: "UTC" }) === "string");
check("rejects a bad time", typeof o.parseSchedule({ open: "8am", close: "23:00", timeZone: "UTC" }) === "string");
check("rejects a bad zone", typeof o.parseSchedule({ open: "08:00", close: "23:00", timeZone: "Mars/Base" }) === "string");

const parsed = o.parseSchedule({ enabled: true, open: "08:00", close: "23:00", timeZone: "America/New_York" });
if (typeof parsed !== "string") o.saveSchedule(parsed, 1);
check("a saved schedule is read back", JSON.stringify(o.schedule()) === JSON.stringify(day) && o.storedSchedule()?.staffId === 1);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
