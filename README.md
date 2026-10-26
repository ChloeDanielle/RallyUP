# RallyUp

RallyUp is a mobile-first pickleball open-play manager built with vanilla HTML, CSS, and ES modules. The included demo mode stores lobbies in `localStorage` and syncs tabs with `BroadcastChannel`, so it runs without credentials.

## Run locally

Serve this folder with any static server, for example `npx serve .`, then open the displayed URL. Do not use `file://` because ES modules require a server.

Create a lobby with at least four players, open a second tab, and join with the lobby code and password to preview the viewer flow.

## Firebase production path

The local adapter is intentionally the default in this build. To connect production Firebase, replace the adapter in `js/store.js` with a Firebase implementation using the modular CDN SDK, enable Firestore and Anonymous sign-in in Firebase Console, paste the web app keys, deploy `firestore.rules`, and configure Hosting. Add a Firestore TTL policy for `expireAt`. This password is a casual access gate for a scores app, not bank-level security.

## Tests

Run `node tests/scoring.test.js`.
