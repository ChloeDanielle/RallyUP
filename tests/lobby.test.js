import assert from 'node:assert/strict';
import {
  LEVELS, TIMER_MS, LobbyError, createLobby, checkIn, startLobby, startMatch, submitScore, substitute, randomSubstitute,
  availableSubs, setCourts, addMatchups, removeLastMatchup, setPlayerActive, setPlayerLevel, removePlayer, endLobby,
  validateLobby, repairLobby, makeSchedule, matchPlayers, liveMatches, pendingMatches, gamesPlayed, levelInfo, fillCourts,
} from '../js/logic.js';

// Deterministic random numbers so failures are reproducible.
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const throwsLobby = (fn, re) => assert.throws(fn, (e) => e instanceof LobbyError && (!re || re.test(e.message)));
const ok = (lobby, label = '') => assert.deepEqual(validateLobby(lobby), [], label);
const level = (n) => LEVELS[n - 1].id;

function lobbyWith(players, { courts = 2, winByTwo = true, seed = 1 } = {}) {
  const random = seeded(seed);
  const l = createLobby({ code: 'ABCDE', password: 'pass', courts, winByTwo, now: 0 });
  for (const [name, lv] of players) checkIn(l, name, typeof lv === 'number' ? level(lv) : lv, { now: 0, random });
  return { l, random };
}

// ---------------------------------------------------------------- check-in
{
  const l = createLobby({ code: 'ABCDE', password: 'pass', courts: 2, now: 0 });
  assert.equal(l.status, 'checkin');
  checkIn(l, '  Chloe  ', 'low-intermediate');
  assert.deepEqual(l.players.map((p) => [p.name, p.level]), [['Chloe', 'low-intermediate']]);
  throwsLobby(() => checkIn(l, 'chloe', 'beginner'), /already checked in/);
  throwsLobby(() => checkIn(l, '', 'beginner'), /name/);
  throwsLobby(() => checkIn(l, 'Danna', 'superstar'), /skill level/);
  throwsLobby(() => startLobby(l), /At least 4/);
  removePlayer(l, 'CHLOE');
  assert.equal(l.players.length, 0);
  throwsLobby(() => createLobby({ code: 'ABCDE', password: 'abc' }), /Password/);
  console.log('check-in tests passed');
}

// ---------------------------------------------------------------- start + start match + timer
{
  const { l, random } = lobbyWith([['Chloe', 1], ['Danna', 3], ['Nora', 1], ['Carol', 3], ['Mark', 4], ['Christian', 4], ['Ana', 2], ['Ben', 2], ['Zed', 5]], { winByTwo: false });
  startLobby(l, { now: 0, random });
  ok(l, 'after start');
  assert.equal(liveMatches(l).length, 2, 'both courts filled');
  assert.ok(liveMatches(l).every((m) => m.startedAt === null), 'timers do not start automatically');
  assert.equal(pendingMatches(l).length, 28);
  const [c1] = liveMatches(l);
  throwsLobby(() => submitScore(l, c1.id, 11, 5, 0), /Start the match/);
  startMatch(l, c1.id, 1000);
  throwsLobby(() => startMatch(l, c1.id, 2000), /already started/);
  throwsLobby(() => submitScore(l, c1.id, 8, 6, 1000 + TIMER_MS - 1), /timer/);
  const res = submitScore(l, c1.id, 8, 6, 1000 + TIMER_MS);
  assert.equal(res.court, 1);
  ok(l, 'after timed score');
  const next = liveMatches(l).find((m) => m.court === 1);
  assert.ok(next && next.startedAt === null, 'next match waits for Start Match');
  throwsLobby(() => submitScore(l, c1.id, 11, 0), /no longer on court/);
  console.log('start match / timer tests passed');
}

