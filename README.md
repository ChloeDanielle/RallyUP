# RallyUp

RallyUp is a mobile-first pickleball open-play manager built with vanilla HTML, CSS, and ES modules. The included demo mode stores lobbies in `localStorage` and syncs tabs with `BroadcastChannel`, so it runs without credentials.

## Run locally

Run `npm run dev`, then open `http://localhost:5173`. The project includes a dependency-free local server. Do not use `file://` because ES modules require a server.

Create a lobby, then open a second tab, join with the lobby code and password, and check in with a name and skill level. The host can also add walk-in players. Start open play once at least four players have checked in.

## How open play works

- **Self check-in:** players join with the code and password and pick one of eight skill levels: Beginner, Novice, Low Intermediate, Intermediate, Advanced, Advanced+, Elite, Pro. Late arrivals can check in during play and join the upcoming matchups.
- **Balanced matchmaking:** everyone gets the same number of games first. Then teams are balanced by level (for example Beginner & Low Intermediate vs Beginner & Low Intermediate), players of similar level are grouped, and repeat partners and opponents are avoided.
- **Courts:** after the lobby starts, each court shows **Start Match**. Nothing is timed until the host taps it.
- **Timer:** lobbies with the deuce rule turned off use a 15-minute timer per game. Games go to 11 with no deuce. When time runs out, the court shows TIME'S UP and the host enters the current score; the leading team wins.
- **Change Player:** tap a player on a live court, then choose **Manual Change** (pick from players not on a live court) or **Random Change**. The incoming player's next upcoming match is handed to the outgoing player, so both keep the same number of games.
- **Safety:** every change is checked before it is saved. A lineup with the same player twice, or a player on two courts, is never stored. Lobbies damaged by older versions are repaired when opened.

## Firebase production path

The local adapter is intentionally the default in this build. To connect production Firebase, replace the adapter in `js/store.js` with a Firebase implementation using the modular CDN SDK, enable Firestore and Anonymous sign-in in Firebase Console, paste the web app keys, deploy `firestore.rules`, and configure Hosting. Add a Firestore TTL policy for `expireAt`. This password is a casual access gate for a scores app, not bank-level security.

## Tests

Run `npm test`. It covers score rules, check-in, substitutions, skill balancing, court and matchup settings, repair of damaged lobbies, 300 randomized full sessions, and game-count fairness.
