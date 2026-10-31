# Rebuilding the 2007–2008 VMK website

A research-backed plan for putting a faithful copy of Disney's Virtual Magic Kingdom website in front of an OpenVMK server, written to be carried out with Claude Code one phase at a time.

Research date: 2026-10-31. Sources are listed at the end; "CDX" means the Wayback Machine's capture index.

---

## 1. What the original site was

**Where it lived.** In 2007–2008 the site was `http://vmk.disney.go.com/vmk/en_US/`; `vmk.com` pointed at the same pages. Three roots appear in every page's JavaScript:

| Variable | Value | Role |
| --- | --- | --- |
| `strWebRoot` | `http://vmk.disney.go.com/vmk/en_US/` | pages |
| `strSecureWebRoot` | `https://secure.disney.go.com/vmk/en_US/` | most likely sign-in and registration (not confirmed) |
| `strMediaRoot` | `http://avmk.disney.go.com/avmk_v0300/en_US/media/` | images, Flash, PDFs |

The game itself used other hosts (`www2.virtualmagickingdom.com/homepage/download/…` for data files, `admin.virtualmagickingdom.com/housekeeping/…` for staff tools), which OpenVMK already emulates. See `assets/external_variables_931.txt`.

**How pages were built.** Each page was an XHTML 1.0 Transitional shell from a Java servlet stack (Disney's Tea templates on Tomcat, according to a former developer's CV). One router served nearly everything:

```
/vmk/en_US/<section>/index?name=<PageName>[&topic=…&attractionName=…&park=…]
```

Sections: `aboutVMK`, `WhatIsVMK`, `community`, `parks`, `help`, `quests`, `calendar`, `SiteMap`, `search`, `register`. The homepage is `/vmk/en_US/index?name=VMKHomePage`.

**What a page looked like (11 January 2008 homepage).**

- **Disney.com bar on top:** `div#Chrome` loads `disney.go.com/globalmedia/chrome/chrome.js` with `chromeColor = #003399` and `chromeWidth = 1001`.
- **Flash body:** `div#main` contains one script tag, `/_lib/flashHeaderExt?pageName=VMKHomePage&name=homeMedia`, which `document.write()`s `_Index.swf` at **1001 × 1380**. The movie gets `indexXML=…/xml/homeXML`, `chatXML`, `mp3XML` and `headerType=vmk`.
- **Four HTML blurbs below the Flash:** `#global_footer.home_footer > #standard_content > ul`, one item each for What, Why, Safe and Help, with icons `sc_what.gif`, `sc_why.gif`, `sc_safe.gif` and `sc_help.gif`.
- **Black legal footer:** `div#DOLFooter` loads `legalfooter.js` with three extra links: VMK.com Site Map, Contact Us and VMK Values.
- **Other details:** an RSS link to `/rss/rssFeed?feed=NewsletterRSS`, sIFR (`sifr.js`) for Flash-rendered headings, and HitBox and AvenueA trackers (drop both).

Other pages used `flashHeaderExt?…&name=compositeHeader&headerType=vmk|parks` for a Flash banner, with HTML content below it. News headings came from `newsTitles.swf` (250 × 30) through `writeNewsTitleFlash?myTitle=…`.

**Page inventory.** CDX lists about 363 distinct HTML pages from 2007–2008. Grouped:

| Group | Pages |
| --- | --- |
| Home | `VMKHomePage` |
| About | `AboutVMKPage`, `ForParentsPage`, `GamePreviewPage`, `DeveloperCreditsPage`, `VMKInParksPage`, `cards?name=VMKCardPage` |
| Help & safety | `HelpLandingPage`, `GameGuidePage`, `GameHelpFAQTopPage` (23 `&topic=` groups, including `FAQVMKClosing`), `GameHelpSecretCodesPage`, `HouseRulesPage`, `EULAPage`, `SafetyPage`, `SafetyVMKValuesPage`, `SafetyVMKWayPage`, `SystemRequirementsPage` |
| Community | `NewsletterPage`, `DownloadsPage`, `AwardsAndTopPlayersPage`, 8 × `HighScores*Page` |
| Quests | `QuestsLandingPage`, `QuestsPrizesPage`, `QuestsPage&park=Disneyland / WaltDisneyWorld` |
| Parks | `WDWLandingPage`, `DisneylandLandingPage`, ~50 `Attractions&attractionName=…`, `VideoGalleryPage`, `VideoMashupPage` |
| Other | `calendar/index?name=CalendarPage`, `SiteMapPage`, `search/index?name=SearchPage`, `alertWindow?name=BrowserWarnPage`, error pages (404/500) |