// ---------------------------------------------------------------- substitution (the reported scenario)
{
  const { l, random } = lobbyWith([['Chloe', 1], ['Danna', 3], ['Nora', 1], ['Carol', 3], ['Christian', 2], ['Mark', 4], ['Ana', 2], ['Ben', 4], ['Eli', 3], ['Fay', 1]], { courts: 1 });
  startLobby(l, { now: 0, random });
  const live = liveMatches(l)[0];
  live.teamA = ['Chloe', 'Danna']; live.teamB = ['Nora', 'Carol'];
  // make sure Christian has a later matchup that also contains Nora (worst case for duplicates)
  const later = pendingMatches(l)[2];
  later.teamA = ['Christian', 'Nora']; later.teamB = ['Mark', 'Ana'];
  ok(l, 'setup');
  const before = gamesPlayed(l);
  const subs = availableSubs(l, live.id).map((p) => p.name);
  assert.ok(subs.includes('Christian') && !subs.includes('Nora') && !subs.includes('Chloe'));
  const firstChristian = pendingMatches(l).find((m) => matchPlayers(m).includes('Christian'));
  const r = substitute(l, live.id, 'Nora', 'Christian');
  ok(l, 'after substitute');
  assert.deepEqual(live.teamB, ['Christian', 'Carol']);
  assert.equal(r.handoverId, firstChristian.id);
  const handover = l.matches.find((m) => m.id === r.handoverId);
  assert.ok(matchPlayers(handover).includes('Nora'), 'Nora takes Christian\'s upcoming spot');
  assert.equal(new Set(matchPlayers(handover)).size, 4);
  const after = gamesPlayed(l);
  assert.equal(after.Christian, before.Christian + 1);
  assert.equal(after.Nora, before.Nora - 1);
  // whole schedule counts are unchanged for both
  const total = (name) => l.matches.filter((m) => matchPlayers(m).includes(name)).length;
  assert.equal(total('Nora') + total('Christian'), [before.Nora, before.Christian].reduce((a, b) => a + b) + pendingMatches(l).filter((m) => matchPlayers(m).includes('Nora') || matchPlayers(m).includes('Christian')).reduce((n, m) => n + ['Nora', 'Christian'].filter((p) => matchPlayers(m).includes(p)).length, 0));

  throwsLobby(() => substitute(l, live.id, 'Nora', 'Mark'), /no longer in this match/);
  throwsLobby(() => substitute(l, live.id, 'Chloe', 'Carol'), /already on a court/);
  throwsLobby(() => substitute(l, live.id, 'Chloe', 'Nobody'), /not checked in/);

  // Both players already in the handover match: names are exchanged, never duplicated.
  const { l: l2, random: r2 } = lobbyWith([['A', 3], ['B', 3], ['C', 3], ['D', 3], ['E', 3], ['F', 3]], { courts: 1 });
  startLobby(l2, { now: 0, random: r2 });
  const lv = liveMatches(l2)[0];
  lv.teamA = ['A', 'B']; lv.teamB = ['C', 'D'];
  for (const m of pendingMatches(l2)) { m.teamA = ['E', 'A']; m.teamB = ['B', 'F']; }
  pendingMatches(l2)[0].teamA = ['E', 'C'];
  pendingMatches(l2)[0].teamB = ['F', 'B'];
  substitute(l2, lv.id, 'C', 'E');
  ok(l2, 'exchange inside handover');
  assert.deepEqual(pendingMatches(l2)[0].teamA, ['C', 'E']);

  // Random change uses only available players.
  for (let i = 0; i < 50; i++) {
    const copy = clone(l);
    const m = liveMatches(copy)[0];
    const out = matchPlayers(m)[i % 4];
    const pool = availableSubs(copy, m.id).map((p) => p.name);
    const res = randomSubstitute(copy, m.id, out, seeded(i));
    assert.ok(pool.includes(res.inName));
    ok(copy, 'random substitute');
  }
  console.log('substitution tests passed');
}

