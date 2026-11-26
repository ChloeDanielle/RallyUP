// RallyUp game logic. Everything in this file is pure (no DOM, no storage) so it
// can be unit tested in Node. Functions that change a lobby mutate the lobby
// object they are given; the store always hands them a fresh copy and only
// saves it when validateLobby() finds no problems.

export const LEVELS = [
  { id: 'beginner', label: 'Beginner', short: 'BEG', value: 1, hint: 'New to pickleball' },
  { id: 'novice', label: 'Novice', short: 'NOV', value: 2, hint: 'Learning rules and rallies' },
  { id: 'low-intermediate', label: 'Low Intermediate', short: 'LI', value: 3, hint: 'Steady serves and returns' },
  { id: 'intermediate', label: 'Intermediate', short: 'INT', value: 4, hint: 'Dinks, drops, placement' },
  { id: 'advanced', label: 'Advanced', short: 'ADV', value: 5, hint: 'Strategic, few errors' },
  { id: 'advanced-plus', label: 'Advanced+', short: 'ADV+', value: 6, hint: 'Tournament ready' },
  { id: 'elite', label: 'Elite', short: 'ELT', value: 7, hint: 'Top club competitor' },
  { id: 'pro', label: 'Pro', short: 'PRO', value: 8, hint: 'Professional level' },
];
export const DEFAULT_LEVEL = 'intermediate';
export const TIMER_MS = 15 * 60 * 1000;
export const PLANNED_MATCHES = 30;
export const MAX_COURTS = 6;
export const NAME_MAX = 20;

export class LobbyError extends Error {}
const fail = (message) => { throw new LobbyError(message); };

export const levelInfo = (id) => LEVELS.find((l) => l.id === id) || LEVELS.find((l) => l.id === DEFAULT_LEVEL);
export const isLevel = (id) => LEVELS.some((l) => l.id === id);
export const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
export const nameKey = (s) => cleanName(s).toLocaleLowerCase();
export const matchPlayers = (m) => [...m.teamA, ...m.teamB];
export const isTimed = (lobby) => lobby.winByTwo === false;
export const isStarted = (match) => typeof match.startedAt === "number";
export const activePlayers = (lobby) => lobby.players.filter((p) => p.active !== false);
export const liveMatches = (lobby) => lobby.matches.filter((m) => m.status === 'live').sort((a, b) => a.court - b.court);
export const pendingMatches = (lobby) => lobby.matches.filter((m) => m.status === 'pending').sort((a, b) => a.id - b.id);
export const doneMatches = (lobby) => lobby.matches.filter((m) => m.status === 'done').sort((a, b) => a.id - b.id);
export const findPlayer = (lobby, name) => lobby.players.find((p) => nameKey(p.name) === nameKey(name));
const busyPlayers = (lobby, exceptId) =>
  new Set(lobby.matches.filter((m) => m.status === 'live' && m.id !== exceptId).flatMap(matchPlayers));

export function timeLeft(match, lobby, now = Date.now()) {
  if (!isTimed(lobby) || !isStarted(match)) return null;
  return TIMER_MS - (now - match.startedAt);
}
export const isTimeUp = (match, lobby, now = Date.now()) => {
  const left = timeLeft(match, lobby, now);
  return left !== null && left <= 0;
};

// ---------------------------------------------------------------- scoring

