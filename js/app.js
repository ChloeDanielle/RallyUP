import { app, toast, nav, esc } from './ui.js';
import { store } from './store.js';
import {
  LEVELS, TIMER_MS, MAX_COURTS, NAME_MAX, code, levelInfo, stats, rankLive, matchPlayers, isTimed, isStarted,
  timeLeft, activePlayers, liveMatches, pendingMatches, doneMatches, gamesPlayed, availableSubs, findPlayer, nameKey,
  checkIn, removePlayer, startLobby, startMatch, submitScore, substitute, randomSubstitute, setCourts, addMatchups,
  removeLastMatchup, setPlayerActive, setPlayerLevel, endLobby, validateScore, isTimeUp,
} from './logic.js';
import { finalResults } from './results.js';

const state = { unsub: null, code: null, host: false, tab: 'courts', viewKey: '', lobby: null };
const $ = (id) => document.getElementById(id);
const route = () => location.hash || '#/';
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
const meKey = (c) => `rally-me:${c}`;

// ---------------------------------------------------------------- boot + routing

window.addEventListener('hashchange', render);
let loadProgress = 12;
const loadTimer = setInterval(() => {
  loadProgress = Math.min(100, loadProgress + 22);
  const fill = $('loader-fill'), percent = $('loader-percent');
  if (fill) fill.style.width = loadProgress + '%';
  if (percent) percent.textContent = loadProgress + '%';
  if (loadProgress >= 100) clearInterval(loadTimer);
}, 130);
setTimeout(() => { $('loader')?.classList.add('done'); render(); }, 650);
setInterval(tickTimers, 500);

function render() {
  state.unsub?.();
  state.unsub = null;
  closeModals();
  const h = route();
  if (h.startsWith('#/create')) return create();
  if (h.startsWith('#/join')) return join();
  const [, kind, c] = h.split('?')[0].split('/');
  if ((kind === 'host' || kind === 'lobby') && c) return watch(c.toUpperCase(), kind === 'host');
  landing();
}

// Re-render the screen while keeping whatever the user was typing or had
// selected, so live updates from other devices never wipe a half-filled form.
function frame(html, key) {
  const same = key && key === state.viewKey;
  const saved = same ? snapshotFields() : null;
  // Only animate when arriving on a new screen, not on live updates.
  app.innerHTML = `<main class="screen${same ? ' still' : ''}">${html}</main>`;
  state.viewKey = key || '';
  if (saved) restoreFields(saved);
  app.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => nav(b.dataset.go); });
}
function snapshotFields() {
  const fields = [...app.querySelectorAll('input, textarea, select')];
  const active = document.activeElement;
  return {
    values: fields.filter((f) => f.id && f.type !== 'radio' && f.type !== 'checkbox').map((f) => [f.id, f.value]),
    checks: fields.filter((f) => f.type === 'radio' || f.type === 'checkbox').map((f) => [f.name || f.id, f.value, f.checked]),
    focus: active && app.contains(active) && active.id ? [active.id, active.selectionStart, active.selectionEnd] : null,
  };
}
function restoreFields({ values, checks, focus }) {
  for (const [id, value] of values) { const f = $(id); if (f && f.value !== value) f.value = value; }
  for (const [name, value, checked] of checks) {
    const f = [...app.querySelectorAll('input')].find((x) => (x.name || x.id) === name && x.value === value);
    if (f) f.checked = checked;
  }
  if (focus) { const f = $(focus[0]); if (f) { f.focus(); try { f.setSelectionRange(focus[1], focus[2]); } catch { /* not a text field */ } } }
}

function landing() {
  frame(`<section class="landing"><div class="landing-header"><div class="landing-brand">Rally<span>Up</span></div><p>By: Chloe Gutierrez</p></div><div class="landing-visual"><div class="ball ball-a"></div><div class="ball ball-b"></div><img src="Logo/Logo.png" alt="RallyUp pickleball mascot and logo"></div><div class="landing-copy"><p class="eyebrow">OPEN PLAY, RALLIED UP</p><h1><span>Rally</span><b>Up</b></h1><p class="byline">By: Chloe Gutierrez</p><p class="intro">Host a lobby, let players check in with their skill level, and keep every court moving with balanced games.</p><div class="actions"><button class="btn primary" data-go="#/create">Create Open Play Lobby</button><button class="btn dark" data-go="#/join">Join Lobby</button></div><p class="footer-note">Made for pickleball people 🏓</p></div></section>`, 'landing');
}

const head = (title, back = '#/') => `<div class="top"><div class="brand">Rally<span>Up</span></div><button class="btn outline" data-go="${back}">Back</button></div><h2>${title}</h2>`;

// ---------------------------------------------------------------- shared bits

