# RallyUp — Project Frames and UI Inventory

This document maps the current RallyUp project screen-by-screen. “Frame” means a distinct visible screen, modal, or state in the app.

## Product summary

RallyUp is a mobile-first pickleball open-play manager. A host creates an open-play lobby, adds players and courts, starts a generated 2v2 match rotation, enters scores, and ends the tournament. Other players can join with a lobby code and password and watch the live dashboard in view-only mode.

The app is a static web app built with vanilla HTML, CSS, and ES modules. Demo data is stored in `localStorage`; tabs sync through `BroadcastChannel` and the browser `storage` event.

## Global visual system

- **Primary brand:** RallyUp
- **Logo treatment:** “Rally” in dark green and “Up” in bright green.
- **Logo asset:** `Logo/Rally Up Logo.png`; the same source is also present under `assets/source/Rally_Up_Logo.png` and exported app icons under `assets/img/`.
- **Author credit:** Chloe Gutierrez.
- **Typography:** Fredoka for headings/brand; Nunito Sans for body copy and controls.
- **Main colors:** dark green `#092F24` / `#073B2D`, bright green `#2DA52F` / `#62D66B`, pale mint `#F1FAEE`, light green `#DFF2D9`, yellow `#FFD84D`, coral `#FF7A59`, muted text `#66738B`.
- **Controls:** pill-shaped buttons, 48px minimum touch targets, visible yellow focus outline, uppercase landing-page buttons on mobile.
- **Cards:** white or pale gray/green cards with rounded corners and light green borders.
- **Responsive behavior:** desktop uses a centered card with two-column layouts; mobile uses a narrow rounded app frame, single-column content, stacked buttons, and horizontally scrollable/overflow-safe tables.

## Frame 0 — Loading screen

**Route:** initial page load before the app renders.

### Visible elements

- Centered animated yellow pickleball SVG with dark outline and holes.
- RallyUp wordmark below the ball.
- Green loading progress bar, initially at 12%.
- Percentage text below the bar.
- White full-screen background.

### Behavior

- The loader is removed visually after approximately 650ms by adding the `done` class.
- The underlying route is then rendered; the default route is the landing page.

## Frame 1 — Landing / welcome page

**Route:** `#/`

### Desktop layout

- Centered white rounded card on a dark charcoal page background.
- Header contains the RallyUp wordmark.
- Left column contains the headline and primary actions.
- Right column contains the RallyUp pickleball mascot/logo image.
- “By: Chloe Gutierrez” appears below the visual.

### Mobile layout

- White rounded app frame with a subtle border and shadow.
- Header shows the large RallyUp wordmark on the left and “By: Chloe Gutierrez” on the right.
- Headline: **“Pickleball open play, shuffled and live.”**
- Supporting copy: **“Host a lobby, shuffle partners, and keep every court moving with one simple dashboard.”**
- Logo/mascot image is centered below the copy.
- Actions are stacked full width.

### Buttons and actions

- **Create Open Play Lobby** — navigates to `#/create`.
- **Join Lobby** — navigates to `#/join`.

### Supporting/marketing content

The landing composition communicates:

- 2v2 matches
- Random partners
- Live dashboard
- Score + leaderboard
- Host controls
- Start, score, end

## Frame 2 — Create open-play lobby

**Route:** `#/create`

- Lobby code (auto-generated, **Regenerate**, **Copy**), password (minimum 4 characters), courts stepper (1–6).
- **Win by 2 / Deuce Rule** toggle. YES: games to 11, win by 2, no timer. NO: games to 11 with no deuce (11–10 wins) and a 15-minute timer per game.
- **Create Lobby & Open Check-In** creates the lobby in the check-in phase and opens the host check-in screen at `#/host/{CODE}`. Players are no longer typed in here.

## Frame 3 — Join lobby

**Route:** `#/join` or `#/join?code={CODE}`

- Lobby code (auto-uppercased) and password. Errors: “Lobby not found.” and “Wrong password.”
- Success opens `#/lobby/{CODE}`.

## Frame 4 — Check-in (host)

**Route:** `#/host/{CODE}` while the lobby is in check-in.

- Share card: lobby code, password, **Copy Invite** (copies a join link with code and password).
- **Add a walk-in player:** name plus the 8-level picker (Beginner, Novice, Low Intermediate, Intermediate, Advanced, Advanced+, Elite, Pro). Duplicate names are rejected.
- Live **Checked in** list with level tags, a level count summary, and × to remove a player.
- Lobby setup: courts stepper and scoring rule.
- Sticky **Start Open Play** button (needs at least 4 players) with a hint showing how many courts will be used. Asks for confirmation.
- Anything being typed is kept when other players check in at the same time.

## Frame 5 — Check-in (player)

**Route:** `#/lobby/{CODE}` while the lobby is in check-in.

- **Check in** form: name and skill level (both required).
- After check-in: “You're checked in, {name}” card with a **Not you?** button, plus the live list of checked-in players.

## Frame 6 — Live dashboard

**Routes:** `#/host/{CODE}` (host) and `#/lobby/{CODE}` (view only).

