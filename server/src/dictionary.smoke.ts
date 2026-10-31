/**
 * Smoke test for staff dictionary changes. Run: npx tsx server/src/dictionary.smoke.ts
 * Uses a throwaway database so it never touches data/vmk.db.
 */
const { dirname, join } = await import("node:path");
const { fileURLToPath } = await import("node:url");
process.env.VMK_DB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "smoke-dictionary.db");

const { unlinkSync, existsSync, mkdirSync } = await import("node:fs");
mkdirSync(dirname(process.env.VMK_DB), { recursive: true });
if (existsSync(process.env.VMK_DB)) unlinkSync(process.env.VMK_DB);

const { addWord, blockWord, unblockWord, dictionaryEntry } = await import("./dictionary-store.js");
const { dictionaryForPlayers, expandedWords, inRecoveredDictionary, verifyDictionary, wordAt } = await import("./dictionary.js");
const { reEmit } = await import("./chat-tokens.js");

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
};
type Out = Array<{ int: number } | { str: string }>;
const show = (out: Out) => JSON.stringify(out);
const eq = (a: Out, b: Out) => show(a) === show(b);

const base = expandedWords().length;
if (base === 0) {
  console.log("dictionary.smoke: skipped — dictionary_177 not found.");
  process.exit(0);
}
check("recovered dictionary still expands to the wire indices", verifyDictionary().ok);
check("'badges' is a recovered word", inRecoveredDictionary("badges"));
check("a made-up word is not", !inRecoveredDictionary("yeetzz"));

// 1. unknown free text is censored; the recovered word passes as its index
check("unknown text is censored", eq(reEmit([{ kind: "text", text: "yeetzz" }]), [{ int: 1 }, { int: -6 }]));
check("a recovered word passes as its index", eq(reEmit([{ kind: "word", index: 9416, capitalised: false }]), [{ int: 1 }, { int: 9416 }]));

// 2. adding appends exactly one entry after the recovered list
addWord("yeetzz", 1);
check("the added word takes the next index", wordAt(base + 1) === "yeetzz", `got ${wordAt(base + 1)}`);
check("recovered indices do not move", wordAt(9416) === "badges");
check("players' file ends with the word", /, "yeetzz"\]\s*$/.test(dictionaryForPlayers() ?? ""));
check(
  "its index goes out as text (old clients lack it)",
  eq(reEmit([{ kind: "word", index: base + 1, capitalised: true }]), [{ int: 1 }, { int: 0 }, { str: "Yeetzz" }]),
);
check(
  "an old client's free text of it is let through",
  eq(reEmit([{ kind: "text", text: "yeetzz" }]), [{ int: 1 }, { int: 0 }, { str: "yeetzz" }]),
);

// 3. blocking a recovered word censors it, but never for staff
blockWord("badges", 1);
check("a blocked recovered word is censored", eq(reEmit([{ kind: "word", index: 9416, capitalised: false }]), [{ int: 1 }, { int: -6 }]));
check(
  "...but not when censoring is off (staff)",
  eq(reEmit([{ kind: "word", index: 9416, capitalised: false }], { censorUnknown: false }), [{ int: 1 }, { int: 9416 }]),
);
unblockWord("badges", 1);
check("unblocking a recovered word drops its row", dictionaryEntry("badges") === undefined);
check("...and it passes again", eq(reEmit([{ kind: "word", index: 9416, capitalised: false }]), [{ int: 1 }, { int: 9416 }]));

// 4. "removing" an added word blocks it and keeps its place
addWord("zoomies", 1);
blockWord("yeetzz", 1);
check("a blocked added word keeps its index", wordAt(base + 1) === "yeetzz" && wordAt(base + 2) === "zoomies");
check("...and stays in the players' file", (dictionaryForPlayers() ?? "").includes('"yeetzz", "zoomies"]'));
check("its index is censored", eq(reEmit([{ kind: "word", index: base + 1, capitalised: false }]), [{ int: 1 }, { int: -6 }]));
check("its free text is censored again", eq(reEmit([{ kind: "text", text: "yeetzz" }]), [{ int: 1 }, { int: -6 }]));
unblockWord("yeetzz", 1);
check("unblocking an added word keeps its row", dictionaryEntry("yeetzz")?.added === true);

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