const levelTag = (level) => { const l = levelInfo(level); return `<span class="lv lv-${l.value}" title="${esc(l.label)}">${esc(l.short)}</span>`; };
function levelPicker(name, selected) {
  return `<div class="level-picker" role="radiogroup" aria-label="Skill level">${LEVELS.map((l) => `<label class="level-option"><input type="radio" name="${name}" value="${l.id}"${l.id === selected ? ' checked' : ''}><span class="level-card lv-border-${l.value}"><b>${esc(l.label)}</b><small>${esc(l.hint)}</small></span></label>`).join('')}</div>`;
}
const pickedLevel = (root, name) => root.querySelector(`input[name="${name}"]:checked`)?.value || '';
function playerName(lobby, name, { me } = {}) {
  const p = findPlayer(lobby, name);
  return `<span class="pname${me && nameKey(me) === nameKey(name) ? ' is-me' : ''}">${esc(name)}${p ? ' ' + levelTag(p.level) : ''}</span>`;
}
const teamHtml = (lobby, team, opts) => team.map((p) => playerName(lobby, p, opts)).join('<span class="amp">&amp;</span>');
const ruleText = (l) => (isTimed(l) ? `No deuce · ${TIMER_MS / 60000}-min games` : 'Win by 2 (deuce)');

function act(fn, success) {
  const res = store.mutate(state.code, fn);
  if (!res.ok) { toast(res.error); return null; }
  if (success) toast(typeof success === 'function' ? success(res) : success);
  return res;
}

// ---------------------------------------------------------------- modals

function closeModals() { document.querySelectorAll('.modal-back').forEach((m) => m.remove()); }
function openModal(html, cls = '') {
  closeModals();
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  back.querySelectorAll('[data-close]').forEach((b) => { b.onclick = close; });
  setTimeout(() => back.querySelector('[autofocus], input, button.primary')?.focus(), 30);
  return { el: back, close, $: (sel) => back.querySelector(sel) };
}
function confirmModal(title, message, confirmText, action, danger = false) {
  const m = openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(message)}</p><div class="row"><button class="btn outline" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" id="confirm-yes">${esc(confirmText)}</button></div>`);
  m.$('#confirm-yes').onclick = () => { m.close(); action(); };
}

// ---------------------------------------------------------------- create

function create() {
  let c = code(), courts = 2;
  frame(`${head('Set up your open play')}<form class="form card" id="create-form" novalidate>
    <div class="field"><label>Lobby code</label><div class="row"><strong class="code" id="lobby-code">${c}</strong><button class="btn outline" type="button" id="regenerate">Regenerate</button><button class="btn outline" type="button" id="copy-code">Copy</button></div></div>
    <div class="field"><label for="password">Password</label><input id="password" minlength="4" required autocomplete="off" placeholder="At least 4 characters"><small class="muted">Players use the code and this password to check in and follow the courts.</small></div>
    <div class="field"><label>Courts</label><div class="row stepper"><button class="btn outline" type="button" id="court-minus" aria-label="Fewer courts">−</button><strong id="court-count">${courts}</strong><button class="btn outline" type="button" id="court-plus" aria-label="More courts">+</button></div></div>
    <div class="field rule-setting"><label class="rule-toggle"><input id="win-by-two" type="checkbox" checked><span>Win by 2 / Deuce Rule</span><strong id="deuce-label">YES</strong></label><small class="muted" id="deuce-help"></small></div>
    <div class="info-note"><b>Next: player check-in.</b> After you create the lobby, players check themselves in with their name and skill level. You can also add walk-ins yourself.</div>
    <p class="error" id="create-error" role="alert"></p>
    <div class="sticky"><button class="btn primary wide" type="submit">Create Lobby &amp; Open Check-In</button></div></form>`, 'create');
  const deuceHelp = () => {
    const on = $('win-by-two').checked;
    $('deuce-label').textContent = on ? 'YES' : 'NO';
    $('deuce-help').textContent = on
      ? 'Games go to 11 and must be won by 2. No timer.'
      : `Games go to 11 with no deuce (11–10 wins). Each game also has a ${TIMER_MS / 60000}-minute timer. When time is up, the team that is ahead wins.`;
  };
  deuceHelp();
  $('win-by-two').onchange = deuceHelp;
  $('court-minus').onclick = () => { $('court-count').textContent = String((courts = Math.max(1, courts - 1))); };
  $('court-plus').onclick = () => { $('court-count').textContent = String((courts = Math.min(MAX_COURTS, courts + 1))); };
  $('regenerate').onclick = () => { $('lobby-code').textContent = c = code(); };
  $('copy-code').onclick = () => copyText(c, 'Code copied!');
  $('create-form').onsubmit = (e) => {
    e.preventDefault();
    const password = $('password').value;
    if (password.length < 4) { $('create-error').textContent = 'Password must be at least 4 characters.'; $('password').focus(); return; }
    const res = store.create({ code: c, password, courts, winByTwo: $('win-by-two').checked });
    if (!res.ok) { $('create-error').textContent = res.error; return; }
    localStorage.setItem(`rally-host:${c}`, '1');
    nav('#/host/' + c);
  };
}

function copyText(text, message) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(message), () => toast('Copy failed. Select and copy it manually.'));
  else toast('Copy is not supported in this browser.');
}

// ---------------------------------------------------------------- join

