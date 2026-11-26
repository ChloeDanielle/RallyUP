// Local demo adapter: lobbies live in localStorage and tabs stay in sync via
// BroadcastChannel + the storage event. Every change goes through mutate(),
// which always starts from the latest saved lobby (never a stale copy held by
// the UI) and refuses to save anything validateLobby() rejects.
import { createLobby, repairLobby, validateLobby, LobbyError } from './logic.js';

const KEY = 'rallyup-lobbies';
let channel;
try { channel = new BroadcastChannel('rallyup'); } catch { /* not supported */ }
const local = new Set();

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function writeAll(all) {
  localStorage.setItem(KEY, JSON.stringify(all));
  channel?.postMessage('update');
  local.forEach((fn) => fn());
}
function load(code) {
  const all = readAll();
  if (!all[code]) return null;
  const { lobby, changed } = repairLobby(all[code]);
  if (changed && !validateLobby(lobby).length) {
    all[code] = lobby;
    localStorage.setItem(KEY, JSON.stringify(all));
  }
  return lobby;
}

export const store = {
  create(data) {
    const all = readAll();
    if (all[data.code]) return { ok: false, error: 'That lobby code is taken. Regenerate it.' };
    try { all[data.code] = createLobby(data); } catch (e) { return { ok: false, error: e.message }; }
    writeAll(all);
    return { ok: true };
  },
  get: load,
  join(code, password) {
    const lobby = load(code);
    if (!lobby) return { ok: false, reason: 'Lobby not found.' };
    if (lobby.password !== password) return { ok: false, reason: 'Wrong password.' };
    return { ok: true, lobby };
  },
  // Calls cb(lobby) now and whenever the stored lobby actually changes.
  subscribe(code, cb) {
    let last;
    const fire = () => {
      const lobby = load(code);
      const json = JSON.stringify(lobby);
      if (json === last) return;
      last = json;
      cb(lobby);
    };
    const onStorage = (e) => { if (!e.key || e.key === KEY) fire(); };
    local.add(fire);
    channel?.addEventListener('message', fire);
    window.addEventListener('storage', onStorage);
    fire();
    return () => {
      local.delete(fire);
      channel?.removeEventListener('message', fire);
      window.removeEventListener('storage', onStorage);
    };
  },
  // fn(lobby) edits a fresh copy and may return extra info for the caller.
  mutate(code, fn) {
    const all = readAll();
    if (!all[code]) return { ok: false, error: 'Lobby not found.' };
    const { lobby } = repairLobby(all[code]);
    let extra;
    try {
      extra = fn(lobby) || {};
    } catch (e) {
      if (e instanceof LobbyError) return { ok: false, error: e.message };
      console.error(e);
      return { ok: false, error: 'Something went wrong. Nothing was changed.' };
    }
    const errors = validateLobby(lobby);
    if (errors.length) {
      console.error('RallyUp rejected an unsafe change:', errors);
      return { ok: false, error: 'That change would break the lineup, so it was cancelled.' };
    }
    lobby.rev = (lobby.rev || 0) + 1;
    all[code] = lobby;
    writeAll(all);
    return { ok: true, lobby, ...extra };
  },
};
