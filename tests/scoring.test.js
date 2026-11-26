import assert from 'node:assert/strict';
import { validateScore, stats, rankFinal } from '../js/logic.js';

// Deuce lobbies: to 11, win by 2.
for (const [a, b, ok] of [[11, 0, 1], [12, 10, 1], [13, 11, 1], [15, 13, 1], [11, 10, 0], [12, 9, 0], [10, 8, 0], [11, 11, 0], [-1, 11, 0], [1.5, 11, 0]]) {
  assert.equal(validateScore(a, b).ok, Boolean(ok), `deuce ${a}-${b}`);
}
assert.equal(validateScore('', 11).ok, false);
assert.equal(validateScore('11', '4').winner, 'A');
assert.equal(validateScore(4, 11).winner, 'B');

// No-deuce lobbies: first to 11, and any lead counts once the timer ends.
const noDeuce = { winByTwo: false };
for (const [a, b, ok] of [[11, 10, 1], [11, 0, 1], [12, 10, 0], [8, 6, 0], [10, 10, 0]]) {
  assert.equal(validateScore(a, b, noDeuce).ok, Boolean(ok), `no-deuce ${a}-${b}`);
}
const timeUp = { winByTwo: false, timeUp: true };
for (const [a, b, ok] of [[8, 6, 1], [1, 0, 1], [11, 10, 1], [7, 7, 0], [12, 3, 0]]) {
  assert.equal(validateScore(a, b, timeUp).ok, Boolean(ok), `time-up ${a}-${b}`);
}
assert.equal(validateScore(11, 10, false).ok, true, 'legacy boolean flag');

// Standings.
const s = stats([{ name: 'A' }, 'B', 'C', 'D'], [
  { status: 'done', teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 11, scoreB: 4, winner: 'A' },
  { status: 'live', teamA: ['A', 'C'], teamB: ['B', 'D'], scoreA: null, scoreB: null, winner: null },
]);
const a = s.find((x) => x.name === 'A');
assert.deepEqual([a.wins, a.losses, a.games, a.diff], [1, 0, 1, 7]);
assert.equal(rankFinal(s)[0].name, 'A');
console.log('scoring tests passed');