function join() {
  const preset = new URLSearchParams(route().split('?')[1] || '').get('code') || localStorage.getItem('rally-last') || '';
  frame(`${head('Join a lobby')}<form class="form card" id="join-form"><div class="field"><label for="join-code">Lobby code</label><input id="join-code" maxlength="5" autocapitalize="characters" autocomplete="off" required value="${esc(preset.toUpperCase())}"></div><div class="field"><label for="join-password">Password</label><input id="join-password" type="password" required></div><p class="error" id="join-error" role="alert"></p><button class="btn primary wide">Join Lobby</button></form>`, 'join');
  $('join-code').oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
  $('join-form').onsubmit = (e) => {
    e.preventDefault();
    const c = $('join-code').value.trim().toUpperCase();
    const r = store.join(c, $('join-password').value);
    if (!r.ok) { $('join-error').textContent = r.reason; return; }
    localStorage.setItem('rally-last', c);
    sessionStorage.setItem(`rally-joined:${c}`, '1');
    nav('#/lobby/' + c);
  };
}

// ---------------------------------------------------------------- lobby screens

function watch(c, host) {
  if (state.code !== c || state.host !== host) state.tab = 'courts';
  state.code = c;
  state.host = host;
  state.unsub = store.subscribe(c, (lobby) => {
    state.lobby = lobby;
    if (!lobby) return frame(`${head('Lobby not found')}<div class="card"><p>There is no open play with the code <b>${esc(c)}</b> on this device. Check the code and try again.</p><button class="btn primary" data-go="#/join">Join a Lobby</button></div>`, 'missing');
    if (lobby.status === 'ended') { state.viewKey = 'ended'; return finalResults(c, lobby, host); }
    if (lobby.status === 'checkin') return checkinScreen(lobby, host);
    return dashboard(lobby, host);
  });
}

function refresh() {
  const l = state.lobby;
  if (l?.status === 'checkin') checkinScreen(l, state.host);
  else if (l?.status === 'live') dashboard(l, state.host);
}

const myName = (lobby) => {
  const saved = localStorage.getItem(meKey(lobby.code));
  const p = saved && findPlayer(lobby, saved);
  return p ? p.name : null;
};

function checkinForm(lobby, { host }) {
  const id = host ? 'host' : 'self';
  return `<form class="card checkin-card" id="checkin-form" novalidate>
    <h3>${host ? 'Add a walk-in player' : 'Check in'}</h3>
    <p class="muted">${host ? 'For players without a phone. They can also check themselves in.' : 'Enter your name and pick the level that fits your game best. It is used to build balanced matches.'}</p>
    <div class="field"><label for="ci-name">${host ? 'Player name' : 'Your name'}</label><input id="ci-name" maxlength="${NAME_MAX}" autocomplete="off" placeholder="e.g. Chloe"></div>
    <div class="field"><label>Skill level</label>${levelPicker(`ci-level-${id}`, '')}</div>
    <p class="error" id="ci-error" role="alert"></p>
    <button class="btn primary wide" type="submit">${host ? 'Check In Player' : 'Check Me In'}</button></form>`;
}
function bindCheckin(lobby, host) {
  const form = $('checkin-form');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const name = $('ci-name').value, level = pickedLevel(form, `ci-level-${host ? 'host' : 'self'}`);
    const res = store.mutate(lobby.code, (l) => checkIn(l, name, level));
    if (!res.ok) { $('ci-error').textContent = res.error; return; }
    toast(res.rejoined ? `Welcome back, ${res.name}!` : `${res.name} is checked in!`);
    if (!host) { localStorage.setItem(meKey(lobby.code), res.name); refresh(); return; }
    // The store re-rendered the screen, so look the fresh form up again.
    $('ci-name').value = '';
    $('checkin-form')?.querySelectorAll('input[type=radio]').forEach((r) => { r.checked = false; });
    $('ci-name').focus();
  };
}

function levelSummary(players) {
  const counts = LEVELS.map((l) => [l, players.filter((p) => p.level === l.id).length]).filter(([, n]) => n);
  if (!counts.length) return '';
  return `<div class="level-summary">${counts.map(([l, n]) => `<span>${levelTag(l.id)} ${n}</span>`).join('')}</div>`;
}

