/**
 * Load test: simulated players against a game server, to find how many players
 * one machine handles before players feel lag.
 *
 * Each bot is a real client session over the game's own protocol: it connects
 * over TCP, declines encryption ("00", as the client may), logs in with a
 * one-shot ticket minted in the database, enters a public room, then walks to
 * a random tile every 3-7 s and says a dictionary word every 8-16 s. Its own
 * chat line comes back to it, and that round trip is the lag a player feels.
 *
 * ⚠ IT CREATES ACCOUNTS (`loadbot1`...) and gives them characters, so it
 * REFUSES to run without `VMK_DB` pointing at a throwaway database. Start a
 * throwaway server on that same database first:
 *
 *   VMK_DB=/tmp/load.db VMK_SHOCKWAVE_PORT=5197 VMK_GAME_PORT=8097 node start.mjs --no-browser
 *   VMK_DB=/tmp/load.db node tools/load-test.mjs --port 8097 --players 200 --seconds 60
 *
 * Options:
 *   --players N     simulated players (default 50)
 *   --seconds N     how long they play once all are connected (default 60)
 *   --port N        the game server's port (default 8097)
 *   --ramp MS       pause between connections (default 20)
 *   --rooms LIST    "code:space,..." to spread players over; a public room
 *                   holds 50 (VMK_ROOM_MAX_USERS) and queues the rest, so
 *                   give at least players/50 rooms (default: 20 rooms)
 *   --probe         one line per message received (use with --players 1)
 *
 * It also samples the game server's CPU and memory with `ps`, found by the
 * port it listens on. Results print every 15 s and at the end as JSON.
 */
import net from "node:net";
import { execFileSync } from "node:child_process";

if (!process.env.VMK_DB || /(^|[/\\])data[/\\]vmk\.db$/.test(process.env.VMK_DB)) {
  console.error("load-test: set VMK_DB to a THROWAWAY database (it creates loadbot accounts). See the header.");
  process.exit(1);
}

const { createUser, getUserByUsername, setCharacter, createTicket } = await import("../server/src/db.ts");
const { MSG, encodeToInt, decodeToInt } = await import("../server/src/vmk-protocol.ts");
const { roomTiles } = await import("../server/src/room-geometry.ts");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const PLAYERS = Number(arg("players", "50"));
const SECONDS = Number(arg("seconds", "60"));
const PORT = Number(arg("port", "8097"));
const RAMP_MS = Number(arg("ramp", "20"));
const PROBE = process.argv.includes("--probe");
const ROOMS = arg(
  "rooms",
  "2:hub2,3:mainstreet_square,4:musical_mainstreet,5:bazaar,6:cambodian,7:tiki,8:indy,9:tent,10:safari,11:dock," +
    "13:castle_dungeon,31:castle_entrance,33:matterhorn,35:castle_courtyard,36:treehouse,38:small_world_shop," +
    "40:storybookland,41:vmk_central,43:emporium,44:horseshoe_shop",
)
  .split(",")
  .map((pair) => {
    const [code, space] = pair.split(":");
    return { code: Number(code), tiles: roomTiles(space).map((t) => t.ref) };
  });

/** Client -> server commands (vmk-protocol.ts `CMD`). */
const CMD = { LOGIN: 10, PUBLIC_KEY: 11, PUBLIC_SPACE_REQUEST: 31, GET_NAME: 510, ROOM_SAY: 560, ROOM_START: 580, ROOM_MOVE: 581 };
const NAMES = new Map(Object.entries(MSG).map(([name, type]) => [type, name]));
/** "badges": a dictionary word, so it is never censored. */
const CHAT_WORD = 9416;
/** ROOM_START draws the avatar from a stored outfit; this is a real one. */
const OUTFIT = JSON.stringify({ sex: 0, figure: [20002, 5, 22001, 16, 24188, 1, 26037, 1, 48016, 160, 41043, 194], guestRoomStyle: 67 });

/* ---- wire: client -> server is a 3-char length, a 2-char command, params */
const char6 = (n) => String.fromCharCode(64 | (n & 63));
const wireString = (s) => encodeToInt(s.length) + s;
function frame(command, params = "") {
  const body = char6(command >> 6) + char6(command) + params;
  return Buffer.from(char6(body.length >> 12) + char6(body.length >> 6) + char6(body.length) + body, "latin1");
}

/* ---- results */
const stats = { connected: 0, loggedIn: 0, inRoom: 0, closed: 0, errors: 0, msgsIn: 0, bytesIn: 0, chatSent: 0, chatEcho: 0, moves: 0 };
const loginMs = [];
const roomMs = [];
const chatRtt = [];
const percentile = (list, p) => {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
};

