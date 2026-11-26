export const app = document.querySelector('#app');
// One toast at a time: a new message replaces the previous one.
export function toast(s) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const e = document.createElement('div');
  e.className = 'toast';
  e.setAttribute('role', 'status');
  e.textContent = s;
  document.body.append(e);
  const live = document.getElementById('live-region');
  if (live) live.textContent = s;
  setTimeout(() => e.remove(), 3500);
}
export function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function nav(h) { location.hash = h; }