function checkinScreen(lobby, host) {
  const players = lobby.players;
  const me = host ? null : myName(lobby);
  const n = activePlayers(lobby).length;
  const list = players.length
    ? `<ol class="player-list">${players.map((p, i) => `<li><span class="pl-num">${i + 1}</span>${playerName(lobby, p.name, { me })}<span class="pl-level">${esc(levelInfo(p.level).label)}</span>${host ? `<button class="icon-btn" data-remove="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button>` : ''}</li>`).join('')}</ol>`
    : '<p class="empty">No one has checked in yet.</p>';
  const usable = Math.min(lobby.courts, Math.floor(n / 4));
  const startHint = n < 4 ? `Need ${4 - n} more player${4 - n === 1 ? '' : 's'} to start.` : usable < lobby.courts ? `${plural(n, 'player')}: ${plural(usable, 'court')} will be used until more check in.` : `${plural(n, 'player')} · ${plural(lobby.courts, 'court')} · ${ruleText(lobby)}`;
  const share = host
    ? `<div class="card share-card"><div><span class="label">Lobby code</span><strong class="code">${esc(lobby.code)}</strong></div><div><span class="label">Password</span><strong class="share-pass">${esc(lobby.password)}</strong></div><button class="btn outline" id="copy-invite">Copy Invite</button></div>`
    : '';
  const mine = !host && me
    ? `<div class="card me-card"><span class="me-check">✓</span><div><b>You're checked in, ${esc(me)}</b><p class="muted">${esc(levelInfo(findPlayer(lobby, me).level).label)} · Waiting for the host to start.</p></div><button class="btn outline" id="not-me">Not you?</button></div>`
    : '';
  const settingsCard = host
    ? `<div class="card"><h3>Lobby setup</h3><div class="setup-row"><span>Courts</span><div class="row stepper"><button class="btn outline" id="court-minus" aria-label="Fewer courts">−</button><strong>${lobby.courts}</strong><button class="btn outline" id="court-plus" aria-label="More courts">+</button></div></div><div class="setup-row"><span>Scoring</span><b>${ruleText(lobby)}</b></div></div>`
    : '';
  frame(`<div class="top"><div class="brand">Rally<span>Up</span></div><span class="pill">${host ? 'HOST · CHECK-IN' : 'CHECK-IN OPEN'}</span></div>
    <p class="eyebrow">Lobby ${esc(lobby.code)}</p>
    <h1 class="dashboard-title">${host ? 'Players, check in!' : 'Welcome to open play'}</h1>
    <p class="muted">${host ? 'Share the code and password. Players add their name and skill level, then you start open play.' : `${plural(lobby.courts, 'court')} · ${ruleText(lobby)}`}</p>
    <section class="checkin-grid"><div>${share}${mine}${host || !me ? checkinForm(lobby, { host }) : ''}${settingsCard}</div>
    <div><div class="card"><div class="list-head"><h3>Checked in</h3><span class="pill">${plural(players.length, 'player')}</span></div>${levelSummary(players)}${list}</div></div></section>
    ${host ? `<div class="sticky start-bar"><small class="muted">${esc(startHint)}</small><button class="btn primary wide" id="start-lobby"${n < 4 ? ' disabled' : ''}>Start Open Play</button></div>` : '<div class="action-row"><button class="btn outline" data-go="#/">Leave Lobby</button></div>'}`, `checkin:${lobby.code}:${host}`);
  bindCheckin(lobby, host);
  $('not-me')?.addEventListener('click', () => { localStorage.removeItem(meKey(lobby.code)); refresh(); });
  if (!host) return;
  $('copy-invite').onclick = () => copyText(`Join my RallyUp open play!\n${location.origin}${location.pathname}#/join?code=${lobby.code}\nCode: ${lobby.code}\nPassword: ${lobby.password}`, 'Invite copied!');
  app.querySelectorAll('[data-remove]').forEach((b) => { b.onclick = () => act((l) => removePlayer(l, b.dataset.remove), `${b.dataset.remove} removed.`); });
  $('court-minus').onclick = () => act((l) => setCourts(l, l.courts - 1));
  $('court-plus').onclick = () => act((l) => setCourts(l, l.courts + 1));
  $('start-lobby').onclick = () => {
    const usable = Math.min(lobby.courts, Math.floor(n / 4));
    confirmModal('Start open play?', `RallyUp will build balanced matchups for ${plural(n, 'player')} on ${plural(usable, 'court')}. Players can still check in later and will join the upcoming games.`, 'Start Open Play', () => {
      act((l) => startLobby(l), 'Open play started! Tap Start Match on each court when players are ready.');
    });
  };
}

// ---------------------------------------------------------------- dashboard

function dashboard(lobby, host) {
  const me = !host ? myName(lobby) : null;
  const tabs = [['courts', 'Courts'], ['matchups', 'Matchups'], ['players', 'Players'], ...(host ? [['settings', 'Settings']] : [])];
  if (!tabs.some(([id]) => id === state.tab)) state.tab = 'courts';
  const body = { courts: courtsTab, matchups: matchupsTab, players: playersTab, settings: settingsTab }[state.tab](lobby, host, me);
  frame(`<div class="top"><div class="brand">Rally<span>Up</span> <small>/ OPEN PLAY</small></div><span class="pill">${host ? 'HOST CONTROLS' : '👀 VIEW ONLY'}</span></div>
    <h1 class="dashboard-title">${host ? 'Let’s play, everyone.' : 'Watch the rally.'}</h1>
    <p class="muted">${esc(lobby.code)} · ${plural(lobby.courts, 'court')} · ${plural(activePlayers(lobby).length, 'player')} · ${ruleText(lobby)}</p>
    ${me ? meBanner(lobby, me) : ''}
    ${!host && !me ? `<details class="card late-checkin"><summary>Arriving late? <b>Check in here</b></summary>${checkinForm(lobby, { host: false })}</details>` : ''}
    <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${state.tab === id ? 'active' : ''}" aria-selected="${state.tab === id}">${label}</button>`).join('')}</div>
    <section id="dashboard-content">${body.html}</section>`, `dash:${lobby.code}:${host}:${state.tab}`);
  app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.tab; dashboard(state.lobby, host); }; });
  bindCheckin(lobby, false);
  body.bind?.();
  tickTimers();
}

function meBanner(lobby, me) {
  const live = liveMatches(lobby).find((m) => matchPlayers(m).includes(me));
  const p = findPlayer(lobby, me);
  let text;
  if (p.active === false) text = 'You are marked as away. Ask the host to bring you back.';
  else if (live) text = `You're on <b>Court ${live.court}</b> now! ${isStarted(live) ? 'Game on.' : 'Head to the court.'}`;
  else {
    const pending = pendingMatches(lobby);
    const idx = pending.findIndex((m) => matchPlayers(m).includes(me));
    text = idx < 0 ? 'Resting. You will be added to the next matchups.' : idx < lobby.courts ? `<b>You're up next</b> in Match #${pending[idx].id}. Stay close!` : `Your next game is <b>Match #${pending[idx].id}</b> (${plural(idx, 'match', 'matches')} ahead of you).`;
  }
  return `<div class="me-banner">${playerName(lobby, me, { me })}<span>${text}</span></div>`;
}