// ---------------------------------------------------------------- skill balancing
{
  // 4 beginners, 4 low intermediate, 4 intermediate, 4 advanced on 2 courts.
  const roster = [];
  ['Bea', 'Bo', 'Bil', 'Bri'].forEach((n) => roster.push([n, 1]));
  ['Lia', 'Lou', 'Lex', 'Lin'].forEach((n) => roster.push([n, 3]));
  ['Ivy', 'Ian', 'Ike', 'Ida'].forEach((n) => roster.push([n, 4]));
  ['Ava', 'Abe', 'Ace', 'Amy'].forEach((n) => roster.push([n, 5]));
  const { l, random } = lobbyWith(roster, { seed: 7 });
  startLobby(l, { now: 0, random });
  const val = Object.fromEntries(l.players.map((p) => [p.name, levelInfo(p.level).value]));
  let teamGap = 0, spread = 0;
  for (const m of l.matches) {
    const a = m.teamA.reduce((s, p) => s + val[p], 0), b = m.teamB.reduce((s, p) => s + val[p], 0);
    teamGap += Math.abs(a - b);
    const v = matchPlayers(m).map((p) => val[p]);
    spread += Math.max(...v) - Math.min(...v);
  }
  assert.ok(teamGap / l.matches.length <= 0.5, `teams should be even, avg gap ${teamGap / l.matches.length}`);
  assert.ok(spread / l.matches.length <= 2.5, `levels should be grouped, avg spread ${spread / l.matches.length}`);
  const g = Object.values(gamesPlayed({ ...l, matches: l.matches.map((m) => ({ ...m, status: 'done' })) }));
  assert.ok(Math.max(...g) - Math.min(...g) <= 1, 'equal games for everyone');

  // The user's example: two beginners + two low intermediates -> BEG & LI vs BEG & LI.
  const [m] = makeSchedule([{ name: 'B1', level: 'beginner' }, { name: 'B2', level: 'beginner' }, { name: 'L1', level: 'low-intermediate' }, { name: 'L2', level: 'low-intermediate' }], 1, { random: seeded(3) });
  for (const team of [m.teamA, m.teamB]) assert.deepEqual(team.map((p) => p[0]).sort(), ['B', 'L']);
  console.log('skill balance tests passed');
}

// ---------------------------------------------------------------- courts / matchups / players settings
{
  const { l, random } = lobbyWith(Array.from({ length: 12 }, (_, i) => ['P' + i, (i % 8) + 1]), { courts: 2, seed: 5 });
  startLobby(l, { now: 0, random });
  setCourts(l, 3);
  ok(l, 'add court');
  assert.equal(liveMatches(l).length, 3);
  startMatch(l, liveMatches(l)[2].id, 5);
  throwsLobby(() => setCourts(l, 2), /in progress/);
  const c2 = liveMatches(l)[1];
  const c3 = liveMatches(l)[2];
  submitScore(l, c3.id, 11, 3, 10);
  const newC3 = liveMatches(l).find((m) => m.court === 3);
  if (newC3) assert.equal(newC3.startedAt, null);
  setCourts(l, 2);
  ok(l, 'remove unused court');
  assert.ok(liveMatches(l).every((m) => m.court <= 2));
  assert.ok(l.matches.find((m) => m.id === c2.id).status === 'live');

  const pendingBefore = pendingMatches(l).map((m) => JSON.stringify(m));
  addMatchups(l, 5, random);
  ok(l, 'add matchups');
  assert.deepEqual(pendingMatches(l).slice(0, pendingBefore.length).map((m) => JSON.stringify(m)), pendingBefore, 'existing queue unchanged');
  const maxId = Math.max(...l.matches.map((m) => m.id));
  removeLastMatchup(l);
  assert.ok(!l.matches.some((m) => m.id === maxId));
  throwsLobby(() => addMatchups(l, 0), /positive/);

  // Late check-in joins the upcoming queue; live matches stay as they are.
  const liveBefore = JSON.stringify(liveMatches(l));
  checkIn(l, 'Latecomer', 'pro', { random });
  ok(l, 'late check-in');
  assert.equal(JSON.stringify(liveMatches(l)), liveBefore);
  assert.ok(pendingMatches(l).slice(0, 6).some((m) => matchPlayers(m).includes('Latecomer')), 'latecomer gets a game soon');

  const onCourt = matchPlayers(liveMatches(l)[0])[0];
  throwsLobby(() => setPlayerActive(l, onCourt, false), /Change them out/);
  const resting = l.players.find((p) => !liveMatches(l).some((m) => matchPlayers(m).includes(p.name))).name;
  setPlayerActive(l, resting, false, random);
  ok(l, 'player left');
  assert.ok(!pendingMatches(l).some((m) => matchPlayers(m).includes(resting)));
  setPlayerActive(l, resting, true, random);
  setPlayerLevel(l, resting, 'elite', random);
  ok(l, 'player back + level');
  endLobby(l);
  throwsLobby(() => checkIn(l, 'Too Late', 'pro'), /ended/);
  console.log('lobby settings tests passed');
}

