import {SKILL_DEFINITIONS} from './skills.js';

const ATTEMPT_KEY = 'math-speedy.attempts.v1';
const SKILL_KEY = 'math-speedy.skills.v1';
const MAX_ATTEMPTS = 3000;

function validAttempt(value) {
  return value && typeof value.sessionId === 'string' && value.sessionId.length <= 100 &&
    value.operation === 'tambah' && Object.hasOwn(SKILL_DEFINITIONS, value.skillId) &&
    typeof value.strategyId === 'string' && Number.isInteger(value.a) && Number.isInteger(value.b) &&
    Number.isFinite(value.userAnswer) && Number.isFinite(value.correctAnswer) &&
    typeof value.correct === 'boolean' && typeof value.hintUsed === 'boolean' &&
    Number.isFinite(value.responseMs) && value.responseMs >= 0 && value.responseMs <= 3600000 &&
    Number.isFinite(Date.parse(value.timestamp));
}

export function readAttempts(storage) {
  try {
    const data = JSON.parse(storage.getItem(ATTEMPT_KEY));
    return Array.isArray(data) ? data.filter(validAttempt).slice(-MAX_ATTEMPTS) : [];
  } catch { return []; }
}

export function summarizeSkill(attempts, skillId) {
  const history = attempts.filter(item => item.skillId === skillId);
  const recent = history.slice(-20);
  const correct = history.filter(item => item.correct).length;
  const recentCorrect = recent.filter(item => item.correct).length;
  const recentAccuracy = recent.length ? Math.round(recentCorrect / recent.length * 100) : null;
  const sessions = new Set(history.map(item => item.sessionId)).size;
  let status = 'NEW';
  if (history.length > 0) status = 'LEARNING';
  if (history.length >= 8 && recentAccuracy >= 80) status = 'STABLE';
  if (history.length >= 15 && recentAccuracy >= 90 && sessions >= 2) status = 'MASTERED';
  return {attempts:history.length,correct,recentAccuracy,status,sessions,lastPracticed:history.at(-1)?.timestamp || null};
}

export function readSkillProgress(storage) {
  try {
    const data = JSON.parse(storage.getItem(SKILL_KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}

export function saveAttempt(storage, attempt) {
  if (!validAttempt(attempt)) return false;
  try {
    const attempts = [...readAttempts(storage), attempt].slice(-MAX_ATTEMPTS);
    storage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));
    const progress = readSkillProgress(storage);
    progress[attempt.skillId] = summarizeSkill(attempts, attempt.skillId);
    storage.setItem(SKILL_KEY, JSON.stringify(progress));
    return true;
  } catch { return false; }
}

export function findWeakSkill(attempts, sessionId) {
  const sessionAttempts = attempts.filter(item => item.sessionId === sessionId);
  const candidates = Object.keys(SKILL_DEFINITIONS).map(skillId => {
    const all = attempts.filter(item => item.skillId === skillId);
    const session = sessionAttempts.filter(item => item.skillId === skillId);
    const errors = session.filter(item => !item.correct).length;
    const recent = all.slice(-20);
    const accuracy = recent.length ? Math.round(recent.filter(item => item.correct).length / recent.length * 100) : 100;
    return {skillId,title:SKILL_DEFINITIONS[skillId].title,attempts:all.length,sessionAttempts:session.length,errors,accuracy};
  }).filter(item => item.attempts >= 3 && item.errors >= 2 && item.accuracy < 80);
  candidates.sort((a,b) => b.errors-a.errors || a.accuracy-b.accuracy || b.sessionAttempts-a.sessionAttempts);
  return candidates[0] || null;
}

export const LEARNING_STORAGE_KEYS = Object.freeze({attempts:ATTEMPT_KEY,skills:SKILL_KEY});