function courtCard(lobby, court, host, me) {
  const m = liveMatches(lobby).find((x) => x.court === court);
  if (!m) {
    const waiting = pendingMatches(lobby).length;
    return `<article class="card court is-idle"><h3>Court ${court}</h3><p class="muted">${waiting ? 'Waiting for players to come off another court.' : 'No more matchups in the queue. Add more in Settings.'}</p></article>`;
  }
  const started = isStarted(m), timed = isTimed(lobby);
  const status = !started ? '<span class="court-status ready">READY</span>' : '<span class="court-status live"><span class="court-live-dot"></span>LIVE</span>';
  const timer = started
    ? `<div class="court-timer${timed ? '' : ' elapsed'}" data-timer data-start="${m.startedAt}" data-duration="${timed ? TIMER_MS : 0}" aria-live="off">${timed ? fmt(timeLeft(m, lobby)) : fmt(Date.now() - m.startedAt)}</div>`
    : timed ? `<div class="court-timer idle">${fmt(TIMER_MS)}</div>` : '';
  const buttons = host
    ? `<div class="court-actions">${started ? `<button class="btn ${isTimeUp(m, lobby) ? 'primary' : 'dark'} score-button" data-score="${m.id}">${isTimeUp(m, lobby) ? 'Time’s Up · Enter Score' : 'Enter Score'}</button>` : `<button class="btn primary start-button" data-start="${m.id}">Start Match</button>`}<button class="btn outline change-button" data-change="${m.id}">Change Player</button></div>`
    : '';
  return `<article class="card court ${started ? 'is-playing' : 'is-ready'}${isTimeUp(m, lobby) ? ' is-timeup' : ''}" data-match="${m.id}">
    <h3>Court ${court} <span class="pill">Match #${m.id}</span>${status}</h3>${timer}
    <div class="matchup-board"><div class="matchup-team"><div class="team-icon team-a">A</div><div class="team-copy"><div class="team-label">TEAM A</div><div class="team-line">${teamHtml(lobby, m.teamA, { me })}</div></div></div>
    <div class="matchup-divider"><span></span><b>VS</b><span></span></div>
    <div class="matchup-team"><div class="team-icon team-b">B</div><div class="team-copy"><div class="team-label">TEAM B</div><div class="team-line">${teamHtml(lobby, m.teamB, { me })}</div></div></div></div>
    ${!started && host ? `<p class="court-hint">${timed ? `The ${TIMER_MS / 60000}-minute timer starts when you tap Start Match.` : 'Tap Start Match when all four players are on court.'}</p>` : ''}${buttons}</article>`;
}