**The closure.** Disney announced the closure around 7 April 2008 and shut the game down on 21 May 2008. Archived states:

- **Normal:** January 2008.
- **Pre-closure:** April–May 2008. Adds an "Important Message" news title (captured 2008-04-13) and the `FAQVMKClosing` FAQ topic (captured 2008-04-11).
- **Post-closure:** June–November 2008. Same HTML shell, but the four blurbs are gone; the notice itself was in the Flash, which read `homeXML`. From September 2008 the page embeds `_Index.swf` directly through `FlashObj`. Root captures redirect (301) from December 2008.

## 2. What survives in the Wayback Machine

Checked 2026-10-31 with CDX queries (status 200, one row per distinct URL):

| What | Count | Notes |
| --- | --- | --- |
| HTML pages, `vmk.disney.go.com/vmk/en_US/*` (2005–2008) | 951 | 383 from 2005, 311 from 2006, 221 from 2007, 36 from 2008 |
| `_lib/` stylesheets | 20 | `global.css`, `home.css`, `help.css`, `community.css`, `quests.css`, `register.css`, `ie6.css`, `landing_page.css`, `inpark_quests.css`, `sIFR-*.css`, … |
| `_lib/` JavaScript | 14 | `global.js`, `browserDetect.js`, `sifr.js`, `faq.js`, `calendar.js`, `readmore.js`, `styles.js`, … |
| `_lib/` dynamic HTML (Flash writers) | 88 | `flashHeaderExt`, `flashAttraction`, `flashGallery`, `writeNewsTitleFlash`, `musicPlayerPop` |
| Media host `avmk.disney.go.com` | 730 | 380 GIF, 297 JPEG, 16 PDF, 5 SWF (including `_Index.swf`, 329 KB, captured 2006-11-11), navigation sprites under `global/nav_*` |
| Disney chrome `disney.go.com/globalmedia/*` | 285 | `chrome.js`, `globalHNC.js`, `legalfooter.js`, logo GIFs |