function bot(i) {
  const name = `loadbot${i}`;
  const user = getUserByUsername(name) ?? createUser(name, `${Math.random()}${Math.random()}`);
  setCharacter(user.id, `Bot${i}`, OUTFIT);
  const ticket = createTicket(user.id);
  const room = ROOMS[i % ROOMS.length];
  const started = Date.now();
  const timers = [];
  let buffer = "";
  let loggedAt = 0;
  let inRoom = false;
  let chatSentAt = 0;

  const socket = net.connect(PORT, "127.0.0.1");
  socket.setNoDelay(true);
  const send = (bytes) => socket.destroyed || socket.write(bytes);
  socket.on("connect", () => stats.connected++);
  socket.on("error", () => stats.errors++);
  socket.on("close", () => {
    stats.closed++;
    timers.forEach(clearTimeout);
  });
  // Server -> client: a 2-char type, the body, then \x01.
  socket.on("data", (chunk) => {
    stats.bytesIn += chunk.length;
    buffer += chunk.toString("latin1");
    for (let end; (end = buffer.indexOf("\x01")) >= 0; ) {
      const message = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (message.length < 2) continue;
      const type = ((message.charCodeAt(0) & 63) << 6) | (message.charCodeAt(1) & 63);
      stats.msgsIn++;
      if (PROBE) console.log(`  <- ${type} ${NAMES.get(type) ?? "?"} (${message.length - 2}b) +${Date.now() - started}ms`);
      receive(type, message.slice(2));
    }
  });

  function receive(type, body) {
    if (type === MSG.CONNECTION_READY) send(frame(CMD.PUBLIC_KEY, wireString("00")));
    else if (type === MSG.HELLO) send(frame(CMD.LOGIN, wireString(name) + wireString(ticket) + wireString("load-test")));
    else if (type === MSG.REMOVE_LOGIN_WINDOW && !loggedAt) {
      loggedAt = Date.now();
      stats.loggedIn++;
      loginMs.push(loggedAt - started);
      send(frame(CMD.GET_NAME));
      send(frame(CMD.PUBLIC_SPACE_REQUEST, encodeToInt(room.code)));
    } else if (type === MSG.ENTER_ROOM) {
      // The real client loads the room's art here, then says it is ready.
      send(frame(CMD.ROOM_START));
    } else if (type === MSG.CREATE_AVATARS && loggedAt && !inRoom) {
      inRoom = true;
      stats.inRoom++;
      roomMs.push(Date.now() - loggedAt);
      play();
    } else if (type === MSG.AVATAR_CHAT && chatSentAt && decodeToInt(body, 0).value === user.id) {
      chatRtt.push(Date.now() - chatSentAt);
      chatSentAt = 0;
      stats.chatEcho++;
    }
  }

  function play() {
    const walk = () => {
      if (room.tiles.length) {
        send(frame(CMD.ROOM_MOVE, encodeToInt(room.tiles[Math.floor(Math.random() * room.tiles.length)])));
        stats.moves++;
      }
      timers.push(setTimeout(walk, 3000 + Math.random() * 4000));
    };
    const chat = () => {
      chatSentAt = Date.now();
      stats.chatSent++;
      send(frame(CMD.ROOM_SAY, encodeToInt(CHAT_WORD)));
      timers.push(setTimeout(chat, 8000 + Math.random() * 8000));
    };
    timers.push(setTimeout(walk, Math.random() * 3000), setTimeout(chat, 2000 + Math.random() * 6000));
  }
  return socket;
}

/* ---- the game server's CPU and memory, by the port it listens on */
const samples = [];
let serverPid = null;
try {
  serverPid = execFileSync("lsof", ["-tiTCP:" + PORT, "-sTCP:LISTEN"], { encoding: "utf8" }).trim().split("\n")[0] || null;
} catch {
  // No lsof (or nothing listening): run without server figures.
}
const sampler = serverPid
  ? setInterval(() => {
      try {
        const [cpu, rss] = execFileSync("ps", ["-o", "%cpu=,rss=", "-p", serverPid], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
        samples.push({ cpu, mb: rss / 1024 });
      } catch {}
    }, 1000)
  : null;

const sockets = [];
for (let i = 1; i <= PLAYERS; i++) {
  sockets.push(bot(i));
  await new Promise((r) => setTimeout(r, RAMP_MS));
}
const rampedAt = samples.length;

function report() {
  // Server CPU after everyone has connected: the joining burst is not steady play.
  const steady = samples.slice(rampedAt);
  const server = steady.length
    ? {
        cpuAvgPct: Math.round(steady.reduce((a, s) => a + s.cpu, 0) / steady.length),
        cpuMaxPct: Math.round(Math.max(...steady.map((s) => s.cpu))),
        memPeakMb: Math.round(Math.max(...samples.map((s) => s.mb))),
      }
    : null;
  console.log(
    JSON.stringify({
      players: PLAYERS,
      ...stats,
      loginMs: { p50: percentile(loginMs, 50), p95: percentile(loginMs, 95) },
      roomMs: { p50: percentile(roomMs, 50), p95: percentile(roomMs, 95) },
      chatRttMs: { n: chatRtt.length, p50: percentile(chatRtt, 50), p95: percentile(chatRtt, 95), max: percentile(chatRtt, 100) },
      mbReceived: +(stats.bytesIn / 1048576).toFixed(1),
      server,
    }),
  );
}
const ticker = setInterval(report, 15000);
await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(ticker);
if (sampler) clearInterval(sampler);
report();
sockets.forEach((s) => s.destroy());
setTimeout(() => process.exit(0), 300);