function leaderboardCard(lobby) {
  const ranked = rankLive(stats(lobby.players, lobby.matches));
  return `<div class="card dashboard-board"><h2>Leaderboard</h2><p class="muted">Every player. Every rally.</p><div class="table-wrap"><table class="leaderboard"><thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>+/-</th></tr></thead><tbody>${ranked.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.wins}</td><td>${p.losses}</td><td>${p.diff > 0 ? '+' : ''}${p.diff}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function courtsTab(lobby, host, me) {
  const courts = Array.from({ length: lobby.courts }, (_, i) => courtCard(lobby, i + 1, host, me)).join('');
  const next = pendingMatches(lobby).slice(0, 3);
  const upNext = next.length
    ? `<div class="card up-next"><h3>Up next</h3>${next.map((m) => `<div class="queue-row"><span class="pill">#${m.id}</span><span>${teamHtml(lobby, m.teamA, { me })} <b class="vs-small">vs</b> ${teamHtml(lobby, m.teamB, { me })}</span></div>`).join('')}</div>`
    : '';
  const low = host && pendingMatches(lobby).length < lobby.courts ? '<p class="info-note">The matchup queue is running low. Add more in <b>Settings</b>.</p>' : '';
  return {
    html: `<div class="dashboard-grid"><div><div class="courts">${courts}</div>${low}${upNext}<div class="card action-row"><button class="btn outline" data-tab-go="matchups">View Full Matchup List</button>${host ? '<button class="btn danger" id="end-tournament">End Open Play</button>' : '<button class="btn outline" data-go="#/">Leave Lobby</button>'}</div></div>${leaderboardCard(lobby)}</div>`,
    bind() {
      app.querySelectorAll('[data-tab-go]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.tabGo; dashboard(state.lobby, host); }; });
      app.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => { act((l) => startMatch(l, +b.dataset.start), (r) => `Court ${r.court}: match started!${isTimed(lobby) ? ` ${TIMER_MS / 60000}:00 on the clock.` : ''}`); }; });
      app.querySelectorAll('[data-score]').forEach((b) => { b.onclick = () => scoreModal(+b.dataset.score); });
      app.querySelectorAll('[data-change]').forEach((b) => { b.onclick = () => changePlayerModal(+b.dataset.change); });
      $('end-tournament')?.addEventListener('click', () => confirmModal('End open play?', 'Final standings will be shown to everyone. Matches without a score will not count.', 'End Open Play', () => act((l) => endLobby(l)), true));
    },
  };
}

function matchupsTab(lobby, host, me) {
  const row = (m) => {
    const label = m.status === 'live' ? `<span class="pill pill-live">Court ${m.court}</span>` : m.status === 'done' ? '<span class="pill">Done</span>' : '<span class="pill pill-next">Upcoming</span>';
    const score = m.status === 'done' ? `<strong class="m-score">${m.scoreA}–${m.scoreB}</strong>` : '';
    const mine = me && matchPlayers(m).includes(me) ? ' is-mine' : '';
    return `<div class="matchup-row${mine}"><strong>#${m.id}</strong>${label}<span class="m-teams"><span class="${m.winner === 'A' ? 'won' : ''}">${teamHtml(lobby, m.teamA, { me })}</span> <b class="vs-small">vs</b> <span class="${m.winner === 'B' ? 'won' : ''}">${teamHtml(lobby, m.teamB, { me })}</span></span>${score}</div>`;
  };
  const section = (title, list, empty) => `<div class="card"><div class="list-head"><h3>${title}</h3><span class="pill">${list.length}</span></div>${list.length ? list.map(row).join('') : `<p class="empty">${empty}</p>`}</div>`;
  return {
    html: `<p class="muted">Upcoming matchups can shift when players check in, leave, or courts finish in a different order. Level tags: ${LEVELS.map((l) => `${levelTag(l.id)} ${esc(l.label)}`).join(' · ')}</p>
      ${section('On court', liveMatches(lobby), 'No live matches.')}${section('Upcoming', pendingMatches(lobby), 'The queue is empty.')}${section('Completed', doneMatches(lobby).reverse(), 'No scores yet.')}`,
  };
}

function playersTab(lobby, host, me) {
  const games = gamesPlayed(lobby);
  const st = Object.fromEntries(stats(lobby.players, lobby.matches).map((s) => [s.name, s]));
  const live = liveMatches(lobby), pending = pendingMatches(lobby);
  const status = (p) => {
    if (p.active === false) return '<span class="status away">Away</span>';
    const onCourt = live.find((m) => matchPlayers(m).includes(p.name));
    if (onCourt) return `<span class="status oncourt">Court ${onCourt.court}</span>`;
    const next = pending.find((m) => matchPlayers(m).includes(p.name));
    return next ? `<span class="status">Next #${next.id}</span>` : '<span class="status">Resting</span>';
  };
  const rows = lobby.players.map((p) => `<tr class="${p.active === false ? 'is-away' : ''}"><td>${playerName(lobby, p.name, { me })}</td><td>${host
    ? `<select class="level-select" data-level="${esc(p.name)}" aria-label="Skill level for ${esc(p.name)}">${LEVELS.map((l) => `<option value="${l.id}"${l.id === p.level ? ' selected' : ''}>${esc(l.label)}</option>`).join('')}</select>`
    : esc(levelInfo(p.level).label)}</td><td>${games[p.name] || 0}</td><td>${st[p.name].wins}-${st[p.name].losses}</td><td>${status(p)}</td>${host ? `<td><button class="btn outline mini" data-away="${esc(p.name)}" data-active="${p.active === false ? '1' : '0'}">${p.active === false ? 'Bring Back' : 'Mark Away'}</button></td>` : ''}</tr>`).join('');
  return {
    html: `<div class="card"><div class="list-head"><h3>Players</h3><span class="pill">${plural(activePlayers(lobby).length, 'active player')}</span></div>${levelSummary(activePlayers(lobby))}
      <div class="table-wrap"><table class="leaderboard players-table"><thead><tr><th>Player</th><th>Level</th><th>Games</th><th>W-L</th><th>Status</th>${host ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      ${host ? '<p class="muted small">Changing a level or marking someone away rebuilds the upcoming matchups. Live courts are never changed.</p>' : ''}</div>
      ${host ? checkinForm(lobby, { host: true }) : ''}`,
    bind() {
      if (!host) return;
      bindCheckin(lobby, true);
      app.querySelectorAll('[data-level]').forEach((s) => { s.onchange = () => act((l) => setPlayerLevel(l, s.dataset.level, s.value), `${s.dataset.level} is now ${levelInfo(s.value).label}. Upcoming matchups rebalanced.`); });
      app.querySelectorAll('[data-away]').forEach((b) => {
        b.onclick = () => {
          const back = b.dataset.active === '1';
          act((l) => setPlayerActive(l, b.dataset.away, back), back ? `${b.dataset.away} is back in the rotation.` : `${b.dataset.away} is marked away.`);
        };
      });
    },
  };
}