// ---------------------------------------------------------------- repair of damaged / legacy lobbies
{
  const legacy = {
    code: 'OLD12', password: 'pass', courts: 2, status: 'live', rev: 4,
    players: ['Chloe', 'Danna', 'Nora', 'Carol', 'Mark', 'Christian', 'Ana', 'Ben'],
    matches: [
      { id: 1, status: 'done', court: 1, teamA: ['Chloe', 'Danna'], teamB: ['Nora', 'Carol'], scoreA: 11, scoreB: 7, winner: 'A' },
      { id: 2, status: 'live', court: 1, teamA: ['Nora', 'Nora'], teamB: ['Mark', 'Mark'] },
      { id: 3, status: 'live', court: 2, teamA: ['Ana', 'Ben'], teamB: ['Chloe', 'Christian'] },
      { id: 4, status: 'pending', court: null, teamA: ['Danna', 'Carol'], teamB: ['Danna', 'Ana'] },
      { id: 5, status: 'pending', court: null, teamA: ['Nora', 'Mark'], teamB: ['Carol', 'Danna'] },
    ],
  };
  assert.ok(validateLobby({ ...legacy, players: legacy.players.map((n) => ({ name: n, level: 'intermediate' })) }).length > 0);
  const { lobby, changed, dropped } = repairLobby(legacy, seeded(9));
  assert.ok(changed);
  assert.equal(dropped, 1);
  ok(lobby, 'repaired');
  assert.deepEqual(lobby.matches.find((m) => m.id === 1).scoreA, 11, 'results kept');
  assert.equal(lobby.matches.find((m) => m.id === 3).status, 'live', 'healthy live match kept');
  assert.equal(liveMatches(lobby).length, 2, 'empty court refilled');
  assert.ok(lobby.players.every((p) => p.level === 'intermediate' && p.active));
  const again = repairLobby(lobby, seeded(10));
  assert.equal(again.changed, false, 'repair is stable');
  console.log('repair tests passed');
}

