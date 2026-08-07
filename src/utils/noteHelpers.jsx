export function loadLocal(key) { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
export function saveLocal(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[localStorage] save failed for "${key}":`, err.name, err.message);
    return false;
  }
}
export function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
export function previewText(body) { return (body || '').replace(/~~(.*?)~~/g, '$1').replace(/==(.*?)==/g, '$1').replace(/\n/g, ' ').trim(); }
export function wordsOf(note) {
  return new Set(((note.title || '') + ' ' + (note.body || '') + ' ' + (note.checklist || []).map((i) => i.text).join(' ')).toLowerCase().match(/[a-z0-9']+/g) || []);
}
export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
export function sortChecklistItems(items) {
  return items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.checked === b.it.checked ? a.i - b.i : a.it.checked ? 1 : -1)).map((x) => x.it);
}
export function isFullyStruck(line) {
  return /~~.+?~~/.test(line);
}
export function reorderBodyByStrike(body) {
  const lines = body.split('\n');
  return lines.map((l, i) => ({ l, i })).sort((a, b) => {
    const as = isFullyStruck(a.l), bs = isFullyStruck(b.l);
    return as === bs ? a.i - b.i : as ? 1 : -1;
  }).map((x) => x.l).join('\n');
}

export function wordCount(str) { return (str || '').trim().split(/\s+/).filter(Boolean).length; }
export function previewPlan(note) {
  const mode = note.mode || 'note';
  if (mode !== 'both') return { showBody: mode === 'note', showChecklist: mode === 'list' };
  const bodyWords = wordCount(previewText(note.body));
  const checklistWords = (note.checklist || []).reduce((sum, it) => sum + wordCount(it.text), 0);
  if (bodyWords === 0 && checklistWords === 0) return { showBody: true, showChecklist: false };
  const bigger = Math.max(bodyWords, checklistWords);
  const smaller = Math.min(bodyWords, checklistWords);
  const relativelySimilar = bigger > 0 && smaller / bigger >= 0.6;
  if ((bodyWords > 10 && checklistWords > 10) || relativelySimilar) return { showBody: true, showChecklist: true };
  return checklistWords > bodyWords ? { showBody: false, showChecklist: true } : { showBody: true, showChecklist: false };
}