function settingsTab(lobby) {
  const pending = pendingMatches(lobby).length;
  return {
    html: `<div class="settings-grid">
      <div class="card"><h3>Courts</h3><p class="muted">A new court gets the next matchup. Only a court whose match has not started can be removed.</p><div class="row stepper"><button class="btn outline" id="court-minus" aria-label="Remove a court">−</button><strong>${lobby.courts}</strong><button class="btn outline" id="court-plus" aria-label="Add a court">+</button></div></div>
      <div class="card"><h3>Matchup list</h3><p class="muted">Upcoming matchups: <strong>${pending}</strong>. New matchups are added to the end of the list.</p><div class="row"><input id="matchup-amount" class="num-input" type="number" min="1" max="100" step="1" value="5" aria-label="Number of matchups to add"><button class="btn primary" id="match-plus">Add Matchups</button><button class="btn outline" id="match-minus"${pending ? '' : ' disabled'}>Remove Last</button></div></div>
      <div class="card"><h3>Scoring</h3><p class="muted">${isTimed(lobby) ? `No deuce: first to 11. Every game has a ${TIMER_MS / 60000}-minute timer that starts with Start Match. When it ends, enter the score and the leading team wins.` : 'Win by 2: games go to 11 and must be won by 2 points.'}</p></div>
      <div class="card"><h3>Players</h3><p class="muted">Add walk-ins, change levels, or mark players away from the Players tab.</p><button class="btn outline" data-tab-go="players">Open Players</button></div>
      <div class="card"><h3>End open play</h3><p class="muted">Shows the final standings to everyone in the lobby.</p><button class="btn danger" id="end-tournament">End Open Play</button></div></div>`,
    bind() {
      app.querySelectorAll('[data-tab-go]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.tabGo; dashboard(state.lobby, true); }; });
      $('court-plus').onclick = () => act((l) => setCourts(l, l.courts + 1), (r) => `Now using ${plural(r.courts, 'court')}.`);
      $('court-minus').onclick = () => act((l) => setCourts(l, l.courts - 1), (r) => `Now using ${plural(r.courts, 'court')}.`);
      $('match-plus').onclick = () => {
        const amount = Number($('matchup-amount').value);
        act((l) => addMatchups(l, amount), (r) => `${plural(r.added, 'matchup')} added.`);
      };
      $('match-minus').onclick = () => confirmModal('Remove last matchup?', 'The last upcoming matchup will be deleted. Live and completed matches are not affected.', 'Remove', () => act((l) => removeLastMatchup(l), (r) => `Matchup #${r.removedId} removed.`));
      $('end-tournament').onclick = () => confirmModal('End open play?', 'Final standings will be shown to everyone. Matches without a score will not count.', 'End Open Play', () => act((l) => endLobby(l)), true);
    },
  };
}

// ---------------------------------------------------------------- score entry

function scoreModal(id) {
  const lobby = store.get(state.code);
  const m = lobby?.matches.find((x) => x.id === id && x.status === 'live');
  if (!m) { toast('This match is no longer on court.'); return; }
  const timed = isTimed(lobby), up = isTimeUp(m, lobby);
  const rule = timed
    ? (up ? 'Time is up. Enter the current score. The team that is ahead wins.' : 'First to 11, no deuce (11–10 wins). If the timer runs out first, the leading team wins.')
    : 'Game to 11, win by 2.';
  const modal = openModal(`<h2>Court ${m.court} · Enter Score</h2><p class="muted">${up ? '<b class="timeup-text">⏱ Time’s up!</b> ' : ''}${rule}</p>
    <div class="score-grid"><label class="score-team"><span>Team A</span><small>${esc(m.teamA.join(' & '))}</small><input id="score-a" type="number" inputmode="numeric" min="0" max="99" placeholder="0" autofocus></label>
    <label class="score-team"><span>Team B</span><small>${esc(m.teamB.join(' & '))}</small><input id="score-b" type="number" inputmode="numeric" min="0" max="99" placeholder="0"></label></div>
    <p class="error" id="score-error" role="alert"></p><div class="row"><button class="btn outline" data-close>Cancel</button><button class="btn primary" id="score-submit">Save Score</button></div>`, 'score-modal');
  const submit = () => {
    const a = modal.$('#score-a').value, b = modal.$('#score-b').value;
    const fresh = store.get(state.code);
    const current = fresh?.matches.find((x) => x.id === id && x.status === 'live');
    if (current) {
      const v = validateScore(a, b, { winByTwo: !isTimed(fresh), timeUp: isTimeUp(current, fresh) });
      if (!v.ok) { modal.$('#score-error').textContent = v.message; return; }
    }
    const res = store.mutate(state.code, (l) => submitScore(l, id, a, b));
    if (!res.ok) { modal.$('#score-error').textContent = res.error; return; }
    modal.close();
    toast(res.nextId ? `Score saved! Match #${res.nextId} is ready on Court ${res.court}.` : 'Score saved!');
  };
  modal.$('#score-submit').onclick = submit;
  modal.el.querySelectorAll('input').forEach((input) => { input.onkeydown = (e) => { if (e.key === 'Enter') submit(); }; });
}

// ---------------------------------------------------------------- change player

function changePlayerModal(id) {
  const lobby = store.get(state.code);
  const m = lobby?.matches.find((x) => x.id === id && x.status === 'live');
  if (!m) { toast('This match is no longer on court.'); return; }
  const pick = (team, label) => `<div class="change-team"><span class="team-label">${label}</span>${team.map((p) => `<button class="change-player" data-out="${esc(p)}">${playerName(lobby, p)}<span class="chev">›</span></button>`).join('')}</div>`;
  const modal = openModal(`<h2>Change Player</h2><p class="muted">Court ${m.court} · Match #${m.id}. Who needs to be replaced?</p>${pick(m.teamA, 'TEAM A')}${pick(m.teamB, 'TEAM B')}<div class="row"><button class="btn outline" data-close>Cancel</button></div>`, 'change-modal');
  modal.el.querySelectorAll('[data-out]').forEach((b) => { b.onclick = () => { modal.close(); chooseMethodModal(id, b.dataset.out); }; });
}

function chooseMethodModal(id, out) {
  const lobby = store.get(state.code);
  const subs = lobby ? availableSubs(lobby, id) : [];
  const modal = openModal(`<h2>Replace ${esc(out)}</h2><p class="muted">${subs.length ? `${plural(subs.length, 'player')} available (not on a live court).` : 'Everyone else is on a court right now. Try again when a court finishes.'}</p>
    <div class="method-grid"><button class="method-card" id="method-manual"${subs.length ? '' : ' disabled'}><b>Manual Change</b><span>Choose who comes in from the available players.</span></button>
    <button class="method-card" id="method-random"${subs.length ? '' : ' disabled'}><b>Random Change</b><span>RallyUp picks a random available player.</span></button></div>
    <p class="muted small">The incoming player's next upcoming match is given to ${esc(out)}, so both still play the same number of games.</p>
    <div class="row"><button class="btn outline" id="method-back">Back</button></div>`, 'change-modal');
  modal.$('#method-back').onclick = () => { modal.close(); changePlayerModal(id); };
  modal.$('#method-manual').onclick = () => { modal.close(); manualPickModal(id, out); };
  modal.$('#method-random').onclick = () => {
    const res = act((l) => randomSubstitute(l, id, out));
    if (res) { modal.close(); toast(subMessage(res)); }
  };
}

function manualPickModal(id, out) {
  const lobby = store.get(state.code);
  const outPlayer = findPlayer(lobby, out);
  const games = gamesPlayed(lobby);
  const pending = pendingMatches(lobby);
  const target = levelInfo(outPlayer?.level).value;
  const subs = availableSubs(lobby, id).sort((a, b) => Math.abs(levelInfo(a.level).value - target) - Math.abs(levelInfo(b.level).value - target) || games[a.name] - games[b.name] || a.name.localeCompare(b.name));
  const rows = subs.map((p) => {
    const next = pending.find((m) => matchPlayers(m).includes(p.name));
    return `<button class="sub-option" data-in="${esc(p.name)}">${playerName(lobby, p.name)}<span class="sub-meta">${plural(games[p.name] || 0, 'game')} · ${next ? `next #${next.id}` : 'not scheduled'}</span></button>`;
  }).join('');
  const modal = openModal(`<h2>Who replaces ${esc(out)}?</h2><p class="muted">Available players, closest skill level first.</p><div class="sub-list">${rows || '<p class="empty">No one is available right now.</p>'}</div><div class="row"><button class="btn outline" id="manual-back">Back</button></div>`, 'change-modal');
  modal.$('#manual-back').onclick = () => { modal.close(); chooseMethodModal(id, out); };
  modal.el.querySelectorAll('[data-in]').forEach((b) => {
    b.onclick = () => {
      const res = act((l) => substitute(l, id, out, b.dataset.in));
      if (res) { modal.close(); toast(subMessage(res)); }
    };
  });
}

const subMessage = (r) => `${r.inName} is in for ${r.outName}.${r.handoverId ? ` ${r.outName} takes ${r.inName}'s spot in Match #${r.handoverId}.` : ''}`;

// ---------------------------------------------------------------- timers

function fmt(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
const alerted = new Set();
function tickTimers() {
  const now = Date.now();
  document.querySelectorAll('[data-timer]').forEach((el) => {
    const start = Number(el.dataset.start), duration = Number(el.dataset.duration);
    if (!duration) { el.textContent = fmt(now - start); return; }
    const left = duration - (now - start);
    const card = el.closest('.court');
    el.textContent = left > 0 ? fmt(left) : 'TIME’S UP';
    card?.classList.toggle('is-final-minute', left > 0 && left <= 60000);
    if (left <= 0 && card && !card.classList.contains('is-timeup')) {
      card.classList.add('is-timeup');
      const btn = card.querySelector('.score-button');
      if (btn) { btn.textContent = 'Time’s Up · Enter Score'; btn.classList.replace('dark', 'primary'); }
      const id = card.dataset.match;
      if (state.host && !alerted.has(id) && left > -5000) {
        alerted.add(id);
        toast(`${card.querySelector('h3')?.firstChild?.textContent.trim() || 'Court'}: time’s up! Enter the score.`);
        beep();
      }
    }
  });
}
function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* sound is optional */ }
}