- Header: lobby code, courts, active players, scoring rule.
- Players who checked in on this device see a personal banner (on court now / up next / matches until their next game).
- Viewers who have not checked in see **Arriving late? Check in here**.
- Tabs: **Courts**, **Matchups**, **Players**, and **Settings** (host only).

### Courts tab

- One card per court. A new match is **READY**: the host taps **Start Match** to begin (and start the timer in no-deuce lobbies). Nothing starts automatically.
- Live match: countdown timer (no-deuce) or elapsed time (deuce), **Enter Score**, **Change Player**. The last minute turns orange. At 0 the card shows **TIME’S UP** and the host gets a toast, sound, and vibration.
- Idle court: “Waiting for players to come off another court” or “No more matchups in the queue.”
- **Up next** preview (next 3 matchups), **View Full Matchup List**, **End Open Play** / **Leave Lobby**, and the live leaderboard (W, L, +/-).

### Matchups tab

On court, Upcoming, and Completed lists with level tags, scores, and the winners highlighted.

### Players tab

Every player with level, games, W-L, and status (Court N / Next #id / Resting / Away). The host can change a level, **Mark Away** / **Bring Back** (players on a live court are protected), and add walk-ins. These changes rebuild only the upcoming matchups.

### Settings tab (host)

Courts stepper, add N matchups / remove the last one, scoring summary, and End Open Play.

## Frame 7 — Change Player (host)

Opened from **Change Player** on a live court.

1. Pick the player to replace (Team A / Team B).
2. Choose **Manual Change** or **Random Change**. Both only use players who are not on a live court.
3. Manual: list of available players, closest skill level first, with games played and their next match.

Result: the incoming player takes the spot on court. The outgoing player takes the incoming player's next upcoming match, so both keep the same number of games. The two names are swapped within that match, which can never create a duplicate.

## Frame 7b — Enter Score (host)

- Available after **Start Match**. Team A / Team B inputs with player names.
- Deuce lobbies: to 11, win by 2 (games past 11 end with a 2-point lead).
- No-deuce lobbies: first to 11 (11–10 is fine, 12–10 is not). After the timer ends, any score with a leader is accepted (for example 8–6). Ties are rejected.
- Saving promotes the next matchup to that court as READY.

## Frame 8 — Final results

**Shown when:** the host ends the tournament and the lobby status becomes ended.

### Visible elements

- RallyUp wordmark.
- **OPEN PLAY ENDED** status pill.
- Eyebrow containing **FINAL RESULTS · {CODE}**.
- Heading: **“Finished Leaderboard”**.
- Supporting copy explaining that rankings are based on completed matches.
- Final leaderboard card.

### Final leaderboard columns

- Rank, including medals for the top three players.
- Player.
- Wins.
- Losses.
- Total points.

Top-three rows receive distinct highlight colors: gold, silver/gray, and bronze/coral.

### Button

- **Back to Main Menu** — navigates to `#/`.

## Toasts, errors, and accessibility behavior

- Toast messages appear at the bottom center and disappear after three seconds.
- Inline validation errors use a coral/dark red color and bold text.
- A visually hidden live region exists for polite announcements.
- Buttons have keyboard-visible focus styles.
- Inputs have green focus borders and yellow focus outlines.
- Reduced-motion users receive disabled CSS animations and transitions.

## Navigation map

```text
#/
├── #/create
│   └── #/host/{CODE}   check-in → live dashboard → final results
└── #/join[?code={CODE}]
    └── #/lobby/{CODE}  check-in → live dashboard (view only) → final results
```

## Core data and behavior

- Lobby: code, password, courts, winByTwo, status (`checkin` | `live` | `ended`), players `[{name, level, active, joinedAt}]`, matches `[{id, status, court, teamA, teamB, scoreA, scoreB, winner, startedAt, endedAt}]`, rev.
- Matchmaking priorities: never double-book a player, equal games for everyone, balanced team strength, similar levels grouped together, fresh partners and opponents.
- When a court frees up and the next matchup needs someone still playing elsewhere, the upcoming queue is rebuilt from the players who are actually free.
- Every change goes through `store.mutate`, which starts from the latest saved lobby and rejects any result that fails `validateLobby`.
- Live ranking: win rate, then point difference per game. Final ranking: win rate, point difference per game, then wins.

## Main project files

- `index.html` — app shell, loader, metadata, font loading, and stylesheet imports.
- `js/main.js` — route selection and initial render.
- `js/app.js` — landing, forms, dashboards, modals, and event handlers.
- `js/logic.js` — skill levels, check-in, matchmaking, substitutions, timers, score rules, stats, validation, and repair (pure functions).
- `js/store.js` — local storage persistence, cross-tab updates, and the validated `mutate` save path.
- `js/results.js` — final leaderboard frame.
- `js/ui.js` — app root, navigation, escaping, and toast helper.
- `css/app.css` — base components, layout, forms, buttons, cards, tables, and modals.
- `css/landing*.css` — landing-page compositions and responsive fixes.
- `css/results.css` — final results styling.
- `Logo/Rally Up Logo.png` — primary mascot/logo image.
- `site.webmanifest` — standalone app metadata and icon references.
- `tests/scoring.test.js`, `tests/lobby.test.js` — score rules, lobby flows, fuzzing, and fairness tests.
- `css/play.css` — check-in, level, court, timer, and change-player styles.