**What is missing.** `xml/homeXML` was never archived (only 404s and 301s exist), and neither were `chat.xml` and `listMP3.xml`. So `_Index.swf` survives but **its content does not**: the homepage news, featured items and the closure notice have to be rewritten from fan sources. Also unarchived: the real login and registration pages (2008 captures of `register/index?name=LoginPage` and `signin` are Disney's 500/404 pages) and the post-closure notice wording.

**Best reference captures** (add `id_` after the timestamp to get the raw file):

- Homepage, normal: `https://web.archive.org/web/20080111103240id_/http://vmk.disney.go.com:80/vmk/en_US/index?name=VMKHomePage`
- Homepage, closing day: `https://web.archive.org/web/20080521033643id_/http://vmk.disney.go.com/vmk/en_US/`
- Homepage, post-closure (FlashObj variant): `https://web.archive.org/web/20080913151308id_/http://vmk.disney.go.com/vmk/en_US/`
- Error template: `https://web.archive.org/web/20080805200454id_/http://vmk.disney.go.com:80/vmk/en_US/signin`
- Full page list: `https://web.archive.org/cdx/search/cdx?url=vmk.disney.go.com/vmk/en_US/*&from=2007&to=2008&collapse=urlkey&filter=statuscode:200&filter=mimetype:text/html`

## 3. Decisions to make before building

1. **Art and markup (legal).** No research finding established that reproducing Disney's markup, chrome, logos or SWFs is permitted. Options:
   - **(a) Fetch on install.** A tool downloads the archived files to a git-ignored folder on each server. Nothing Disney-made is committed; this mirrors how the repo treats the original `.dcr`/`.cct` files. **(Recommended.)**
   - **(b) Commit the files**, the way `client/assets` already ships game art. Simplest, most exposure.
   - **(c) Lookalike.** Same layout and colours, original art and wording. No Disney files at all.

   Whichever is chosen, keep the existing non-affiliation disclaimer on every page, and get advice before running it publicly.
2. **Flash.** Either render the original SWFs with **Ruffle** (self-hosted WebAssembly Flash emulator, `@ruffle-rs/ruffle` on npm), or rebuild the Flash areas in HTML/CSS from screenshots. Recommended: Ruffle for headers and news titles; for `_Index.swf`, try Ruffle first and fall back to HTML if writing a replacement `homeXML` is impractical.
3. **Which period.** Recommended: the January 2008 site as the default, with the pre-closure and post-closure versions as optional settings (§4, phase 7).
4. **Which address.** Recommended: serve the site at `/` (replacing today's plain login card) and under the original `/vmk/en_US/…` paths, so archived links resolve unchanged. `/play`, `/client`, `/hk` and `/logout` keep working as they do now.

## 4. Build phases

Each phase lists the files it touches and a check that proves it is done. Phases 2 and 3 can run in parallel once phase 1 has produced the archive; phases 5a–5e are independent of each other.

### Phase 1: archive harvester

- **New** `tools/fetch-vmk-site.mjs`, modelled on the existing `tools/*.mjs` scripts:
  - Queries CDX for the four host patterns in §2, picks the best 2007–2008 capture of each URL (latest status-200 capture before 2008-04-07 for the normal state), and downloads it in `id_` (raw) mode.
  - Writes to `site-archive/` (git-ignored) as `site-archive/<host>/<path>`, with query strings encoded into the file name.
  - Writes `site-archive/manifest.json` mapping each original URL to its capture time, content type and local file.
  - Stays polite to the archive: at most 2 requests at a time, retries with back-off, and can resume.
  - `--state=normal|preclosure|postclosure` picks the date window.
- **Edit** `.gitignore` to add `site-archive/`.
- **Done when** the manifest holds at least 300 HTML pages, all 20 stylesheets, all 14 scripts, at least 600 images and `_Index.swf`, and a second run downloads nothing new.

### Phase 2: rewrite pages for local serving

- **New** `tools/build-vmk-site.mjs`: turns `site-archive/` into a servable `site-dist/` (git-ignored). For each page:
  - Rewrites the three roots, `disney.go.com/globalmedia/…` and `vmk.com` to same-origin paths: `/vmk/en_US/…`, `/avmk/…` and `/globalmedia/…`.
  - Removes HitBox (`hbx.js` and its config block), `switch.atdmt.com` pixels and any other off-site trackers.
  - Strips Wayback's own markup if any slipped through `id_` mode.
  - Turns the `_lib/flashHeaderExt`, `flashAttraction`, `flashGallery` and `writeNewsTitleFlash` responses into static `.js` files keyed by their query string.
  - Points the `register`, `signin` and login links at OpenVMK's sign-in (phase 4).
- **Done when** a grep of `site-dist/` finds no `web.archive.org`, `hitbox`, `atdmt` or `disney.go.com` left in any URL.

### Phase 3: serve the site from the web server

- **New** `server/src/site.ts`, exporting `handleSiteRequest(req, res, url): boolean`, in the same style as `hk.ts`'s `pathname.startsWith("/hk")` gate:
  - Maps `/vmk/en_US/<section>/index?name=X&…` to the matching file in `site-dist/`; the router's query string is the key.
  - Serves `/avmk/*` and `/globalmedia/*` as static files with long cache lifetimes.
  - Serves the archived error template for unknown pages.
  - Does nothing when `site-dist/` is missing, so a fresh clone behaves exactly as today.
- **Edit** `server/src/assets.ts`: call `handleSiteRequest` near the top of the route table, before the `/` and `/login` branch at about line 1578. When the site is present, `GET /` serves the homepage (signed in or not), and the current login card moves to `/login`.
- **Edit** `docs/SELF-HOSTING.md` to add a `VMK_SITE` setting (`on`/`off`, default `on` when `site-dist/` exists).
- **Done when** `http://127.0.0.1:5199/` shows the January 2008 homepage shell with Disney's blue bar and black footer drawn by the local chrome scripts, and no request leaves 127.0.0.1 (check the browser pane's network list).

### Phase 4: sign-in, sign-up and Play

How Disney's site handed a login to the Shockwave client is **not known** (the research refuted every specific claim). Design it on top of what OpenVMK already has:

- **New** an original-styled sign-in page at `/vmk/en_US/register/index?name=LoginPage`. Base it on `register.css` (archived 2005-05-26) and the help-page layout. It POSTs to the existing `/auth` with the existing `next` field, so the rate limits, account creation and the "first account becomes admin" rule all stay in one place (`handleAuthPost` in `assets.ts`).
- Make `/auth` failure redirects go back to whichever page the form came from. Today they always go to `/?error=…`; add a `from` field checked with `safeNext`.
- **Play button:** every "Play"/"Enter VMK" link and the Flash movie's play click lead to `/play` (or `/client` for the real plugin). Signed-out players go through sign-in first, which `/play` already enforces.
- **Signed-in header:** a small `GET /vmk/en_US/_lib/session.js` endpoint sets `window.vmkUser = {name}` or `null`, so the page can show "Hi, Ryan · Play · Sign out" without each page being rendered on the server.
- **Browser check:** replace the old Shockwave check (`browserDetect.js`, `alertWindow?name=BrowserWarnPage`) with a no-op. The browser client needs no plugin.
- **Done when** a new browser can sign up from the reproduced site, land in the game and come back signed in; a wrong password shows the error on the reproduced page; and the existing smoke tests pass (`npm test`).

### Phase 5: page groups (can run in parallel)

Each group: confirm every page in its manifest renders with its own CSS and images; fix broken assets by trying another capture time; take a screenshot next to the Wayback copy and compare by eye in the browser pane.

- **5a Home.** `_Index.swf` under Ruffle at 1001 × 1380. Decompile it with JPEXS FFDec to read the `homeXML`, `chat.xml` and `listMP3.xml` formats, then write replacement files from fan copies of the January 2008 news (VMK Legacy, the vmkears newsletter reposts). If the movie will not run, rebuild the homepage panels in HTML from period screenshots. Then the four HTML blurbs.
- **5b Help & safety.** 10 pages and the 23 FAQ topics. Mostly HTML; the content can be taken almost word for word.
- **5c About & parents.** 6 pages, plus the VMK card flip (`flipCard.js`, `vmkcardsstyle.css`).
- **5d Community.** Newsletter, downloads (the 16 PDFs and wallpapers), awards. The high-score pages become **live**: fed from OpenVMK's mini-game results in SQLite through a small `/vmk/en_US/community/highscores.json`, keeping the original table markup.
- **5e Quests, calendar, parks.** About 50 attraction pages (Ruffle for `flashAttraction`), the calendar (`calendar.js`), quests landing and prizes.
- **Done when** every manifest page returns 200, shows no broken images, and its screenshot matches the Wayback copy in layout, colours and fonts.

### Phase 6: news that staff can edit (the "CMS")

The real site had staff publishing content daily through an internal CMS. Rebuild that part as a feature of OpenVMK rather than copying it:

- **New table** `site_news (id, title, body_html, published_at, author_id)`, added in `server/src/db.ts` the same way other tables are created there.
- **New `/hk` page** "Website news": create, edit and publish, behind a new permission or the existing admin check (`isAdmin` in `hk.ts`).
- **Feeds:** the homepage `homeXML` (or its HTML stand-in) and `/vmk/en_US/rss/rssFeed?feed=NewsletterRSS` are generated from this table, so the original RSS URL works again.
- **Done when** a post written in `/hk` appears on the homepage and in the RSS feed without a restart.

### Phase 7 (optional): closure-era versions

`VMK_SITE_STATE=normal|preclosure|postclosure` chooses which harvest `build-vmk-site.mjs` uses:

- **preclosure:** adds the "Important Message" news and `FAQVMKClosing`.
- **postclosure:** the shell without the blurbs and with a notice. The wording is not archived; write it from secondary sources and label it as a reconstruction.

### Phase 8: verification and release

- A smoke test in `server/src/` that boots the web server with a fixture `site-dist/` and checks the homepage, one page per section, sign-in, the 404 template, and that no tracker or off-site URL appears.
- Check the release build (`docs/RELEASING.md`) either includes `site-dist/` or documents running the two tools after unzipping. Depends on decision 1.
- Update `README.md` (Running from source) and `docs/SELF-HOSTING.md`.

## 5. Running it with Claude Code

- **Order.** Phase 1 → (2 ‖ 3) → 4 → (5a ‖ 5b ‖ 5c ‖ 5d ‖ 5e) → 6 → 7 → 8. Start each phase in a fresh session pointed at this file and the phase number. Give the parallel ones their own worktree sessions, because they touch different files.
- **Inputs to hand each session.** This document, the phase's "Done when", and `site-archive/manifest.json` once it exists.
- **Checking visually.** Run the server with `VMK_GAME_PORT=8081 node start.mjs --no-browser` (Docker holds port 8080 on this machine). Open the rebuilt page and the Wayback copy side by side in the browser pane, and screenshot both.
- **Reviews.** Run `/code-review` on phases 3, 4 and 6: they touch sign-in, sessions and a database table.
- **The archive.** Keep the harvester's requests slow; the Wayback Machine rate-limits and was intermittently unreachable during research. Each request is cached in `site-archive/` and never repeated.

## 6. Open questions and risks

| Question | Effect | How to settle it |
| --- | --- | --- |
| The `homeXML` format and the January 2008 homepage content | The homepage's main panel | Decompile `_Index.swf` (phase 5a); fan newsletter reposts |
| Whether `_Index.swf` (2006 capture) and the header SWFs run in Ruffle | Flash vs HTML stand-ins | Try in phase 5a; Ruffle's ActionScript 2 support is good, but external XML loading needs testing |
| The real sign-in and registration pages | Phase 4 is a design, not a copy | Look for earlier captures (`register/newLogin` 2007-01-02, `beta/login` 2005-05-18) |
| The post-closure notice wording | Phase 7 accuracy | It was inside the Flash; no capture found |
| Copyright and trademark | Decision 1 | Legal advice; nothing confirmed in research |
| Single-capture evidence | Some details may not hold for all of 2007 | Phase 1 harvests several dates per page |

**Refuted during research (do not build on these):** a fixed set of login endpoints; any homepage message saying Disney had "no plans to reopen it in any form"; pin images at `/media/pins/<id>.jpg`; the site handing login to the client through external_texts/external_variables files over HTTP.

## 7. Sources

Primary:
- Homepage capture, 11 January 2008: https://web.archive.org/web/20080111103240id_/http://vmk.disney.go.com:80/vmk/en_US/index?name=VMKHomePage
- CDX page list, 2007–2008: https://web.archive.org/cdx/search/cdx?url=vmk.disney.go.com/vmk/en_US/*&from=2007&to=2008&collapse=urlkey&filter=statuscode:200&filter=mimetype:text/html
- CDX `_lib/` (CSS, JS, Flash writers): https://web.archive.org/cdx/search/cdx?url=vmk.disney.go.com/vmk/en_US/_lib/*&from=2005&to=2008&collapse=urlkey
- CDX media host: https://web.archive.org/cdx/search/cdx?url=avmk.disney.go.com/*&from=2005&to=2008&collapse=urlkey&filter=statuscode:200
- Root captures through the closure: https://web.archive.org/cdx/search/cdx?url=vmk.disney.go.com/vmk/en_US/&from=2008&to=2009

Secondary:
- Engadget, closure announced (9 April 2008): https://www.engadget.com/2008-04-09-virtual-magic-kingdom-comes-to-an-end.html
- Engadget, closing day (21 May 2008): https://www.engadget.com/2008-05-21-disney-set-to-close-virtual-magic-kingdom-today.html
- Wikipedia: https://en.wikipedia.org/wiki/Virtual_Magic_Kingdom
- StrategyWiki: https://strategywiki.org/wiki/Virtual_Magic_Kingdom
- Theme Park Insider (July 2005, registration and FAQs): https://www.themeparkinsider.com/columns/joeinsider/240.cfm
- VMK Legacy, staff and history (tech stack, CMS, Flash homepage credits): https://www.vmklegacy.com/kb/page/original-vmk/vmk-staff
- Gregory Cowley portfolio (Flash work): https://gregorycowley.com/projects/disneyvmk
- Newsletter repost with original asset URLs: https://vmkears.createmybb.com/printthread.php?tid=165
- Laughing Place on VMK Revisited: https://www.laughingplace.com/w/articles/2016/06/08/virtual-magic-kingdom-lost-park/
