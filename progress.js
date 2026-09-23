const KEY = 'math-speedy.progress.v1';
const OPS = ['tambah', 'kurang', 'kali', 'bagi', 'campuran', 'iq', 'aimath', 'akar'];
const LEVELS = ['mudah', 'sedang', 'sulit'];

function validSession(s) {
  return s && typeof s.id === 'string' && Number.isFinite(Date.parse(s.at)) &&
    OPS.includes(s.operation) && LEVELS.includes(s.difficulty) &&
    Number.isInteger(s.answered) && s.answered > 0 && s.answered <= 10 &&
    Number.isInteger(s.score) && s.score >= 0 && s.score <= s.answered &&
    ['completed', 'timeout', 'lives', 'quit'].includes(s.reason);
}

export function readProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(KEY));
    return Array.isArray(data) ? data.filter(validSession).slice(-500) : [];
  } catch { return []; }
}

export function saveSession(storage, session) {
  if (!validSession(session)) return false;
  try {
    const sessions = readProgress(storage).filter(s => s.id !== session.id);
    storage.setItem(KEY, JSON.stringify([...sessions, session].slice(-500)));
    return true;
  } catch { return false; }
}

export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function summarizeProgress(sessions, now = new Date()) {
  const valid = sessions.filter(validSession).filter(s => new Date(s.at) <= now);
  const todayKey = dayKey(now);
  const days = Array.from({length: 7}, (_, i) => {
    const date = new Date(now); date.setDate(date.getDate() - 6 + i);
    const key = dayKey(date);
    const daily = valid.filter(s => dayKey(new Date(s.at)) === key);
    return {key, label: new Intl.DateTimeFormat('id-ID', {weekday: 'short'}).format(date), answered: daily.reduce((n, s) => n + s.answered, 0)};
  });
  const answered = valid.reduce((n, s) => n + s.answered, 0);
  const score = valid.reduce((n, s) => n + s.score, 0);
  const activeDays = new Set(valid.map(s => dayKey(new Date(s.at))));
  let streak = 0;
  const cursor = new Date(now);
  if (!activeDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const byOperation = OPS.map(operation => {
    const history = valid.filter(s => s.operation === operation);
    const count = history.reduce((n, s) => n + s.answered, 0);
    return {operation, answered: count, accuracy: count ? Math.round(history.reduce((n, s) => n + s.score, 0) / count * 100) : null};
  });
  return {answered, score, accuracy: answered ? Math.round(score / answered * 100) : null,
    completed: valid.filter(s => s.reason === 'completed').length, sessions: valid.length, streak, days,
    today: days[6].answered, byOperation,
    recent: [...valid].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3)};
}

// Kurva belajar: akurasi kumulatif setelah tiap sesi terakhir (terlama → terbaru).
// Naik berarti makin akurat seiring latihan; turun berarti perlu fokus ulang.
export function sessionTrend(sessions, now = new Date()) {
  const valid = sessions.filter(validSession).filter(s => new Date(s.at) <= now)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-12);
  let score = 0, answered = 0;
  return valid.map(s => {
    score += s.score; answered += s.answered;
    return { at: s.at, operation: s.operation, accuracy: Math.round(score / answered * 100), answered };
  });
}
