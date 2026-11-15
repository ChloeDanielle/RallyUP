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

### Header

- RallyUp wordmark.
- **Back** button — returns to `#/`.
- Heading: **“Set up your open play”**.

### Form fields and controls

#### Lobby code

- Automatically generated five-character lobby code.
- **Regenerate** — creates a new code.
- **Copy** — copies the current code to the clipboard and shows a “Copied!” toast when supported.

#### Password

- Required password input.
- Minimum length is four characters.
- Helper text explains that the password is shared with players who want to watch.

#### Add players

- Single player name input, limited to 20 characters.
- **Add** — adds one player.
- Pressing Enter in the player input also adds the player.
- Player names appear as removable chips.
- Each chip has an `×` button to remove that player.
- Multiline textarea accepts names separated by new lines or commas.
- **Add all** — adds every pasted name.
- Duplicate names are rejected with an inline error.
- Player count updates as players are added or removed.

#### Courts

- Current court count starts at 2.
- **−** — reduces courts, with a minimum of 1.
- **+** — increases courts, with a maximum of 6.

#### Submit

- **Start Open Play** — validates the form, creates the lobby, generates matches, stores the lobby, and navigates to the host dashboard at `#/host/{CODE}`.
- At least four players are required.
- The number of players must also be at least four times the selected court count.
- Validation errors appear inside the form.

## Frame 3 — Join lobby

**Route:** `#/join` or `#/join?code={CODE}`

### Header

- RallyUp wordmark.
- **Back** button — returns to `#/`.
- Heading: **“Join a lobby”**.

### Form fields and controls

- **Lobby code** — required, uppercased, maximum five characters.
- **Password** — required password input.
- **Join Lobby** — verifies the lobby code and password, saves the last-used code locally, and navigates to `#/lobby/{CODE}`.
- Inline errors show “Lobby not found” or “Wrong password”.

The lobby code is prefilled from the URL query string when supplied, otherwise from the last lobby saved in local storage.

## Frame 4 — Live dashboard, host view

**Route:** `#/host/{CODE}`

### Header and status

- RallyUp `/ OPEN PLAY` brand line.
- **HOST CONTROLS** status pill.
- Headline: **“Let’s play, everyone.”**
- Lobby code, court count, and player count summary.

### Tabs

- **Courts** — active default view.
- **Matchups** — opens the full matchup list modal/view.

### Courts section

Each live court card shows:

- Court number.
- Match number.
- Team A player names.
- `VS` separator.
- Team B player names.
- **Enter Score** — opens the score submission modal for that match.

### Dashboard actions

- **View Full Matchup List** — opens the matchup list modal.
- **End Tournament** — asks for confirmation, marks the lobby ended, and causes the final-results frame to render. Unfinished matches do not count.

### Leaderboard card

- Heading: **Leaderboard**.
- Supporting line: **“Every player. Every rally.”**
- Columns: rank, player, wins, losses, total points.
- During live play, total points display as an em dash.
- **View Full Leaderboard** — replaces the main dashboard content with the leaderboard.

### Host note

- A muted warning reminds the host not to clear browser data during the game.

## Frame 5 — Live dashboard, viewer view

**Route:** `#/lobby/{CODE}`

This is the same dashboard structure as the host view, but with view-only behavior.

### Differences from host view

- Status pill reads **👀 VIEW ONLY**.
- Headline: **“Watch the rally.”**
- Court cards do not show **Enter Score**.
- **End Tournament** is replaced by **Leave Lobby**.
- **Leave Lobby** returns to the landing page.

The viewer can still switch between Courts and Matchups and view the leaderboard.

## Frame 6 — Full matchup list modal

**Opened from:** Matchups tab or **View Full Matchup List**.

### Visible elements

- Modal overlay with a rounded white panel.
- Heading: **“Full Matchup List”**.
- **Close** button.
- Helper text: **“Upcoming matchups can shift as courts free up.”**
- Rows for every generated match.
- Match number.
- Status pill: Live, Done, or Upcoming.
- Team A vs Team B names.
- Completed match scores when available.

### Close behavior

- **Close** removes the modal.
- Clicking the shaded overlay outside the modal also closes it.

## Frame 7 — Submit score modal

**Opened from:** a host’s **Enter Score** button.

### Visible elements

- Modal title: **“Court {number} — Submit Score”**.
- Current team names and `vs` text.
- Two numeric inputs: Team A and Team B.
- Inline score validation error area.
- **Cancel** — closes without saving.
- **Submit Score** — validates and saves the score.

### Validation rules

- Scores must be whole numbers, non-negative, and different.
- The winner must reach at least 11 points.
- The winner must win by at least 2 points.
- Games above 11 must end with exactly a 2-point lead.

### Submit behavior

- Marks the current match as done.
- Stores both scores and the winner.
- Promotes the next pending match to live on the same court when available.
- Updates the lobby and shows a “Score submitted!” toast.

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
│   └── #/host/{CODE}
│       ├── Matchups modal
│       ├── Submit score modal
│       └── Final results after End Tournament
└── #/join[?code={CODE}]
    └── #/lobby/{CODE}
        └── Matchups modal
```

## Core data and behavior

- Lobby records contain a code, password, players, courts, generated matches, status, revision number, and optional end timestamp.
- Match generation creates 2v2 games while attempting to balance player game counts, partner repetition, and opponent repetition.
- Live rankings sort by wins, then losses, then player name.
- Final rankings sort by wins, point differential, total points, then player name.
- The default planned total is 30 matches.
- The current local adapter is intended for demo use; production Firebase integration is described in `README.md`.

## Main project files

- `index.html` — app shell, loader, metadata, font loading, and stylesheet imports.
- `js/main.js` — route selection and initial render.
- `js/app.js` — landing, forms, dashboards, modals, and event handlers.
- `js/logic.js` — match generation, score validation, stats, ranking, and lobby-code creation.
- `js/store.js` — local storage persistence and cross-tab updates.
- `js/results.js` — final leaderboard frame.
- `js/ui.js` — app root, navigation, escaping, and toast helper.
- `css/app.css` — base components, layout, forms, buttons, cards, tables, and modals.
- `css/landing*.css` — landing-page compositions and responsive fixes.
- `css/results.css` — final results styling.
- `Logo/Rally Up Logo.png` — primary mascot/logo image.
- `site.webmanifest` — standalone app metadata and icon references.
- `tests/scoring.test.js` — score validation tests.