// winByTwo=true:  classic game to 11, win by 2 (12-10, 13-11 ...).
// winByTwo=false: first to 11, no deuce (11-10 is fine, 12-10 is not). These
//                 lobbies are timed; once the timer runs out the team that is
//                 ahead wins with whatever score they have (e.g. 8-6).
export function validateScore(a, b, options = {}) {
  const { winByTwo = true, timeUp = false } = typeof options === 'boolean' ? { winByTwo: options } : options;
  if (a === '' || b === '' || a === null || b === null) return { ok: false, message: 'Enter a score for both teams.' };
  a = Number(a); b = Number(b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return { ok: false, message: 'Scores must be whole numbers.' };
  if (a === b) return { ok: false, message: 'Scores cannot be tied. Play one more point.' };
  const w = Math.max(a, b), l = Math.min(a, b), winner = a > b ? 'A' : 'B';
  if (winByTwo) {
    if (w < 11) return { ok: false, message: 'Winner must reach 11.' };
    if (w - l < 2) return { ok: false, message: 'Winner must win by 2.' };
    if (w > 11 && w - l !== 2) return { ok: false, message: 'Games past 11 must end with a 2-point lead.' };
    return { ok: true, winner };
  }
  if (w > 11) return { ok: false, message: 'No-deuce games end at 11.' };
  if (w < 11 && !timeUp) return { ok: false, message: 'Winner must reach 11, or wait for the timer to end.' };
  return { ok: true, winner };
}

// ---------------------------------------------------------------- stats

export function stats(players, matches) {
  const names = players.map((p) => (typeof p === 'string' ? p : p.name));
  const s = Object.fromEntries(names.map((p) => [p, { name: p, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, games: 0 }]));
  for (const m of matches.filter((x) => x.status === 'done')) {
    for (const side of ['A', 'B']) {
      for (const p of m['team' + side]) {
        const o = s[p];
        if (!o) continue;
        const mine = m['score' + side], other = m['score' + (side === 'A' ? 'B' : 'A')];
        o.games++; o.pointsFor += mine; o.pointsAgainst += other;
        m.winner === side ? o.wins++ : o.losses++;
      }
    }
  }
  return Object.values(s).map((o) => ({
    ...o,
    diff: o.pointsFor - o.pointsAgainst,
    winRate: o.games ? o.wins / o.games : 0,
    diffPerGame: o.games ? (o.pointsFor - o.pointsAgainst) / o.games : 0,
  }));
}
export function rankLive(s) {
  return [...s].sort((a, b) => b.winRate - a.winRate || b.diffPerGame - a.diffPerGame || b.games - a.games || a.name.localeCompare(b.name));
}
export function rankFinal(s) {
  return [...s].sort((a, b) => b.winRate - a.winRate || b.diffPerGame - a.diffPerGame || b.wins - a.wins || a.name.localeCompare(b.name));
}

// Games already played or on court, per player name.
export function gamesPlayed(lobby) {
  const g = Object.fromEntries(lobby.players.map((p) => [p.name, 0]));
  for (const m of lobby.matches) if (m.status !== 'pending') for (const p of matchPlayers(m)) if (p in g) g[p]++;
  return g;
}

// ---------------------------------------------------------------- matchmaking

// Build `count` balanced 2v2 matchups.
//   players: [{name, level}] (or plain names) who can be scheduled
//   history: matches already played/assigned (used for game counts and repeats)
//   recent:  the matches immediately before the new ones in queue order (live
//            and already-queued). The last (courts - 1) of these are likely on
//            the other courts at the same time, so their players are avoided.
// Priorities, strongest first: never double-book a court, equal games for
// everyone, evenly matched teams, players of similar level together, and
// fresh partners/opponents. Works on number indexes for speed on phones.
//   unavailable: names that cannot play the FIRST new matchup (on court now).
export function makeSchedule(players, count, { history = [], recent = [], courts = 1, unavailable = [], random = Math.random } = {}) {
  const roster = [];
  const seen = new Set();
  for (const p of players) {
    const player = typeof p === 'string' ? { name: cleanName(p), level: DEFAULT_LEVEL } : p;
    const key = nameKey(player.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    roster.push(player);
  }
  const n = roster.length;
  if (n < 4 || count <= 0) return [];
  const names = roster.map((p) => p.name);
  const index = new Map(names.map((name, i) => [name, i]));
  const value = roster.map((p) => levelInfo(p.level).value);
  const games = new Array(n).fill(0), last = new Array(n).fill(-1), tie = names.map(() => random());
  const partners = new Float64Array(n * n), opponents = new Float64Array(n * n), groups = new Map();
  const groupKey = (ids) => { const s = [...ids].sort((x, y) => x - y); return ((s[0] * n + s[1]) * n + s[2]) * n + s[3]; };
  let step = 0;
  const record = (m) => {
    step++;
    const a = m.teamA.map((p) => index.get(p)), b = m.teamB.map((p) => index.get(p));
    for (const i of [...a, ...b]) if (i !== undefined) { games[i]++; last[i] = step; }
    for (const [x, y] of [a, b]) if (x !== undefined && y !== undefined) { partners[x * n + y]++; partners[y * n + x]++; }
    for (const x of a) for (const y of b) if (x !== undefined && y !== undefined) { opponents[x * n + y]++; opponents[y * n + x]++; }
    if ([...a, ...b].every((i) => i !== undefined)) { const k = groupKey([...a, ...b]); groups.set(k, (groups.get(k) || 0) + 1); }
  };
  history.forEach(record);
  recent.forEach(record);

  const activeCourts = Math.max(1, Math.min(courts, Math.floor(n / 4)));
  const windowSize = activeCourts - 1;
  const sequence = [...recent];
  const out = [];
  const busy = new Uint8Array(n);
  const splits = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
  for (let round = 0; round < count; round++) {
    busy.fill(0);
    if (windowSize) for (const m of sequence.slice(-windowSize)) for (const p of matchPlayers(m)) { const i = index.get(p); if (i !== undefined) busy[i] = 1; }
    let order = names.map((_, i) => i).sort((a, b) => busy[a] - busy[b] || games[a] - games[b] || last[a] - last[b] || tie[a] - tie[b]);
    if (round === 0 && unavailable.length) {
      const blocked = new Set(unavailable);
      const open = order.filter((i) => !blocked.has(names[i]));
      if (open.length >= 4) order = open;
    }
    const pool = order.slice(0, Math.min(order.length, 16)), size = pool.length;
    let minGames = Infinity;
    for (let i = 0; i < n; i++) if (!busy[i]) minGames = Math.min(minGames, games[i]);
    if (minGames === Infinity) minGames = Math.min(...games);
    const fair = pool.map((i) => (games[i] - minGames) * 1000 + (busy[i] ? 10000 : 0));
    let best = null, bestCost = Infinity;
    const g = [0, 0, 0, 0];
    for (let w = 0; w < size - 3; w++) for (let x = w + 1; x < size - 2; x++) for (let y = x + 1; y < size - 1; y++) for (let z = y + 1; z < size; z++) {
      let base = fair[w] + fair[x] + fair[y] + fair[z];
      if (base >= bestCost) continue;
      g[0] = pool[w]; g[1] = pool[x]; g[2] = pool[y]; g[3] = pool[z];
      if (groups.size) base += (groups.get(groupKey(g)) || 0) * 50;
      const v0 = value[g[0]], v1 = value[g[1]], v2 = value[g[2]], v3 = value[g[3]];
      const spread = Math.max(v0, v1, v2, v3) - Math.min(v0, v1, v2, v3);
      base += spread * spread * 2;
      if (base >= bestCost) continue;
      for (const [p, q, r, s] of splits) {
        const a1 = g[p], a2 = g[q], b1 = g[r], b2 = g[s];
        const va1 = value[a1], va2 = value[a2], vb1 = value[b1], vb2 = value[b2];
        const cost = base
          + Math.abs(va1 + va2 - vb1 - vb2) * 40
          + (Math.abs(Math.max(va1, va2) - Math.max(vb1, vb2)) + Math.abs(Math.min(va1, va2) - Math.min(vb1, vb2))) * 10
          + (partners[a1 * n + a2] + partners[b1 * n + b2]) * 30
          + (opponents[a1 * n + b1] + opponents[a1 * n + b2] + opponents[a2 * n + b1] + opponents[a2 * n + b2]) * 8
          + random() * 3;
        if (cost < bestCost) { bestCost = cost; best = [a1, a2, b1, b2]; }
      }
    }
    const match = { teamA: [names[best[0]], names[best[1]]], teamB: [names[best[2]], names[best[3]]] };
    out.push(match);
    sequence.push(match);
    record(match);
  }
  return out;
}

const newMatch = (id, teams) => ({
  id, status: 'pending', court: null, teamA: teams.teamA, teamB: teams.teamB,
  scoreA: null, scoreB: null, winner: null, startedAt: null, endedAt: null,
});

// Throw away the upcoming queue and rebuild `count` matchups from the current
// roster. Live and finished matches are never touched.
export function regeneratePending(lobby, count = pendingMatches(lobby).length, random = Math.random, unavailable = []) {
  const fixed = lobby.matches.filter((m) => m.status !== 'pending');
  const done = fixed.filter((m) => m.status === 'done').sort((a, b) => a.id - b.id);
  const live = fixed.filter((m) => m.status === 'live').sort((a, b) => a.id - b.id);
  const teams = makeSchedule(activePlayers(lobby), count, { history: done, recent: live, courts: lobby.courts, unavailable, random });
  const base = Math.max(0, ...fixed.map((m) => m.id)) + 1;
  lobby.matches = [...fixed, ...teams.map((t, i) => newMatch(base + i, t))].sort((a, b) => a.id - b.id);
  return lobby;
}

// Append matchups to the end of the queue without changing existing ones.
export function addMatchups(lobby, amount, random = Math.random) {
  if (!Number.isInteger(amount) || amount < 1) fail('Enter a positive whole number.');
  if (amount > 100) fail('Add at most 100 matchups at a time.');
  if (activePlayers(lobby).length < 4) fail('At least 4 active players are needed.');
  const done = doneMatches(lobby);
  const queue = [...lobby.matches.filter((m) => m.status === 'live').sort((a, b) => a.id - b.id), ...pendingMatches(lobby)];
  const teams = makeSchedule(activePlayers(lobby), amount, { history: done, recent: queue, courts: lobby.courts, random });
  const base = Math.max(0, ...lobby.matches.map((m) => m.id)) + 1;
  lobby.matches.push(...teams.map((t, i) => newMatch(base + i, t)));
  fillCourts(lobby, random);
  return { added: teams.length };
}

export function removeLastMatchup(lobby) {
  const pending = pendingMatches(lobby);
  if (!pending.length) fail('There are no upcoming matchups to remove.');
  const lastOne = pending[pending.length - 1];
  lobby.matches = lobby.matches.filter((m) => m !== lastOne);
  return { removedId: lastOne.id };
}

// Put the next matchup on every empty court. Normally that is simply the head
// of the queue. If the head needs someone who is still playing on another
// court (courts rarely finish in the planned order), the upcoming queue is
// rebuilt from the players who are actually free, so nobody waits extra.
export function fillCourts(lobby, random = Math.random) {
  if (lobby.status !== 'live') return [];
  const filled = [];
  for (let court = 1; court <= lobby.courts; court++) {
    if (lobby.matches.some((m) => m.status === 'live' && m.court === court)) continue;
    const busy = busyPlayers(lobby);
    if (activePlayers(lobby).filter((p) => !busy.has(p.name)).length < 4) continue;
    let next = pendingMatches(lobby)[0];
    if (!next) continue;
    if (matchPlayers(next).some((p) => busy.has(p))) {
      regeneratePending(lobby, pendingMatches(lobby).length, random, [...busy]);
      next = pendingMatches(lobby)[0];
      if (!next || matchPlayers(next).some((p) => busy.has(p))) continue;
    }
    Object.assign(next, { status: 'live', court, startedAt: null });
    filled.push(next.id);
  }
  return filled;
}

// ---------------------------------------------------------------- lobby actions

export function createLobby({ code, password, courts = 2, winByTwo = true, now = Date.now() }) {
  if (!/^[A-Z0-9]{5}$/.test(code || '')) fail('Invalid lobby code.');
  if (String(password || '').length < 4) fail('Password must be at least 4 characters.');
  return {
    code, password: String(password), courts: clampCourts(courts), winByTwo: winByTwo !== false,
    status: 'checkin', players: [], matches: [], plannedTotal: PLANNED_MATCHES, createdAt: now, rev: 0,
  };
}

const clampCourts = (n) => Math.max(1, Math.min(MAX_COURTS, Math.round(Number(n) || 1)));

export function checkIn(lobby, rawName, level, { now = Date.now(), random = Math.random } = {}) {
  const name = cleanName(rawName);
  if (lobby.status === 'ended') fail('This open play has already ended.');
  if (!name) fail('Enter a player name.');
  if (!isLevel(level)) fail('Choose a skill level.');
  const existing = findPlayer(lobby, name);
  if (existing && existing.active !== false) fail(`${existing.name} is already checked in. Add a last initial to tell players apart.`);
  if (existing) Object.assign(existing, { level, active: true });
  else lobby.players.push({ name, level, active: true, joinedAt: now });
  if (lobby.status === 'live') { regeneratePending(lobby, undefined, random); fillCourts(lobby, random); }
  return { name: existing ? existing.name : name, rejoined: !!existing };
}

export function removePlayer(lobby, name) {
  const p = findPlayer(lobby, name);
  if (!p) fail('Player not found.');
  if (lobby.status !== 'checkin') fail('Mark the player as left instead.');
  lobby.players = lobby.players.filter((x) => x !== p);
  return { name: p.name };
}

export function setPlayerActive(lobby, name, active, random = Math.random) {
  const p = findPlayer(lobby, name);
  if (!p) fail('Player not found.');
  if (!active) {
    const onCourt = liveMatches(lobby).find((m) => matchPlayers(m).includes(p.name));
    if (onCourt) fail(`${p.name} is on Court ${onCourt.court}. Change them out of that match first.`);
  }
  p.active = !!active;
  if (lobby.status === 'live') { regeneratePending(lobby, undefined, random); fillCourts(lobby, random); }
  return { name: p.name };
}

export function setPlayerLevel(lobby, name, level, random = Math.random) {
  const p = findPlayer(lobby, name);
  if (!p) fail('Player not found.');
  if (!isLevel(level)) fail('Choose a skill level.');
  p.level = level;
  if (lobby.status === 'live') { regeneratePending(lobby, undefined, random); fillCourts(lobby, random); }
  return { name: p.name };
}

export function startLobby(lobby, { now = Date.now(), random = Math.random } = {}) {
  if (lobby.status !== 'checkin') fail('Open play has already started.');
  if (activePlayers(lobby).length < 4) fail('At least 4 players must check in first.');
  lobby.status = 'live';
  lobby.startedAt = now;
  lobby.matches = [];
  regeneratePending(lobby, lobby.plannedTotal || PLANNED_MATCHES, random);
  fillCourts(lobby, random);
  return {};
}

export function startMatch(lobby, id, now = Date.now()) {
  const m = lobby.matches.find((x) => x.id === id);
  if (!m || m.status !== 'live') fail('This match is no longer on court.');
  if (isStarted(m)) fail('This match has already started.');
  m.startedAt = now;
  return { court: m.court };
}

export function submitScore(lobby, id, scoreA, scoreB, now = Date.now(), random = Math.random) {
  const m = lobby.matches.find((x) => x.id === id);
  if (!m || m.status !== 'live') fail('This match is no longer on court.');
  if (!isStarted(m)) fail('Start the match before entering a score.');
  const v = validateScore(scoreA, scoreB, { winByTwo: lobby.winByTwo !== false, timeUp: isTimeUp(m, lobby, now) });
  if (!v.ok) fail(v.message);
  Object.assign(m, { status: 'done', scoreA: Number(scoreA), scoreB: Number(scoreB), winner: v.winner, endedAt: now });
  fillCourts(lobby, random);
  const next = lobby.matches.find((x) => x.status === 'live' && x.court === m.court);
  return { court: m.court, nextId: next ? next.id : null };
}

// Players who can come onto court for `matchId`: active and not in any live match.
export function availableSubs(lobby, matchId) {
  const m = lobby.matches.find((x) => x.id === matchId);
  const busy = busyPlayers(lobby);
  if (m) matchPlayers(m).forEach((p) => busy.add(p));
  return activePlayers(lobby).filter((p) => !busy.has(p.name));
}

// Swap `outName` (on court) with `inName` (waiting). The incoming player's next
// upcoming matchup is handed to the outgoing player, so both keep the same
// number of games. The two names are exchanged inside that matchup, which can
// never create a duplicate even if both players are already in it.
export function substitute(lobby, matchId, outName, inName, random = Math.random) {
  const m = lobby.matches.find((x) => x.id === matchId);
  if (!m || m.status !== 'live') fail('This match is no longer on court.');
  if (!matchPlayers(m).includes(outName)) fail(`${outName} is no longer in this match.`);
  const incoming = findPlayer(lobby, inName);
  if (!incoming || incoming.active === false) fail(`${inName} is not checked in.`);
  if (!availableSubs(lobby, matchId).some((p) => p.name === incoming.name)) fail(`${incoming.name} is already on a court.`);
  const swap = (team) => team.map((p) => (p === outName ? incoming.name : p === incoming.name ? outName : p));
  m.teamA = swap(m.teamA); m.teamB = swap(m.teamB);
  const handover = pendingMatches(lobby).find((x) => matchPlayers(x).includes(incoming.name));
  if (handover) { handover.teamA = swap(handover.teamA); handover.teamB = swap(handover.teamB); }
  fillCourts(lobby, random);
  return { outName, inName: incoming.name, handoverId: handover ? handover.id : null };
}

export function randomSubstitute(lobby, matchId, outName, random = Math.random) {
  const options = availableSubs(lobby, matchId);
  if (!options.length) fail('Everyone else is on a court right now.');
  return substitute(lobby, matchId, outName, options[Math.floor(random() * options.length)].name, random);
}

export function setCourts(lobby, courts, random = Math.random) {
  const n = clampCourts(courts);
  for (const m of liveMatches(lobby).filter((x) => x.court > n)) {
    if (isStarted(m)) fail(`Court ${m.court} has a match in progress. Finish it first.`);
  }
  for (const m of liveMatches(lobby).filter((x) => x.court > n)) Object.assign(m, { status: 'pending', court: null, startedAt: null });
  lobby.courts = n;
  fillCourts(lobby, random);
  return { courts: n };
}

export function endLobby(lobby, now = Date.now()) {
  if (lobby.status === 'ended') fail('Open play already ended.');
  lobby.status = 'ended';
  lobby.endedAt = now;
  return {};
}

// ---------------------------------------------------------------- integrity

// Every rule a saved lobby must follow. An empty list means the lobby is safe.
export function validateLobby(lobby) {
  const errors = [];
  const keys = new Set(), names = new Set(), active = new Set();
  for (const p of lobby.players) {
    const key = nameKey(p.name);
    if (!key || p.name !== cleanName(p.name)) errors.push(`Invalid player name "${p.name}"`);
    if (keys.has(key)) errors.push(`Duplicate player ${p.name}`);
    keys.add(key); names.add(p.name);
    if (p.active !== false) active.add(p.name);
    if (!isLevel(p.level)) errors.push(`Invalid level for ${p.name}`);
  }
  const ids = new Set(), courts = new Set(), onCourt = new Set();
  for (const m of lobby.matches) {
    if (ids.has(m.id)) errors.push(`Duplicate match id ${m.id}`);
    ids.add(m.id);
    if (!Array.isArray(m.teamA) || !Array.isArray(m.teamB) || m.teamA.length !== 2 || m.teamB.length !== 2) {
      errors.push(`Match #${m.id} must have two teams of two`);
      continue;
    }
    const ps = matchPlayers(m);
    if (new Set(ps).size !== 4) errors.push(`Match #${m.id} has the same player twice`);
    if (m.status === 'done') continue;
    for (const p of ps) {
      if (!names.has(p)) errors.push(`Match #${m.id} has unknown player ${p}`);
      else if (!active.has(p)) errors.push(`Match #${m.id} has inactive player ${p}`);
    }
    if (m.status === 'live') {
      if (!Number.isInteger(m.court) || m.court < 1 || m.court > lobby.courts) errors.push(`Match #${m.id} is on an invalid court`);
      if (courts.has(m.court)) errors.push(`Court ${m.court} has two live matches`);
      courts.add(m.court);
      for (const p of ps) { if (onCourt.has(p)) errors.push(`${p} is on two courts`); onCourt.add(p); }
    } else if (m.status !== 'pending') errors.push(`Match #${m.id} has unknown status`);
  }
  return errors;
}

// Bring a stored lobby (possibly from an older RallyUp version, or damaged by
// the old change-matchup bug) up to date. Bad upcoming or live matchups are
// rebuilt; finished results are kept.
export function repairLobby(raw, random = Math.random) {
  const before = JSON.stringify(raw);
  const lobby = JSON.parse(before);
  const legacyWinByTwo = typeof localStorage !== 'undefined' && localStorage.getItem('rally-win-by-two') === 'false' ? false : true;
  if (typeof lobby.winByTwo !== 'boolean') lobby.winByTwo = legacyWinByTwo;
  lobby.courts = clampCourts(lobby.courts);
  if (!['checkin', 'live', 'ended'].includes(lobby.status)) lobby.status = 'live';
  lobby.plannedTotal ??= PLANNED_MATCHES;
  const seen = new Set();
  lobby.players = (Array.isArray(lobby.players) ? lobby.players : [])
    .map((p) => (typeof p === 'string' ? { name: p } : { ...p }))
    .map((p) => ({ ...p, name: cleanName(p.name), level: isLevel(p.level) ? p.level : DEFAULT_LEVEL, active: p.active !== false }))
    .filter((p) => { const k = nameKey(p.name); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const names = new Set(lobby.players.map((p) => p.name));
  const active = new Set(activePlayers(lobby).map((p) => p.name));
  lobby.matches = (Array.isArray(lobby.matches) ? lobby.matches : [])
    .filter((m) => m && Array.isArray(m.teamA) && Array.isArray(m.teamB))
    .map((m) => ({
      id: m.id, status: m.status, court: m.court ?? null, teamA: m.teamA, teamB: m.teamB,
      scoreA: m.scoreA ?? null, scoreB: m.scoreB ?? null, winner: m.winner ?? null,
      startedAt: m.startedAt ?? null, endedAt: m.endedAt ?? null,
    }));
  if (lobby.status === 'checkin') lobby.matches = [];
  const good = (m) => m.teamA.length === 2 && m.teamB.length === 2 && new Set(matchPlayers(m)).size === 4;
  lobby.matches = lobby.matches.filter((m) => m.status !== 'done' || (good(m) && matchPlayers(m).every((p) => names.has(p))));
  let rebuild = false, dropped = 0;
  const onCourt = new Set(), usedCourts = new Set();
  for (const m of [...lobby.matches].sort((a, b) => a.id - b.id)) {
    if (m.status === 'done') continue;
    const ok = good(m) && matchPlayers(m).every((p) => active.has(p));
    if (m.status === 'live') {
      const clash = matchPlayers(m).some((p) => onCourt.has(p)) || usedCourts.has(m.court) || !(m.court >= 1 && m.court <= lobby.courts);
      if (!ok || clash) { m.status = 'drop'; dropped++; rebuild = true; continue; }
      matchPlayers(m).forEach((p) => onCourt.add(p)); usedCourts.add(m.court);
    } else if (!ok || m.status !== 'pending') rebuild = true;
  }
  const ids = new Set();
  for (const m of lobby.matches) { if (ids.has(m.id)) rebuild = true; ids.add(m.id); }
  if (rebuild && lobby.status !== 'checkin') {
    const count = lobby.matches.filter((m) => m.status === 'pending' || m.status === 'drop').length;
    lobby.matches = lobby.matches.filter((m) => m.status !== 'drop' && m.status !== 'pending');
    regeneratePending(lobby, count, random);
  } else lobby.matches = lobby.matches.filter((m) => m.status !== 'drop');
  fillCourts(lobby, random);
  return { lobby, changed: JSON.stringify(lobby) !== before, dropped };
}

export function code(random = Math.random) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(random() * chars.length)]).join('');
}