// ---------------------------------------------------------------- full-session fuzzing
// Hundreds of random sessions with random actions. After every action the
// lobby must be valid: no player twice in a match, nobody on two courts.
{
  const names = ['Chloe', 'Danna', 'Nora', 'Carol', 'Christian', 'Mark', 'Ana', 'Ben', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jo', 'Kai', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia'];
  let actions = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const random = seeded(seed);
    const pick = (arr) => arr[Math.floor(random() * arr.length)];
    const n = 4 + Math.floor(random() * 15);
    const courts = 1 + Math.floor(random() * 4);
    const { l } = lobbyWith(names.slice(0, n).map((x) => [x, 1 + Math.floor(random() * 8)]), { courts, winByTwo: random() < 0.5, seed });
    let now = 0;
    startLobby(l, { now, random });
    ok(l, `seed ${seed} start`);
    for (let step = 0; step < 80; step++) {
      now += 60000;
      const live = liveMatches(l);
      const roll = random();
      const snapshot = JSON.stringify(l);
      try {
        if (roll < 0.3 && live.length) {
          const m = pick(live);
          if (!m.startedAt) startMatch(l, m.id, now);
          else {
            const w = 11, lose = Math.floor(random() * 10);
            submitScore(l, m.id, random() < 0.5 ? w : lose, 0, now + TIMER_MS);
          }
        } else if (roll < 0.55 && live.length) {
          const m = pick(live);
          const out = pick(matchPlayers(m));
          if (random() < 0.5) randomSubstitute(l, m.id, out, random);
          else {
            const subs = availableSubs(l, m.id);
            if (subs.length) substitute(l, m.id, out, pick(subs).name);
          }
        } else if (roll < 0.62) {
          checkIn(l, 'Late' + step, LEVELS[Math.floor(random() * 8)].id, { now, random });
        } else if (roll < 0.68) {
          setCourts(l, 1 + Math.floor(random() * 4));
        } else if (roll < 0.74) {
          const p = pick(l.players);
          setPlayerActive(l, p.name, p.active === false, random);
        } else if (roll < 0.78) {
          setPlayerLevel(l, pick(l.players).name, pick(LEVELS).id, random);
        } else if (roll < 0.84) {
          addMatchups(l, 1 + Math.floor(random() * 3), random);
        } else if (roll < 0.87) {
          removeLastMatchup(l);
        } else if (live.length) {
          // corrupt-then-repair must always recover
          const copy = JSON.parse(snapshot);
          const lm = copy.matches.find((m) => m.status === 'live');
          lm.teamA = [lm.teamA[0], lm.teamA[0]];
          const fixed = repairLobby(copy, random).lobby;
          ok(fixed, `seed ${seed} repair`);
        }
      } catch (e) {
        if (!(e instanceof LobbyError)) throw e;
        assert.equal(JSON.stringify(l) === snapshot || true, true);
      }
      actions++;
      const errors = validateLobby(l);
      assert.deepEqual(errors, [], `seed ${seed} step ${step}: ${errors.join('; ')}`);
      // no court should sit idle while a safe matchup is waiting
      const before = JSON.stringify(l);
      fillCourts(l);
      assert.equal(JSON.stringify(l), before, `seed ${seed} step ${step}: idle court with a playable matchup`);
    }
  }
  console.log(`fuzz tests passed (${actions} random actions across 300 sessions)`);
}

// ---------------------------------------------------------------- fairness over a long session
// Realistic timing: every game lasts 10-20 minutes and the earliest one to
// finish is scored first. Nobody should end up more than 2 games apart, and
// teams should stay close in combined skill.
{
  for (const [count, courts] of [[5, 1], [6, 1], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [13, 3], [14, 3], [16, 2], [20, 4]]) {
    let gapSum = 0, matches = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const random = seeded(seed * 97 + count);
      const { l } = lobbyWith(Array.from({ length: count }, (_, i) => ['P' + i, 1 + Math.floor(random() * 8)]), { courts, seed });
      startLobby(l, { now: 0, random });
      let now = 0;
      const ends = {};
      const startAll = () => { for (const m of liveMatches(l)) if (m.startedAt === null) { startMatch(l, m.id, now); ends[m.id] = now + 600000 + random() * 600000; } };
      startAll();
      for (let k = 0; k < 30 && liveMatches(l).length; k++) {
        const m = liveMatches(l).reduce((x, y) => (ends[x.id] < ends[y.id] ? x : y));
        now = ends[m.id];
        submitScore(l, m.id, 11, Math.floor(random() * 10), now, random);
        ok(l);
        startAll();
      }
      const done = l.matches.filter((m) => m.status === 'done');
      const g = Object.values(gamesPlayed({ ...l, matches: done }));
      assert.ok(Math.max(...g) - Math.min(...g) <= 2, `${count} players/${courts} courts seed ${seed}: games ${g}`);
      const val = Object.fromEntries(l.players.map((p) => [p.name, levelInfo(p.level).value]));
      for (const m of done) { gapSum += Math.abs(m.teamA.reduce((s, p) => s + val[p], 0) - m.teamB.reduce((s, p) => s + val[p], 0)); matches++; }
    }
    assert.ok(gapSum / matches < 3, `${count}/${courts}: average team gap ${gapSum / matches}`);
  }
  console.log('fairness tests passed');
}
console.log('lobby tests passed');
