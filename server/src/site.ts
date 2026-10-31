/**
 * The player website: the home page, Register and Sign in.
 *
 * A look-alike of the 2007 VMK site (docs/VMK-WEBSITE-PLAN.md), drawn fresh:
 * the pages are plain HTML templates in server/public/site, filled here.
 *
 *   {{key}}            text, HTML-escaped
 *   <!--key-->         a fragment built here (already escaped)
 *   <!--if:in-->…<!--/if:in-->, <!--if:out-->…<!--/if:out-->
 *                      kept for a signed-in / signed-out visitor, dropped otherwise
 *
 * The routes and the form handlers (rate limits, sessions) stay in assets.ts
 * with the rest of sign-in; this file only renders.
 */
import type { ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import {
  countPins,
  getFeaturedGuestRooms,
  getFriends,
  getRoomsOwnedBy,
  getUserById,
  userCreatedAt,
  type User,
} from "./db.js";
import { onlinePlayerIds } from "./hk.js";
import { ROOT } from "./paths.js";

const SITE = join(ROOT, "server", "public", "site");

const TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function fill(
  template: string,
  signedIn: boolean,
  text: Record<string, string>,
  html: Record<string, string> = {},
): string {
  const keep = signedIn ? "in" : "out";
  const drop = signedIn ? "out" : "in";
  return template
    .replace(new RegExp(`<!--if:${drop}-->[\\s\\S]*?<!--/if:${drop}-->\\n?`, "g"), "")
    .replace(new RegExp(`<!--/?if:${keep}-->\\n?`, "g"), "")
    .replace(/<!--(\w+)-->/g, (_, key: string) => html[key] ?? "")
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(text[key] ?? ""));
}

const template = (name: string) => readFileSync(join(SITE, name), "utf8");
const count = (n: number) => n.toLocaleString("en-US");

/** `/site/*`: the website's stylesheet and fonts. */
export function serveSiteFile(res: ServerResponse, pathname: string): boolean {
  const file = normalize(join(SITE, pathname.slice("/site/".length)));
  const type = TYPES[extname(file)];
  if (!type || !file.startsWith(SITE) || !existsSync(file) || !statSync(file).isFile()) return false;
  res.writeHead(200, {
    "Content-Type": type,
    // Fonts never change under a name; the stylesheet may, between releases.
    "Cache-Control": extname(file) === ".woff2" ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(readFileSync(file));
  return true;
}

/** A player's public name: the avatar's, never the login name once there is one. */
function shownName(user: User): string {
  return user.has_character && user.character_name ? user.character_name : user.username;
}

function onlineLine(online: number[] | null): string {
  if (online === null) return "The game server is offline right now";
  if (online.length === 0) return "The Kingdom is quiet right now";
  return `<strong>${count(online.length)}</strong> ${online.length === 1 ? "player" : "players"} in the Kingdom now`;
}

const ROOM_ICON =
  '<div class="room-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2BEEFF" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>' +
  '<path d="M10 20v-6h4v6"/></svg></div>';

/** Staff-featured guest rooms (the in-game `/feature`): the old "Room of the week". */
function featuredRooms(): string {
  const rooms = getFeaturedGuestRooms().slice(0, 5);
  if (rooms.length === 0) return `<p class="empty">Staff haven't featured any guest rooms yet.</p>`;
  const rows = rooms.map((room) => {
    const owner = getUserById(room.ownerId);
    // An owner who never finished registration has no public name to show.
    const by = owner?.has_character && owner.character_name ? `<p class="owner">by ${escapeHtml(owner.character_name)}</p>` : "";
    return (
      `<li class="room-row">${ROOM_ICON}<div><p class="label">Featured room</p>` +
      `<p class="name">${escapeHtml(room.name)}</p>${by}</div></li>`
    );
  });
  return `<ul>${rows.join("")}</ul>`;
}

export async function renderHome(user: User | undefined): Promise<string> {
  const online = await onlinePlayerIds();
  const html: Record<string, string> = { online: onlineLine(online), featured: featuredRooms() };
  const text: Record<string, string> = {};

  if (user) {
    const name = shownName(user);
    const live = new Set(online ?? []);
    const created = userCreatedAt(user.id);
    const rooms = getRoomsOwnedBy(user.id);
    text.name = name;
    text.initial = name.charAt(0).toUpperCase();
    text.welcome = user.has_character
      ? "Your room, your pins and your friends are right where you left them."
      : "Press Play to design your avatar and step into the Kingdom.";
    text.since = created
      ? `Playing since ${new Date(created).toLocaleString("en-US", { month: "long", year: "numeric" })}`
      : "";
    text.credits = count(user.credits);
    text.pins = count(countPins(user.id));
    text.friendsOnline = online === null ? "–" : count(getFriends(user.id).filter((f) => live.has(f.id)).length);
    html.myRooms =
      rooms.length === 0
        ? `<li class="none">No guest rooms yet.</li>`
        : rooms.map((r) => `<li>${escapeHtml(r.name)}</li>`).join("");
    html.staffLink = user.permissions.length > 0 ? `          <a class="staff" href="/hk">Housekeeping</a>\n` : "";
    html.mainClass = "signed-in";
  }
  return fill(template("home.html"), user !== undefined, text, html);
}

const ALERT_ICON =
  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AA0000" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>';

/**
 * Register or Sign in. `next` must already have passed `safeNext`; `username`
 * refills the form after a failed attempt (never the password).
 */
export function renderAuthPage(
  page: "login" | "register",
  options: { error?: string | null; next?: string | null; username?: string } = {},
): string {
  const { error, next, username = "" } = options;
  return fill(
    template(`${page}.html`),
    false,
    { username },
    {
      error: error ? `    <div class="alert" role="alert">${ALERT_ICON}<p>${escapeHtml(error)}</p></div>` : "",
      next: next ? `    <input type="hidden" name="next" value="${escapeHtml(next)}">` : "",
      nextQuery: next ? `?next=${escapeHtml(encodeURIComponent(next))}` : "",
    },
  );
}
