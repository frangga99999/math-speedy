import { generateChallenge, generateIQ, generateTableChallenge, GUIDE_TOPICS, METHODS, CHAT_STARTERS, frameStory, referenceRows, calculate, hintFor } from './engine.js';
import { readProgress, saveSession, summarizeProgress, sessionTrend } from './progress.js';
import {findWeakSkill,readAttempts,saveAttempt,readSkillProgress} from './mastery.js';
import {SKILL_DEFINITIONS} from './skills.js';

const app = document.querySelector('#app');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const TOTAL = 10;
const sessionTotal = () => state.targetSkill ? 5 : TOTAL;
const TIME_BY_DIFFICULTY = { mudah: 120, sedang: 80, sulit: 60 };
const sessionSeconds = () => state.timeMode === 'custom' ? state.customSeconds : (TIME_BY_DIFFICULTY[state.difficulty] ?? 80);
const clockLabel = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const operations = {
  aimath: {symbol:'∇',label:'Asisten Belajar',short:'Tanya AI'},
  iq: {symbol:'⋯', label:'Latihan IQ', short:'Pola angka'},
  tambah: { symbol: '+', label: 'Penjumlahan', short: 'Tambah', example: '8 + 4', answer: '12', color: 'mint' },
  kurang: { symbol: '−', label: 'Pengurangan', short: 'Kurang', example: '8 − 4', answer: '4', color: 'peach' },
  kali: { symbol: '×', label: 'Perkalian', short: 'Kali', example: '8 × 4', answer: '32', color: 'blue' },
  bagi: { symbol: '÷', label: 'Pembagian', short: 'Bagi', example: '8 ÷ 4', answer: '2', color: 'lilac' },
  campuran: { symbol: '±×', label: 'Operasi Campuran', short: 'Campuran' },
  akar: { symbol: '√', label: 'Akar', short: 'Akar', example: '√144', answer: '12', color: 'gold' },
  kuadrat: { symbol: '²', label: 'Kuadrat', short: 'Kuadrat', example: '7² = 49', color: 'gold' },
  kubik: { symbol: '³', label: 'Pangkat tiga', short: 'Kubik', example: '5³ = 125', color: 'blue' },
};
const TABLE_OPS = ['tambah','kurang','kali','bagi','akar','kuadrat','kubik'];
const NO_REFERENCE_OPS = ['akar','kuadrat','kubik'];
const OP_ACCENTS = { mint:'127,224,176', peach:'255,176,138', blue:'123,184,255', lilac:'195,166,255', gold:'255,210,127' };
const BASIC_OPS = ['tambah','kurang','kali','bagi'];
const levels = { mudah: { label: 'Mudah', hint: 'Angka 0–10' }, sedang: { label: 'Sedang', hint: 'Angka 0–50' }, sulit: { label: 'Sulit', hint: 'Angka 0–100' } };
const state = { screen: 'home', operation: 'kali', difficulty: 'mudah', question: null, previous: '', index: 0, score: 0, lives: 5, input: '', loading: false, feedback: '', error: '', answered: 0, engine: 'default', digits: null, history: [], remaining: 80, questionStartedAt:0, hintUsed:false, targetSkill:null, targetTitle:'' };
let requestId = 0;
let requestController;
let nextQuestionTimer;
let aiPrefetch = null;
let sessionClock;
let clockTick = 0;
let stageObserver;
let simTimer;
state.iqTopic='mixed'; state.iqTest=false; state.tableOp='tambah'; state.tableGroup=0;
state.tableMode=null; state.tableNumber=null; state.tableLabel=''; state.tableLo=1; state.tableHi=10;
state.guideTopic=null; state.guideMaterial=null; state.messages=null; state.chatBusy=false; state.chatImage=null; state.simFrame=0; state.simPlaying=false;
state.timeMode='preset'; state.customSeconds=90;
let aiConnected = false;
let aiConfigured = false;
let aiModel = '';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.7M20 4v7h-7"/>',
  delete: '<path d="M10 9l6 6m0-6-6 6M3 12l5-7h13v14H8l-5-7Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  chart: '<path d="M5 20v-6M12 20V6M19 20v-9"/><path d="M3 20h18"/>',
  grid: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="15" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/>',
};
const svg = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
const brand = () => `<a href="#home" class="brand" aria-label="Math Speedy, beranda"><span class="brand-mark">${svg('bolt', 23)}</span><span>math<span class="brand-light">speedy</span><i></i></span></a>`;
const bars = count => `<span class="level-bars" aria-hidden="true">${[1, 2, 3].map(n => `<i class="${n <= count ? 'lit' : ''}"></i>`).join('')}</span>`;
// Header kaca yang sama di semua halaman: wordmark di tengah, Asisten di kanan,
// tombol kembali (bila ada) di kiri.
const appHeader = (back = null) => `<header class="app-topbar">${back ? `<button class="topbar-icon" id="${back.id}" aria-label="${back.label}">${svg(back.icon, 20)}</button>` : '<span class="topbar-slot" aria-hidden="true"></span>'}<a href="#home" class="brand wordmark" aria-label="Math Speedy, beranda">SpeedyMath</a><button class="home-account" id="account" aria-label="Pengaturan Asisten Belajar">${svg('spark', 20)}<i class="${aiConnected ? 'connected' : ''}"></i></button></header>`;

function animate(element, frames, options = {}) {
  if (!element || motionPreference.matches) return;
  return element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
}

function enterScreen() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  animate(app.firstElementChild, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420 });
  app.querySelectorAll('.operation, .key, .guide-tile').forEach((element, index) => {
    animate(element, [{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 330, delay: index * 22 });
  });
}

function goHome() {
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stopSim();
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.targetSkill=null;state.targetTitle='';
  state.tableMode=null;
  state.screen = 'home';
  renderHome();
  enterScreen();
}

function progressSummary() {
  try { return summarizeProgress(readProgress(localStorage)); }
  catch { return summarizeProgress([]); }
}

// Akurasi tiap operasi, terlemah dulu — langsung terlihat apa yang perlu dilatih.
function abilityChart(progress) {
  const rows = [...BASIC_OPS, 'campuran', 'akar'].map(op => {
    const stats = progress.byOperation.find(item => item.operation === op);
    return stats && stats.answered ? { label: operations[op].label, symbol: operations[op].symbol, accuracy: stats.accuracy, color: operations[op].color } : null;
  }).filter(Boolean).sort((a, b) => a.accuracy - b.accuracy);
  if (!rows.length) return '';
  return `<section class="ability-card" aria-labelledby="ability-title"><div class="section-heading"><h2 id="ability-title">Akurasi per operasi</h2><span>terlemah dulu</span></div><div class="ability-list">${rows.map(r => `<div class="ability-row"><span class="ability-symbol" style="--op:${OP_ACCENTS[r.color] || OP_ACCENTS.mint}">${r.symbol}</span><span class="ability-name">${r.label}</span><div class="ability-track"><i style="--w:${r.accuracy}%;--op:${OP_ACCENTS[r.color] || OP_ACCENTS.mint}"></i></div><span class="ability-value">${r.accuracy}%</span></div>`).join('')}</div></section>`;
}

// Kemajuan mikro-skill penjumlahan: Baru → Belajar → Mantap → Tuntas.
function masteryChart() {
  const progress = readSkillProgress(localStorage);
  const STATUS = { NEW:{label:'Baru',cls:'new'}, LEARNING:{label:'Belajar',cls:'learning'}, STABLE:{label:'Mantap',cls:'stable'}, MASTERED:{label:'Tuntas',cls:'mastered'} };
  const rows = Object.entries(SKILL_DEFINITIONS).map(([id, def]) => {
    const p = progress[id];
    return { title: def.title, attempts: p?.attempts || 0, accuracy: p?.recentAccuracy ?? null, status: STATUS[p?.status || 'NEW'] };
  }).filter(r => r.attempts > 0);
  if (!rows.length) return '';
  return `<section class="mastery-card" aria-labelledby="mastery-title"><div class="section-heading"><h2 id="mastery-title">Penguasaan penjumlahan</h2><span>mikro-skill</span></div><div class="mastery-list">${rows.map(r => `<div class="mastery-row"><div class="mastery-head"><span class="mastery-title">${r.title}</span><span class="mastery-status ${r.status.cls}">${r.status.label}</span></div><div class="mastery-track"><i style="--w:${r.accuracy ?? 0}%"></i></div></div>`).join('')}</div></section>`;
}

// Kurva belajar akurasi kumulatif — naik berarti makin akurat, turun perlu fokus ulang.
function trendChart() {
  let trend;
  try { trend = sessionTrend(readProgress(localStorage)); } catch { return ''; }
  if (trend.length < 2) return '';
  const min = Math.min(...trend.map(t => t.accuracy));
  const span = Math.max(...trend.map(t => t.accuracy)) - min || 1;
  return `<section class="trend-card" aria-labelledby="trend-title"><div class="section-heading"><h2 id="trend-title">Kurva belajar</h2><span>akurasi kumulatif · ${trend.length} sesi</span></div><div class="trend-chart" role="img" aria-label="Akurasi kumulatif dari ${trend[0].accuracy}% menjadi ${trend[trend.length - 1].accuracy}% dalam ${trend.length} sesi terakhir">${trend.map((t, i) => `<div class="trend-column"><span class="trend-count">${t.accuracy}</span><div class="trend-track"><i style="--h:${Math.max(10, (t.accuracy - min) / span * 100)}%;--i:${i}"></i></div><span class="trend-op">${operations[t.operation].symbol}</span></div>`).join('')}</div></section>`;
}

// Kebiasaan: seberapa sering sesi dituntaskan dan rata-rata skor per sesi.
function habitStats(progress) {
  if (!progress.sessions) return '';
  const rate = Math.round(progress.completed / progress.sessions * 100);
  const avg = Math.round(progress.score / progress.sessions);
  return `<section class="habit-card" aria-label="Kebiasaan latihan"><div class="habit-grid"><div><strong>${rate}%</strong><span>Sesi tuntas</span></div><div><strong>${avg}</strong><span>Rata-rata skor / sesi</span></div><div><strong>${progress.sessions}</strong><span>Total sesi</span></div></div><p class="habit-note">${rate >= 80 ? 'Konsisten menuntaskan latihan — pertahankan!' : rate >= 50 ? 'Sebagian sesi belum tuntas. Selesaikan sampai akhir untuk hasil maksimal.' : 'Banyak sesi terhenti. Coba sesi pendek dulu agar mudah dituntaskan.'}</p></section>`;
}

function bottomNav(active) {
  const items = [['home','Latihan','bolt'], ['tracker','Progres','chart'], ['guide','Panduan','book']];
  return `<nav class="bottom-nav" aria-label="Menu utama">${items.map(([id,label,icon]) => `<button class="nav-item ${active===id?'active':''}" data-nav="${id}" aria-current="${active===id?'page':undefined}"><span class="nav-icon">${svg(icon, 22)}</span><span class="nav-label">${label}</span></button>`).join('')}</nav>`;
}

function renderHome() {
  const progress = progressSummary();
  app.innerHTML = `
    <section class="dashboard-home" aria-label="Latihan">
      ${appHeader()}
      <div class="home-main-panel">
        <div class="home-hero">
          <div class="hero-visual" aria-hidden="true">
            <div class="hero-orbit orbit-a"></div>
            <div class="hero-orbit orbit-b"></div>
            <div class="hero-core">${svg('spark', 32)}</div>
            <span class="hero-mote mote-plus">+</span><span class="hero-mote mote-mult">×</span><span class="hero-mote mote-div">÷</span><span class="hero-mote mote-pi">π</span>
          </div>
          <span class="streak-pill">${svg('bolt', 13)} ${progress.streak} hari beruntun</span>
        </div>
        <div class="practice-heading"><h2>Pilih latihan</h2><span>10 soal · ${sessionSeconds()} detik</span></div>
        <div class="practice-menu">
          ${Object.entries(operations).filter(([key]) => ['iq','tambah','kurang','kali','bagi','campuran'].includes(key)).map(([key, op]) => {
            const stats = progress.byOperation.find(item => item.operation === key);
            return `<button class="practice-pill" data-practice="${key}"><span class="practice-symbol">${op.symbol}</span><span class="practice-name">${op.label}</span>${stats.answered ? `<span class="practice-accuracy">${stats.accuracy}%</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="home-extras">
        <button class="ai-feature" id="show-tables"><span class="ai-feature-icon">${svg('grid', 22)}</span><span><strong>Tabel Perhitungan</strong><small>Hafal tabel tambah, kurang, kali, bagi, akar, kuadrat & kubik · 1 sampai 30</small></span>${svg('arrow', 20)}</button>
        <button class="ai-feature" id="ai-practice"><span class="ai-feature-icon">${svg('spark', 25)}</span><span><strong>Asisten Belajar</strong><small>${aiConnected ? 'Siap membuat soal & visual' : aiConfigured ? 'Model pribadi siap diuji' : 'Penjelasan visual per soal'}</small></span>${svg('arrow', 20)}</button>
        <section class="recent-section" aria-labelledby="recent-title"><div class="section-heading"><h2 id="recent-title">Latihan terakhir</h2><span>Di perangkat ini</span></div>${progress.recent.length ? `<div class="recent-list">${progress.recent.map(session => `<button class="recent-item" data-practice="${session.operation}" data-level="${session.difficulty}" aria-label="Ulangi ${operations[session.operation].label}, ${levels[session.difficulty].label}"><span class="recent-symbol">${operations[session.operation].symbol}</span><span class="recent-name"><strong>${operations[session.operation].label}</strong><small>${levels[session.difficulty].label} · ${new Intl.DateTimeFormat('id-ID', {day:'numeric', month:'short'}).format(new Date(session.at))} · ${session.reason === 'completed' ? 'Tuntas' : 'Belum tuntas'}</small></span><span class="recent-score">${session.score}<small>/${session.answered}</small></span>${svg('refresh', 16)}</button>`).join('')}</div>` : `<div class="history-empty">${svg('grid', 25)}<div><strong>Belum ada latihan</strong><p>Hasil latihanmu akan muncul di sini.</p></div></div>`}</section>
        <footer class="dashboard-footer"><span class="footer-dot"></span> Progres tersimpan otomatis di perangkat ini</footer>
      </div>
    </section>
    ${bottomNav('home')}`;
}

function renderTracker() {
  const progress = progressSummary();
  const goal = Math.min(progress.today / TOTAL, 1);
  const maxDay = Math.max(TOTAL, ...progress.days.map(day => day.answered));
  app.innerHTML = `
    <section class="tracker-screen" aria-label="Progres">
      ${appHeader()}
      <div class="tracker-content">
        <div class="tracker-heading"><h1>Jejak progresmu</h1><span class="streak-pill">${svg('bolt', 13)} ${progress.streak} hari</span></div>
        <section class="training-dashboard" aria-label="Progres latihan">
          <div class="visual-progress ${motionPreference.matches ? 'motion-paused' : ''}">
            <div class="glass-orbit orbit-a" aria-hidden="true"></div><div class="glass-orbit orbit-b" aria-hidden="true"></div>
            <span class="math-mote mote-a" aria-hidden="true">+</span><span class="math-mote mote-b" aria-hidden="true">∑</span><span class="math-mote mote-c" aria-hidden="true">×</span>
            <div class="daily-ring" style="--goal:${goal*100}%" role="img" aria-label="Target harian ${progress.today} dari ${TOTAL} soal"><div><strong>${progress.today}</strong><span>/ ${TOTAL} soal</span>${goal>=1?svg('check',18):''}</div></div>
            <span class="visual-status">${goal>=1?'Target tercapai':'Target harian'}</span><button class="motion-toggle" id="toggle-motion" aria-label="Jeda animasi" aria-pressed="false">Ⅱ</button>
          </div>
          <div class="dashboard-stats"><div><strong>${progress.accuracy === null ? '—' : progress.accuracy + '%'}</strong><span>Akurasi</span></div><div><strong>${progress.answered}</strong><span>Soal dijawab</span></div><div><strong>${progress.completed}</strong><span>Sesi tuntas</span></div></div>
        </section>
        <section class="weekly-card" aria-labelledby="weekly-title"><div class="section-heading"><h2 id="weekly-title">Ritme minggu ini</h2><span>${progress.days.reduce((n, d) => n + d.answered, 0)} soal</span></div><div class="weekly-chart" role="img" aria-label="${progress.days.map(day => `${day.label}: ${day.answered} soal`).join(', ')}">${progress.days.map((day, i) => `<div class="day-column ${i === 6 ? 'today' : ''}"><span class="day-count">${day.answered || '–'}</span><div class="day-track"><i style="--bar-height:${Math.max(day.answered ? 8 : 0, day.answered / maxDay * 100)}%;--i:${i}"></i></div><span>${day.label}</span></div>`).join('')}</div></section>
        ${abilityChart(progress)}${masteryChart()}${trendChart()}${habitStats(progress)}
        <footer class="dashboard-footer"><span class="footer-dot"></span> Progres tersimpan otomatis di perangkat ini</footer>
      </div>
    </section>
    ${bottomNav('tracker')}`;
}

function showTracker() {
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stopSim();
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.screen = 'tracker';
  renderTracker();
  enterScreen();
}

function navigate(tab) {
  if (tab === 'home') goHome();
  else if (tab === 'tracker') showTracker();
  else if (tab === 'guide') showGuide();
}

const IQ_TOPICS={mixed:'Campuran',basic:'Tambah & kurang',multiply:'Pola perkalian',growing:'Selisih bertingkat',alternate:'Pola bergantian',square:'Pola kuadrat',fibonacci:'Jumlah berantai',double:'Dobel + satu',mixedops:'Operasi bergantian',analogy:'Analogi angka',oddone:'Ganjil satu keluar',matrix:'Matriks angka',logic:'Logika & rasio'};
function showIQMenu(){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  openDialog(`<button class="dialog-close" data-close aria-label="Tutup pilihan IQ">${svg('close')}</button><span class="eyebrow">PENALARAN NUMERIK</span><h2>Pilih latihan</h2><button class="iq-test-feature" id="start-iq-test"><span>${svg('spark',24)}</span><strong>Tes penalaran<small>10 soal adaptif · dibuat Asisten Belajar</small></strong>${svg('arrow',18)}</button><div class="topic-grid">${Object.entries(IQ_TOPICS).map(([id,label],i)=>`<button data-iq-topic="${id}"><span>${['⋯','±','×','↗','⇄','²','∞','2×','±×','↔','≠','▦','⚖'][i]}</span>${label}</button>`).join('')}</div>`);
}
function timeOptionsMarkup() {
  const presets = [30, 60, 90, 120, 180];
  return `<div class="time-section" role="group" aria-label="Pengaturan waktu">
    <span class="time-section-label">Waktu tantangan</span>
    <div class="time-mode-tabs"><button data-time-mode="preset" aria-pressed="${state.timeMode==='preset'}">${svg('bolt', 14)} Tantangan waktu</button><button data-time-mode="custom" aria-pressed="${state.timeMode==='custom'}">${svg('clock', 14)} Waktu manual</button></div>
    <div class="time-custom" id="time-custom" ${state.timeMode==='custom'?'':'hidden'}>
      <div class="time-readout"><strong id="time-value">${state.customSeconds}</strong><span>detik</span></div>
      <input type="range" id="time-range" min="15" max="300" step="15" value="${state.customSeconds}" aria-label="Durasi manual dalam detik">
      <div class="time-presets">${presets.map(s => `<button data-time-preset="${s}" aria-pressed="${state.customSeconds===s}">${s}s</button>`).join('')}</div>
    </div>
  </div>`;
}

function digitOptionsMarkup() {
  const current = state.digits ?? '';
  const options = [['', 'Bebas'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
  return `<div class="digit-options" role="group" aria-label="Jumlah digit penjumlahan"><span class="digit-options-label">Digit penjumlahan</span><div class="digit-options-row">${options.map(([v, l]) => `<button data-digits="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}</div></div>`;
}

function showSetup(operation = state.operation) {
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  state.targetSkill=null;state.targetTitle='';
  state.tableMode=null;
  state.operation = operation;
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup pengaturan">${svg('close')}</button><span class="eyebrow">10 SOAL · <span id="setup-time">${sessionSeconds()}</span> DETIK · 5 NYAWA</span><h2>${operation==='iq'?IQ_TOPICS[state.iqTopic]:operations[operation].label}</h2>
    <div class="difficulty-tabs" role="group" aria-label="Pilih tingkat kesulitan" style="--selected:${Object.keys(levels).indexOf(state.difficulty)}"><span class="difficulty-indicator" aria-hidden="true"></span>${Object.entries(levels).map(([key, level], i) => `<button class="difficulty" data-difficulty="${key}">${bars(i + 1)}${level.label}</button>`).join('')}</div>
    <p class="setup-level-hint" id="level-hint">${levels[state.difficulty].hint}</p>${operation === 'tambah' ? digitOptionsMarkup() : ''}${operation==='iq'?'<button class="text-button" id="iq-back">Ganti jenis pola</button>':''}${operation==='iq'?'':timeOptionsMarkup()}
    <div class="engine-options" ${['iq','campuran','akar'].includes(operation) ? 'hidden' : ''} role="group" aria-label="Sumber soal"><button data-engine="default">Bawaan <span>Gratis</span></button><button data-engine="ai">${svg('spark', 13)} Asisten ${aiConfigured ? '<span>VPS</span>' : '<span>Atur</span>'}</button></div>${['iq','campuran'].includes(operation) ? `<button class="reference-button" id="show-reference">${svg('grid',16)} ${operation === 'iq' ? 'Panduan pola angka' : 'Cara kerja operasi campuran'}</button>` : ''}${operation === 'iq' ? '<p class="iq-note">Latihan logika angka · bukan pengukuran skor IQ.</p>' : ''}${(METHODS[operation]||[]).length?`<details class="method-card"${operation==='campuran'?' open':''}><summary>${svg('spark',14)} Metode yang membantu${operation==='campuran'?' · KUKABATAKU':''}</summary><div class="method-list">${METHODS[operation].map(m=>`<div class="method-item"><strong>${m.name}</strong><p>${m.how}</p></div>`).join('')}</div></details>`:''}<button class="primary-button" id="start"><span>Mulai latihan</span>${svg('arrow', 20)}</button>`);
  dialog.classList.add('practice-dialog');
  updateHomeSelection();
  dialog.querySelector('#time-range')?.addEventListener('input', event => {
    state.customSeconds = Number(event.target.value);
    updateHomeSelection();
  });
}

function showTableMenu() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  openDialog(`<button class="dialog-close" data-close aria-label="Tutup pilihan tabel">${svg('close')}</button><span class="eyebrow">HAFAL TABEL</span><h2>Pilih tabel perhitungan</h2><div class="topic-grid table-topic-grid">${TABLE_OPS.map((id, i) => `<button data-table-op="${id}" style="--op:${OP_ACCENTS[operations[id].color] || OP_ACCENTS.mint};--i:${i}"><span class="topic-symbol">${operations[id].symbol}</span><strong>${operations[id].label}</strong><small>${operations[id].example}</small></button>`).join('')}</div>`);
}
function showTable(op = state.tableOp) {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  state.tableOp = op; state.tableGroup = 0; state.tableNumber = 2;
  const noRef = NO_REFERENCE_OPS.includes(op);
  const groups = [[1,10],[11,20],[21,30]];
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup tabel">${svg('close')}</button><span class="eyebrow">TABEL PERHITUNGAN</span><h2>Tabel ${operations[op].label.toLowerCase()}</h2>${noRef ? '' : `<div class="table-number"><span class="table-number-label">Angka</span><div class="table-number-chips" role="group" aria-label="Pilih angka tabel">${Array.from({length:30},(_,i)=>`<button type="button" data-number="${i+1}" aria-pressed="${i===1}">${i+1}</button>`).join('')}</div></div>`}<div class="table-groups" role="group" aria-label="Kelompok tabel">${groups.map((g,i)=>`<button type="button" data-table-group="${i}" aria-pressed="${i===0}">${g[0]}–${g[1]}</button>`).join('')}</div><div class="table-scroll" id="reference-content"></div><button class="primary-button" id="table-challenge">Mulai tantangan ${svg('arrow',18)}</button><button class="text-button" id="table-back">${svg('back',16)} Pilih tabel lain</button>`);
  dialog.classList.add('reference-dialog');
  dialog.style.setProperty('--op', OP_ACCENTS[operations[op].color] || OP_ACCENTS.mint);
  const noRefCaption = { akar:'Akar kuadrat sempurna', kuadrat:'Kuadrat bilangan', kubik:'Pangkat tiga bilangan' };
  const render = () => {
    const number = noRef ? 2 : state.tableNumber;
    const [lo, hi] = groups[state.tableGroup];
    const caption = noRef ? `${noRefCaption[op]} · ${lo} sampai ${hi}` : `${operations[op].label} dengan ${number} · ${lo} sampai ${hi}`;
    dialog.querySelector('#reference-content').innerHTML = `<table><caption>${caption}</caption><thead><tr><th scope="col">Perhitungan</th><th scope="col">Hasil</th></tr></thead><tbody>${referenceRows(op, number).slice(lo - 1, hi).map((row, i) => `<tr style="--i:${i}"><th scope="row">${row.display || `${row.a} ${row.symbol} ${row.b}`}</th><td>${row.answer}</td></tr>`).join('')}</tbody></table>`;
  };
  render();
  dialog.querySelectorAll('[data-number]').forEach(b => b.addEventListener('click', () => {
    state.tableNumber = Number(b.dataset.number);
    dialog.querySelectorAll('[data-number]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.number === b.dataset.number)));
    render();
  }));
  dialog.querySelectorAll('[data-table-group]').forEach(b => b.addEventListener('click', () => {
    state.tableGroup = Number(b.dataset.tableGroup);
    dialog.querySelectorAll('[data-table-group]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tableGroup === b.dataset.tableGroup)));
    render();
  }));
}

function updateHomeSelection() {
  document.querySelectorAll('[data-engine]').forEach(el => el.setAttribute('aria-pressed', el.dataset.engine === state.engine));
  document.querySelectorAll('[data-difficulty]').forEach(el => {
    const selected = el.dataset.difficulty === state.difficulty;
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', selected);
  });
  document.querySelectorAll('[data-digits]').forEach(el => {
    el.setAttribute('aria-pressed', String(el.dataset.digits) === String(state.digits ?? ''));
  });
  document.querySelector('.difficulty-tabs')?.style.setProperty('--selected', Object.keys(levels).indexOf(state.difficulty));
  const hint = document.querySelector('#level-hint');
  if (hint) hint.textContent = state.operation === 'tambah' && state.digits ? `Angka ${state.digits} digit (${state.digits === 1 ? 0 : 10 ** (state.digits - 1)}–${10 ** state.digits - 1})` : state.operation==='campuran'?({mudah:'Satu langkah · angka kecil',sedang:'Perkalian masuk soal',sulit:'Urutan operasi & tanda kurung'})[state.difficulty] : state.operation === 'iq' ? (state.iqTopic==='mixed'?({mudah:'Selisih tetap',sedang:'Perkalian & selisih bertingkat',sulit:'Pola bergantian & kuadrat'})[state.difficulty]:`${IQ_TOPICS[state.iqTopic]} · ${levels[state.difficulty].label}`) : state.operation === 'akar' ? ({mudah:'Kuadrat 1–12',sedang:'Kuadrat 1–20',sulit:'Kuadrat 1–30'})[state.difficulty] : levels[state.difficulty].hint;
  const time = document.querySelector('#setup-time');
  if (time) time.textContent = sessionSeconds();
  document.querySelectorAll('[data-time-mode]').forEach(el => el.setAttribute('aria-pressed', el.dataset.timeMode === state.timeMode));
  const timeCustom = document.querySelector('#time-custom');
  if (timeCustom) timeCustom.hidden = state.timeMode !== 'custom';
  const timeValue = document.querySelector('#time-value');
  if (timeValue) timeValue.textContent = state.customSeconds;
  const timeRange = document.querySelector('#time-range');
  if (timeRange) timeRange.value = state.customSeconds;
  document.querySelectorAll('[data-time-preset]').forEach(el => el.setAttribute('aria-pressed', Number(el.dataset.timePreset) === state.customSeconds));
}

function renderChallenge() {
  if (state.operation === 'iq' || state.storySession) {
    renderWrittenChallenge();
    return;
  }
  app.innerHTML = `
    <section class="figma-page" aria-label="Latihan hitung">
      <div class="figma-viewport">
        <div class="figma-stage">
          <img class="figma-panel figma-panel-back" src="./assets/figma-panel-back.svg" alt="">
          <img class="figma-panel figma-panel-front" src="./assets/figma-panel-front.svg" alt="">
          <button class="challenge-close" id="exit-challenge" aria-label="Tutup latihan">${svg('close', 19)}</button>
          <header class="figma-status">
            <div class="figma-timing"><span id="timer" aria-label="${state.targetSkill?'Latihan fokus tanpa timer':'Waktu tersisa'}">${state.targetSkill?'FOKUS':clockLabel(state.remaining)}</span><div class="figma-timer-track" role="progressbar" aria-label="${state.targetSkill?'Latihan fokus':'Sisa waktu'}" aria-valuemin="0" aria-valuemax="${sessionSeconds()}" aria-valuenow="${state.remaining}"><i></i><b></b></div></div>
            <div class="figma-lives" aria-label="5 nyawa tersisa">${Array.from({length:5}, () => '<i class="alive"></i>').join('')}</div>
          </header>
          <div class="figma-question">
            <p id="question-prompt">Berapa hasilnya?</p>
            <h1 id="equation" aria-label="Soal"></h1>
          </div>
          <output id="answer" class="figma-answer" aria-label="Jawabanmu" hidden></output>
          <div class="figma-keypad" aria-label="Keypad jawaban">
            ${['1','2','3','4','5','6','7','8','9','hapus','0','help'].map((key,i) => `<button class="figma-key" data-key="${key}" aria-label="${key === 'hapus' ? 'Hapus jawaban' : key === 'help' ? 'Bantuan' : key}" style="--sprite-x:-${40+(i%3)*125}px;--sprite-y:-${318+Math.floor(i/3)*120}px"><span class="sr-only">${key === 'hapus' ? 'Hapus' : key === 'help' ? 'Bantuan' : key}</span></button>`).join('')}
          </div>
          <div class="figma-actions"><button class="figma-giveup" id="giveup"><span class="sr-only">Give Up</span></button><button class="figma-done" id="done"><span class="sr-only">Done</span></button></div>
          <div class="sr-only" id="feedback" role="status" aria-live="polite"></div>
          <div class="success-burst" aria-hidden="true"></div>
        </div>
      </div>
    </section>`;
  const viewport = app.querySelector('.figma-viewport');
  stageObserver?.disconnect();
  stageObserver = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    viewport.style.setProperty('--stage-scale', width / 430);
  });
  stageObserver.observe(viewport);
}

function renderWrittenChallenge() {
  const isStory = state.storySession && BASIC_OPS.includes(state.operation);
  const contextLabel = isStory
    ? `${operations[state.operation].label} · Cerita`
    : state.iqTest ? 'Tes penalaran' : IQ_TOPICS[state.iqTopic] || 'Latihan IQ';
  app.innerHTML = `
    <section class="written-challenge ${isStory ? 'written-story' : 'written-iq'}" aria-label="${isStory ? 'Latihan soal cerita' : 'Latihan pola angka'}">
      <header class="written-header">
        <button class="written-icon-button" id="exit-challenge" aria-label="Tutup latihan">${svg('close', 20)}</button>
        <div class="written-progress-copy"><span id="written-step">Soal 1 dari ${sessionTotal()}</span><strong>${escapeHtml(contextLabel)}</strong></div>
        <div class="written-lives" aria-label="5 nyawa tersisa">${Array.from({length:5}, () => '<i class="alive"></i>').join('')}</div>
      </header>
      <div class="written-timer"><span id="timer" aria-label="Waktu tersisa">${clockLabel(state.remaining)}</span><div class="written-timer-track figma-timer-track" role="progressbar" aria-label="Sisa waktu" aria-valuemin="0" aria-valuemax="${sessionSeconds()}" aria-valuenow="${state.remaining}"><i></i><b></b></div></div>
      <main class="written-body">
        <section class="written-question-card">
          <span class="written-kicker">${isStory ? 'BACA CERITANYA' : 'TEMUKAN POLANYA'}</span>
          <p id="question-prompt">Menyiapkan soal…</p>
          <h1 id="equation" aria-label="Soal">…</h1>
          <div class="question-decoration" aria-hidden="true"><i></i><i></i><i></i></div>
        </section>
        <form class="written-answer-card" id="written-answer-form">
          <label for="written-answer">Jawabanmu</label>
          <div class="written-input-row">
            <input id="written-answer" name="answer" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" enterkeyhint="done" placeholder="Ketik jawaban" aria-describedby="written-answer-help">
            <button type="button" class="written-clear" id="clear-written" aria-label="Hapus jawaban">${svg('close', 18)}</button>
          </div>
          <small id="written-answer-help">Kamu bisa mengetik jawaban panjang dengan keyboard.</small>
          <div class="written-secondary-actions"><button type="button" id="written-help">${svg('spark', 16)} Petunjuk</button><button type="button" id="giveup">Menyerah</button></div>
          <button type="submit" class="written-submit" id="done"><span>Periksa jawaban</span>${svg('arrow', 20)}</button>
        </form>
      </main>
      <div class="sr-only" id="feedback" role="status" aria-live="polite"></div>
      <div class="success-burst" aria-hidden="true"></div>
    </section>`;
  stageObserver?.disconnect();
  const input = app.querySelector('#written-answer');
  input.addEventListener('input', () => {
    const clean = input.value.replace(/\D/g, '').slice(0, 12);
    if (input.value !== clean) input.value = clean;
    state.input = clean.replace(/^0+(?=\d)/, '');
    if (input.value !== state.input) input.value = state.input;
    updateKeypad();
  });
  app.querySelector('#written-answer-form').addEventListener('submit', event => {
    event.preventDefault();
    press('enter');
  });
}

function updateQuestion() {
  const q = state.question;
  const equation = app.querySelector('#equation');
  const storyQ = state.storySession && Boolean(q?.story);
  equation.hidden = storyQ;
  equation.textContent = storyQ ? '' : q ? (q.operation === 'campuran' ? q.display : q.operation === 'iq' ? (q.display || `${q.sequence.join(' · ')} · ?`) : q.operation === 'akar' ? `√${q.a}` : (q.operation === 'kuadrat' || q.operation === 'kubik') ? `${q.a}${q.symbol}` : `${q.a} ${q.symbol} ${q.b}`) : '…';
  equation.classList.toggle('iq-equation', state.operation === 'iq');
  equation.classList.toggle('iq-multiline', state.operation === 'iq' && Boolean(q?.display?.includes('\n')));
  equation.setAttribute('aria-label', q ? q.operation === 'campuran' ? `Operasi campuran: ${q.display}` : q.operation === 'iq' ? (q.display ? q.display.replace(/\n/g, ', ') : `Lanjutkan pola: ${q.sequence.join(', ')}, tanda tanya`) : q.operation === 'akar' ? `Akar dari ${q.a}` : (q.operation === 'kuadrat' || q.operation === 'kubik') ? `${operations[q.operation].label} dari ${q.a}` : `${q.a} ${operations[q.operation].label} ${q.b}` : 'Menyiapkan soal');
  app.querySelector('#question-prompt').textContent = state.loading ? 'Menyiapkan soal…' : state.targetSkill ? `Fokus · ${state.targetTitle}` : state.storySession && q?.story ? `${q.story} ${q.question}` : state.operation === 'iq' ? (q?.prompt || 'Angka berikutnya?') : state.tableMode ? `${state.tableLabel} · berapa hasilnya?` : 'Berapa hasilnya?';
  app.querySelector('.figma-stage, .written-challenge')?.classList.remove('is-correct', 'is-wrong');
  app.querySelector('#feedback').textContent = `Soal ${state.index + 1} dari ${sessionTotal()}. ${state.score} benar.`;
  const writtenStep = app.querySelector('#written-step');
  if (writtenStep) writtenStep.textContent = `Soal ${state.index + 1} dari ${sessionTotal()}`;
  updateAnswer();
  updateKeypad();
  if (q) {
    animate(equation, [{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}]);
    if (app.querySelector('#written-answer') && !motionPreference.matches) setTimeout(() => app.querySelector('#written-answer')?.focus({preventScroll:true}), 220);
  }
}

function updateKeypad() {
  app.querySelectorAll('[data-key]').forEach(el => { el.disabled = state.loading || Boolean(state.feedback) || !state.question; });
  const done = app.querySelector('#done');
  if (done) done.disabled = state.loading || Boolean(state.feedback) || !state.question || (Boolean(app.querySelector('#written-answer')) && !state.input);
  const input = app.querySelector('#written-answer');
  if (input) input.disabled = state.loading || Boolean(state.feedback) || !state.question;
}

function updateAnswer() {
  const answer = app.querySelector('#answer');
  if (answer) {
    answer.hidden = !state.input;
    answer.textContent = state.input ? `= ${state.input}` : '';
    animate(answer, [{opacity:.5,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}], {duration:150});
  }
  const writtenInput = app.querySelector('#written-answer');
  if (writtenInput && writtenInput.value !== state.input) writtenInput.value = state.input;
}

function startClock() {
  clearInterval(sessionClock);
  if(state.targetSkill)return;
  clockTick = performance.now();
  sessionClock = setInterval(() => {
    const now = performance.now();
    const elapsed = (now - clockTick) / 1000;
    clockTick = now;
    if (state.screen !== 'challenge' || state.loading || state.feedback || document.querySelector('dialog[open]')) return;
    state.remaining = Math.max(0, state.remaining - elapsed);
    const seconds = Math.ceil(state.remaining);
    const timer = app.querySelector('#timer');
    if (!timer) return;
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
    const progress = app.querySelector('.figma-timer-track');
    progress.setAttribute('aria-valuenow', seconds);
    progress.querySelector('b').style.transform = `scaleX(${state.remaining / sessionSeconds()})`;
    if (!seconds) finishSession('timeout');
  }, 250);
}

function finishSession(reason = 'completed', destination = 'result') {
  if (state.screen !== 'challenge') return;
  state.reason = reason;
  if (state.answered) {
    let saved = false;
    try { saved = saveSession(localStorage, {id: state.sessionId, at: new Date().toISOString(), operation: state.operation, difficulty: state.difficulty, answered: state.answered, score: state.score, reason, topic:state.storySession?`${state.operation}-cerita`:state.iqTopic}); } catch {}
    if (!saved) showToast('Progres belum dapat disimpan di perangkat ini.');
  }
  clearInterval(sessionClock);
  clearTimeout(nextQuestionTimer);
  requestController?.abort();
  requestId++;
  stageObserver?.disconnect();
  if (destination === 'home') { goHome(); return; }
  state.screen = 'result';
  renderResult();
  enterScreen();
}

function press(key) {
  if (state.screen !== 'challenge' || state.loading || state.feedback || !state.question) return;
  if (key === 'help') { showHelp(); return; }
  animate(app.querySelector(`[data-key="${key}"]`), [{filter:'brightness(1)'},{filter:'brightness(1.22)',offset:.4},{filter:'brightness(1)'}], {duration:200});
  if (key === 'hapus') state.input = '';
  else if (key === 'backspace') state.input = state.input.slice(0,-1);
  else if (key === 'enter') {
    if (!state.input) {
      animate(app.querySelector('#equation'), [0,-5,5,-3,0].map(x => ({transform:`translateX(${x}px)`})), {duration:250});
      app.querySelector('#feedback').textContent = 'Masukkan jawaban dahulu.';
      return;
    }
    const correct = Number(state.input) === calculate(state.question);
    if (state.question.skillId) {
      try { saveAttempt(localStorage, {sessionId:state.sessionId,operation:state.question.operation,difficulty:state.difficulty,skillId:state.question.skillId,strategyId:state.question.strategyId,a:state.question.a,b:state.question.b,userAnswer:Number(state.input),correctAnswer:calculate(state.question),correct,hintUsed:state.hintUsed,responseMs:Math.max(0,Math.round(performance.now()-state.questionStartedAt)),timestamp:new Date().toISOString()}); } catch {}
    }
    state.feedback = correct ? 'correct' : 'wrong';
    state.answered++;
    if (correct) state.score++; else if(!state.targetSkill) state.lives--;
    showFeedback(correct);
    nextQuestionTimer = setTimeout(advanceQuestion, correct ? 900 : 1600);
    return;
  } else if (/^\d$/.test(key)) {
    const maxInputLength = state.operation === 'tambah' && state.digits ? String(2 * (10 ** state.digits - 1)).length : 5;
    if (state.input.length < maxInputLength) state.input = state.input === '0' ? key : state.input + key;
  }
  updateAnswer();
}

function advanceQuestion() {
  if (state.screen !== 'challenge') return;
  if (document.querySelector('dialog[open]')) {
    nextQuestionTimer = setTimeout(advanceQuestion, 150);
    return;
  }
  if (state.lives <= 0) finishSession('lives');
  else if (state.answered >= sessionTotal()) finishSession('completed');
  else { state.index++; state.input = ''; state.feedback = ''; loadQuestion(); }
}

function confirmExit(destination = 'result') {
  if (document.querySelector('dialog[open]')) return;
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup konfirmasi">${svg('close')}</button><div class="exit-dialog-icon">${svg('back', 26)}</div><h2>${destination === 'home' ? 'Keluar dari latihan?' : 'Akhiri latihan ini?'}</h2><p>Jawaban yang sudah dikerjakan tetap disimpan. Sesi ini tidak bisa dilanjutkan.</p><button class="primary-button" data-close autofocus>Lanjut latihan</button><button class="text-button danger-button" id="confirm-exit">${destination === 'home' ? 'Keluar ke beranda' : 'Ya, menyerah'}</button>`);
  dialog.querySelector('#confirm-exit').addEventListener('click', () => {
    dialog.close();
    finishSession('quit', destination);
  });
}

function showFeedback(correct) {
  correct ? sfx.correct() : sfx.wrong();
  app.querySelector('.figma-stage, .written-challenge')?.classList.add(correct ? 'is-correct' : 'is-wrong');
  app.querySelector('#question-prompt').textContent = correct ? 'Jawaban benar!' : `Jawabannya ${calculate(state.question)}`;
  app.querySelector('#feedback').textContent = correct ? 'Jawaban benar.' : `Jawaban salah. Jawaban yang benar ${calculate(state.question)}.`;
  const lives = app.querySelector('.figma-lives, .written-lives');
  lives.setAttribute('aria-label', `${state.lives} nyawa tersisa`);
  if (!correct) {
    if(!state.targetSkill)lives.children[state.lives]?.classList.remove('alive');
    animate(app.querySelector('#answer, #written-answer'), [0,-6,6,-4,0].map(x => ({transform:`translateX(${x}px)`})), {duration:300});
  } else burst(app.querySelector('.success-burst'));
  updateKeypad();
}

function burst(container) {
  if (!container || motionPreference.matches) return;
  container.replaceChildren();
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('i');
    const angle = (i / 12) * Math.PI * 2;
    particle.style.setProperty('--particle-color', ['#c5ef9c', '#a9d9fc', '#f5ae96'][i % 3]);
    container.append(particle);
    const animation = animate(particle, [
      { transform: 'translate(0,0) scale(0)', opacity: 0 },
      { opacity: 1, offset: .15 },
      { transform: `translate(${Math.cos(angle) * 145}px,${Math.sin(angle) * 90}px) rotate(${i * 55}deg) scale(.5)`, opacity: 0 },
    ], { duration: 750, easing: 'cubic-bezier(.1,.7,.3,1)' });
    animation?.addEventListener('finish', () => particle.remove(), { once: true });
  }
}

async function askAIQuestion(settings, signal) {
  const response = await fetch('/api/challenge', {method:'POST', signal, headers:{'Content-Type':'application/json'}, body:JSON.stringify({...settings, engine:'ai', story:state.storySession===true})});
  if (response.status === 401) { location.reload(); throw new Error('auth'); }
  if (!response.ok) throw new Error('AI unavailable');
  return response.json();
}

async function loadQuestion() {
  requestController?.abort();
  requestController = new AbortController();
  const currentRequest = ++requestId;
  state.loading = true;
  state.question = null;
  state.error = '';
  updateQuestion();
  const settings = {operation:state.operation, difficulty:state.difficulty, history:state.history, digits:state.operation === 'tambah' ? state.digits : null, skill:state.targetSkill};
  let question;
  if (state.operation === 'iq' && state.iqTest) {
    try { const response=await fetch('/api/iq-test',{method:'POST',signal:requestController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({difficulty:state.difficulty,history:state.history})}); if(response.status===401){location.reload();return;} const data=await response.json();if(!response.ok)throw new Error(data.error);question=data;if(question.fallback)showToast('AI belum merespons. Soal bawaan digunakan.'); }
    catch(error){if(currentRequest!==requestId||state.screen!=='challenge')return;state.loading=false;updateQuestion();showToast(error.message||'Asisten Belajar belum tersedia.');setTimeout(()=>finishSession('quit'),800);return;}
  }
  else if (state.operation === 'iq') question = generateIQ({...settings,topic:state.iqTopic});
  else if (state.tableMode) question = generateTableChallenge({operation:state.tableMode, number:state.tableNumber, lo:state.tableLo, hi:state.tableHi, history:state.history, previous:state.previous});
  else if (state.engine === 'default' || state.operation === 'campuran' || state.operation === 'akar') question = generateChallenge(settings);
  else {
    const historyKey = state.history.join('|');
    const pending = aiPrefetch && aiPrefetch.historyKey === historyKey ? aiPrefetch.promise : null;
    aiPrefetch = null;
    try {
      question = pending ? await pending : await askAIQuestion(settings, requestController.signal);
      if (!question) throw new Error('AI unavailable');
      if (question.fallback) showToast('AI belum merespons. Soal bawaan digunakan.');
    } catch {
      if (currentRequest !== requestId || state.screen !== 'challenge') return;
      question = generateChallenge(settings);
      showToast('VPS belum tersedia. Soal bawaan digunakan.');
    }
  }
  if (question && state.storySession && !question.story) question = {...question,...frameStory(question)};
  if (currentRequest !== requestId || state.screen !== 'challenge') return;
  state.question = question;
  state.history.push(question.id || `${question.a}:${question.b}`);
  state.loading = false;
  clockTick = performance.now();
  state.questionStartedAt = performance.now();
  state.hintUsed = false;
  updateQuestion();
  // Soal AI berikutnya diambil duluan selagi pengguna menjawab, supaya latensi
  // tunnel (~18-19 detik) tertutup oleh waktu berpikir dan menjawab pengguna.
  if (state.engine === 'ai' && !state.tableMode && !['campuran','akar','iq'].includes(state.operation)) {
    const nextSettings = {operation:state.operation, difficulty:state.difficulty, history:[...state.history], digits:state.operation === 'tambah' ? state.digits : null, skill:state.targetSkill};
    aiPrefetch = { historyKey: state.history.join('|'), promise: askAIQuestion(nextSettings).catch(() => null) };
  }
}

function start() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  clearTimeout(nextQuestionTimer);
  aiPrefetch = null;
  // Sekitar sepertiga sesi operasi dasar tampil sebagai soal cerita: angka sama,
  // bingkainya berubah. Teks cerita butuh layar menulis, bukan keypad kaku.
  state.storySession = !state.tableMode && BASIC_OPS.includes(state.operation) && !state.targetSkill && !state.digits && Math.random() < 0.35;
  Object.assign(state, {sessionId:crypto.randomUUID(),reason:null,screen:'challenge',index:0,score:0,answered:0,lives:5,input:'',feedback:'',previous:'',history:[],remaining:sessionSeconds(),questionStartedAt:0,hintUsed:false});
  renderChallenge();
  enterScreen();
  loadQuestion();
  startClock();
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role','status');
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(),4000);
}

function openDialog(content) {
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.innerHTML = content;
  const heading = dialog.querySelector('h2');
  if (heading) { heading.id = `dialog-${crypto.randomUUID()}`; dialog.setAttribute('aria-labelledby', heading.id); }
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) dialog.close();
  });
  dialog.showModal();
  animate(dialog,[{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}]);
  return dialog;
}

function explanationVisual(data) {
  if(data.visual.type==='bersusun') return guideVisual(data.visual);
  const values=data.visual.values.map(Number);
  if(data.visual.type==='sequence') return `<div class="visual-sequence">${values.map((v,i)=>`<span>${v}${i<values.length-1?'<i>→</i>':''}</span>`).join('')}</div>`;
  if(data.visual.type==='groups') { const groups=Math.min(6,Math.max(1,Number(state.question.b)||2)); return `<div class="visual-groups">${Array.from({length:groups},(_,i)=>`<span><b>${i+1}</b>${Array.from({length:Math.min(8,Math.max(1,Number(state.question.a)||1))},()=>'<i></i>').join('')}</span>`).join('')}</div>`; }
  if(data.visual.type==='number-line') { const [a,b,result]=values; return `<div class="visual-number-line"><span>${a}</span><i style="--distance:${Math.min(100,Math.max(22,Math.abs(b)*9))}%"><b>${state.question.operation==='kurang'?'−':'+'}${b}</b></i><span>${result}</span></div>`; }
  return `<div class="visual-formula"><span>${escapeHtml(data.visual.labels[0]||state.question.display||'Rumus')}</span><i>${svg('arrow',22)}</i><strong>${escapeHtml(data.visual.labels.at(-1)||values.at(-1)||'')}</strong></div>`;
}

async function showHelp() {
  state.hintUsed = true;
  const dialog=openDialog(`<button class="dialog-close" data-close aria-label="Tutup Asisten Belajar">${svg('close')}</button><span class="eyebrow">ASISTEN BELAJAR</span><div class="explanation-loading" role="status"><i></i><i></i><i></i><span>Menyusun visual…</span></div>`);
  dialog.classList.add('explanation-dialog');
  try {
    const response=await fetch('/api/explanation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:state.question})});
    const data=await response.json(); if(!response.ok) throw new Error(data.error||'Penjelasan belum tersedia.');
    let step=0;
    const render=()=>{dialog.innerHTML=`<button class="dialog-close" data-close aria-label="Tutup Asisten Belajar">${svg('close')}</button><span class="eyebrow">ASISTEN BELAJAR · ${step+1}/${data.steps.length}</span><h2>${escapeHtml(data.title)}</h2><div class="explanation-visual">${explanationVisual(data)}</div><div class="explanation-step"><span>LANGKAH ${step+1}</span><p>${escapeHtml(data.steps[step])}</p></div><div class="explanation-dots" aria-hidden="true">${data.steps.map((_,i)=>`<i class="${i===step?'active':''}"></i>`).join('')}</div><div class="explanation-actions"><button class="text-button" id="explain-prev" ${step===0?'disabled':''}>${svg('back',16)} Kembali</button><button class="primary-button" id="explain-next">${step===data.steps.length-1?'Paham':'Lanjut'} ${svg(step===data.steps.length-1?'check':'arrow',17)}</button></div><small class="explanation-source">${data.source==='asisten'?'Dibuat model pribadimu':'Visual lokal'}</small>`; animate(dialog.querySelector('.explanation-visual'),[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],{duration:420});};
    dialog.addEventListener('click',event=>{if(event.target.closest('#explain-prev')){step--;render();}if(event.target.closest('#explain-next')){if(step===data.steps.length-1)dialog.close();else{step++;render();}}});
    render();
  } catch(error) { dialog.innerHTML=`<button class="dialog-close" data-close aria-label="Tutup">${svg('close')}</button><h2>Belum berhasil</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" data-close>Coba nanti</button>`; }
}

function showAccount() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup">${svg('close')}</button><div class="ai-dialog-icon">${svg('spark', 29)}<span class="success-burst" aria-hidden="true"></span></div><span class="eyebrow">ASISTEN BELAJAR</span><h2>${aiConfigured ? 'Model pribadimu siap.' : 'Hubungkan model VPS'}</h2><p>${aiConfigured ? escapeHtml(aiModel) : 'Tambahkan endpoint dan model di konfigurasi server.'}</p><div class="ai-connection-status" role="status">${aiConnected ? 'Siap membuat soal dan penjelasan visual.' : aiConfigured ? 'Uji koneksi untuk mulai.' : 'Visual lokal tetap tersedia.'}</div>${aiConfigured ? `<button class="primary-button" id="test-vps">${svg('refresh',18)} <span>Uji model</span></button><button class="text-button" id="use-vps">Mulai dengan Asisten</button>` : '<button class="primary-button" data-close>Tutup</button>'}`);
  dialog.classList.add('ai-dialog');
  animate(dialog.querySelector('.ai-dialog-icon'), [{transform:'rotate(-30deg) scale(.5)',opacity:0},{transform:'rotate(10deg) scale(1.12)',opacity:1,offset:.7},{transform:'rotate(0) scale(1)',opacity:1}], {duration:600});
  dialog.querySelector('#test-vps')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled=true; button.classList.add('is-testing');
    button.querySelector('span').textContent='Menguji koneksi…';
    const status = dialog.querySelector('.ai-connection-status');
    status.textContent='Meminta satu soal ke model VPS…';
    try {
      const response=await fetch('/api/ai/test',{method:'POST'});
      if (response.status===401) { location.reload(); return; }
      const data=await response.json();
      if (!response.ok) throw new Error(data.error || 'Koneksi belum berhasil.');
      aiConnected=true; status.textContent='Terhubung. Model berhasil membuat soal.';
      status.classList.add('is-connected');
      burst(dialog.querySelector('.ai-dialog-icon .success-burst'));
    } catch(error) { aiConnected=false; status.textContent=error.message; status.classList.remove('is-connected'); }
    finally { button.disabled=false; button.classList.remove('is-testing'); button.querySelector('span').textContent='Uji kembali'; if(state.screen==='home') renderHome(); }
  });
  dialog.querySelector('#use-vps')?.addEventListener('click',()=>{state.engine='ai';dialog.close();showSetup();});
}

async function checkAccount() {
  try {
    const response=await fetch('/api/ai/status');
    if(response.status===401) { location.reload(); return; }
    const data=await response.json();
    aiConnected=data.connected===true; aiConfigured=data.configured===true; aiModel=data.model || '';
    if(state.screen==='home') renderHome();
  } catch { aiConnected=false; }
}

function renderResult() {
  const accuracy = state.answered ? Math.round(state.score / state.answered * 100) : 0;
  const completed = state.reason === 'completed';
  const defeated = state.reason === 'timeout' || state.reason === 'lives';
  const title = completed ? (state.targetSkill ? (state.score>=4?'Nice, mulai kebaca.':'Masih agak goyang.') : state.score === sessionTotal() ? 'Sempurna!' : 'Tantangan selesai!') : state.reason === 'timeout' ? 'Waktu habis' : state.reason === 'lives' ? 'Coba lagi, yuk.' : 'Latihan diakhiri';
  const reasoningIndex=Math.round(accuracy*.8+Math.min(state.answered/sessionTotal(),1)*20);
  let learningInsight=null;
  if(state.operation==='tambah')try{learningInsight=findWeakSkill(readAttempts(localStorage),state.sessionId);}catch{}
  app.innerHTML = `
    <section class="result-screen ${completed ? 'result-completed' : ''}${defeated ? ' result-defeated' : ''}">
      ${appHeader()}
      <div class="result-content">
        <div class="result-medallion">${svg(completed ? 'check' : 'refresh', 57)}<span class="medallion-orbit"></span><span class="medallion-halo"></span></div>
        <span class="eyebrow">${completed ? 'SESI TUNTAS' : `${state.answered} SOAL DIKERJAKAN`}</span>
        <h1 tabindex="-1">${title}</h1>
        <p>${completed ? 'Satu latihan lagi. Satu langkah maju.' : 'Progresmu tetap berarti. Lanjutkan lagi kapan saja.'}</p>
        <div class="result-card"><span>${state.iqTest?'INDEKS PENALARAN':'JAWABAN BENAR'}</span><strong><b id="result-score">${state.iqTest?reasoningIndex:state.score}</b><small>${state.iqTest?' / 100':` / ${state.answered}`}</small></strong><div class="result-stats"><span><b>${accuracy}%</b> Akurasi</span><span><b>${state.answered}/${sessionTotal()}</b> Soal dikerjakan</span></div></div>
        ${state.iqTest?'<p class="iq-result-note">Skor latihan, bukan skor IQ klinis. Tes resmi memerlukan norma populasi dan pengawasan terstandar.</p>':''}
        ${learningInsight&&!state.targetSkill?`<div class="result-insight"><span>YANG MASIH PERLU DIASAH</span><strong>${escapeHtml(learningInsight.title)}</strong><p>${learningInsight.errors} jawaban yang meleset punya pola yang sama.</p><button id="target-practice" data-skill="${learningInsight.skillId}" data-title="${escapeHtml(learningInsight.title)}">Latih 5 soal ${svg('arrow',16)}</button></div>`:''}
        <span class="result-session">${operations[state.operation].label} · ${state.tableMode ? state.tableLabel : levels[state.difficulty].label}${state.storySession?' · Cerita':''}${state.targetSkill?' · Fokus':''}</span>
        <button class="primary-button" id="again"><span>${state.targetSkill?'Ulang fokus':'Latihan lagi'}</span><span class="button-arrow">${svg('refresh', 20)}</span></button>
        <button class="text-button" id="home">${svg('back', 16)} Kembali ke beranda</button>
      </div><div class="completion-confetti" aria-hidden="true"></div>
    </section>`;
  app.querySelector('h1').focus({preventScroll: true});
  if (completed) { celebrateCompletion(); sfx.win(); }
  else if (defeated) playDefeat();
}

function celebrateCompletion() {
  if (motionPreference.matches) return;
  animate(app.querySelector('.result-medallion'), [
    {transform:'translateY(35px) rotate(-35deg) scale(.35)', opacity:0},
    {transform:'translateY(-10px) rotate(6deg) scale(1.12)', opacity:1, offset:.65},
    {transform:'translateY(0) rotate(-8deg) scale(1)', opacity:1}
  ], {duration:850, delay:150, fill:'backwards'});
  app.querySelectorAll('.result-content h1, .result-card, .result-session, .result-content button').forEach((element, i) => {
    animate(element, [{opacity:0, transform:'translateY(18px)'},{opacity:1, transform:'translateY(0)'}], {duration:500, delay:300 + i * 85, fill:'backwards'});
  });
  const container = app.querySelector('.completion-confetti');
  for (let i = 0; i < 48; i++) {
    const particle = document.createElement('i');
    particle.style.left = `${(i * 37 % 100)}%`;
    particle.style.background = ['#bdeab0','#62dcff','#fff3b0','#c3baff'][i % 4];
    particle.style.borderRadius = i % 3 ? '2px' : '50%';
    container.append(particle);
    const animation = animate(particle, [
      {opacity:0, transform:'translateY(-20px) rotate(0) scale(.5)'},
      {opacity:1, offset:.12},
      {opacity:1, offset:.75},
      {opacity:0, transform:`translate(${(i % 7 - 3) * 20}px, 620px) rotate(${i * 49}deg) scale(1)`}
    ], {duration:1800 + i % 5 * 180, delay:200 + i % 8 * 75, easing:'cubic-bezier(.15,.4,.6,1)', fill:'both'});
    animation?.addEventListener('finish', () => particle.remove(), {once:true});
  }
}

// Efek suara sintesis Web Audio: menang, kalah, benar, salah — tanpa berkas audio.
let audioCtx;
function tone(freq, at, dur, { type = 'sine', gain = .12, slide = 0 } = {}) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + at;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + .02);
    amp.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + .05);
  } catch {}
}
const sfx = {
  correct() { tone(660, 0, .12); tone(990, .09, .18); },
  wrong() { tone(220, 0, .22, { type:'sawtooth', gain:.07, slide:-70 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, .24, { gain:.13 })); tone(1319, .52, .5, { gain:.1 }); },
  lose() { tone(320, 0, .32, { type:'triangle', gain:.12, slide:-90 }); tone(240, .3, .55, { type:'triangle', gain:.1, slide:-110 }); },
};

function playDefeat() {
  sfx.lose();
  if (motionPreference.matches) return;
  animate(app.querySelector('.result-medallion'), [
    { transform: 'rotate(-8deg)' },
    { transform: 'rotate(-14deg) scale(.96)', offset: .3 },
    { transform: 'rotate(-3deg)', offset: .6 },
    { transform: 'rotate(-11deg) scale(.98)', offset: .82 },
    { transform: 'rotate(-8deg)' },
  ], { duration: 950, easing: 'ease-in-out' });
  const flash = document.createElement('div');
  flash.className = 'result-flash';
  app.querySelector('.result-screen')?.append(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });
}

// Halaman panduan: daftar isi lengkap, isinya disusun Asisten Belajar per materi.
// Halaman panduan penuh: daftar isi, lalu materi yang disusun Asisten Belajar.
function renderGuide() {
  const topic=state.guideTopic?GUIDE_TOPICS.find(t=>t.id===state.guideTopic):null;
  app.innerHTML = `
    <section class="guide-screen" aria-label="Panduan lengkap">
      ${appHeader()}
      ${topic?renderGuideMaterial(topic):renderGuideToc()}
    </section>
    ${bottomNav('guide')}`;
}

function renderGuideToc() {
  const groups=[...new Set(GUIDE_TOPICS.map(t=>t.group))];
  const accents=['#bdeacb','#f5b39e','#a9d9fc','#c3baff'];
  let index=0;
  return `<div class="guide-content">
    <span class="eyebrow">PANDUAN LENGKAP</span>
    <h1>Pilih materi.</h1>
    <p>Disusun Asisten Belajar: analogi, metode cepat, dan visual.</p>
    <nav class="guide-toc" aria-label="Daftar isi">${groups.map(group => `
      <div class="guide-group"><span class="guide-group-label">${group}</span>
        <div class="guide-grid">${GUIDE_TOPICS.filter(t=>t.group===group).map(t => {
          const accent=accents[index++ % accents.length];
          return `<button class="guide-tile" data-guide-topic="${t.id}" style="--tile-accent:${accent}" aria-label="${t.title}"><span class="tile-icon" data-len="${(t.icon||'').length}" aria-hidden="true">${t.icon||'★'}</span><strong>${t.title}</strong></button>`;
        }).join('')}</div>
      </div>`).join('')}</nav>
    <button class="text-button" id="guide-chat">${svg('spark',16)} Tanya Asisten Belajar</button>
  </div>`;
}

function renderGuideMaterial(topic) {
  const data=state.guideMaterial;
  const back=`<button class="text-button guide-back" id="guide-back">${svg('back',16)} Daftar isi</button>`;
  if(!data) return `<div class="guide-content">${back}<span class="eyebrow">PANDUAN · ${topic.group.toUpperCase()}</span><h1>${topic.title}</h1><div class="guide-loading" role="status"><i></i><i></i><i></i><span>Menyusun materi…</span></div></div>`;
  const methods=data.methods?.length?data.methods:METHODS[topic.id]||[];
  const practice=['tambah','kurang','kali','bagi','campuran','iq'].includes(topic.id);
  return `<div class="guide-content">
    ${back}
    <span class="eyebrow">PANDUAN · ${topic.group.toUpperCase()}</span>
    <h1>${escapeHtml(data.title)}</h1>
    <p class="guide-intro">${escapeHtml(data.intro)}</p>
    ${data.visual?`<div class="explanation-visual guide-visual">${guideVisual(data.visual)}</div>`:''}
    <div class="guide-analogy"><span>ANALOGI</span>${escapeHtml(data.analogy)}</div>
    ${data.simulation?.frames?.length?renderSimulation(data.simulation):''}
    ${methods.length?`<section class="guide-methods" aria-label="Metode"><span class="guide-section-label">METODE YANG MEMBANTU</span><div class="method-list">${methods.map(m=>`<div class="method-item"><strong>${escapeHtml(m.name)}</strong><p>${escapeHtml(m.how)}</p></div>`).join('')}</div></section>`:''}
    <section class="guide-steps-block" aria-label="Langkah"><span class="guide-section-label">LANGKAH-LANGKAH</span><ol class="guide-steps">${data.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol></section>
    <div class="guide-example"><span>CONTOH</span>${escapeHtml(data.example)}</div>
    <p class="guide-tip">${svg('spark',14)} ${escapeHtml(data.tip)}</p>
    ${data.references?.length?`<section class="guide-references" aria-label="Referensi"><span class="guide-section-label">REFERENSI PELENGKAP</span><ul class="reference-list">${data.references.map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul></section>`:''}
    <small class="explanation-source">${data.source==='asisten'?'Disusun model pribadimu':'Materi bawaan'}</small>
    ${practice?`<button class="primary-button" id="guide-practice" data-guide-practice="${topic.id}">Latih materi ini ${svg('arrow',18)}</button>`:''}
  </div>`;
}

// Simulasi: deretan frame visual yang bermain langkah demi langkah ke arah jawaban.
function renderSimulation(simulation) {
  const frames=simulation.frames;
  const frame=frames[Math.min(state.simFrame,frames.length-1)];
  return `<section class="guide-sim" aria-label="Simulasi">
    <span class="guide-section-label">SIMULASI · ${escapeHtml(simulation.title||'Cara kerjanya')}</span>
    <div class="sim-stage" id="sim-stage">${guideVisual(frame)}</div>
    <span class="sim-caption">${escapeHtml(frame.caption||'')}</span>
    <div class="sim-controls">
      <button type="button" id="sim-prev" ${state.simFrame===0?'disabled':''} aria-label="Keadaan sebelumnya">${svg('back',16)}</button>
      <button type="button" class="sim-play" id="sim-play">${state.simPlaying?'Jeda':'Putar'} ${svg(state.simPlaying?'close':'arrow',13)}</button>
      <span class="sim-count" aria-label="Posisi langkah">${Math.min(state.simFrame,frames.length-1)+1} / ${frames.length}</span>
      <button type="button" id="sim-next" ${state.simFrame>=frames.length-1?'disabled':''} aria-label="Keadaan berikutnya">${svg('arrow',16)}</button>
    </div>
  </section>`;
}

function stopSim() {
  clearInterval(simTimer);simTimer=null;
  state.simPlaying=false;
}

function showSimFrame(step) {
  const frames=state.guideMaterial?.simulation?.frames;
  if(!frames)return;
  state.simFrame=Math.max(0,Math.min(frames.length-1,step));
  renderGuide();
  const stage=app.querySelector('#sim-stage');
  if(stage)animate(stage,[{opacity:.35,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260});
}

function guideVisual(visual) {
  if (!visual) return '';
  const values=(visual.values||[]).map(Number);
  const labels=visual.labels||[];
  if(visual.type==='sequence') return `<div class="visual-sequence">${values.map((v,i)=>`<span>${v}${i<values.length-1?'<i>→</i>':''}</span>`).join('')}</div>`;
  if(visual.type==='groups') { const g=Math.min(6,Math.max(1,values[0]||2)); const per=Math.min(8,Math.max(1,values[1]||1)); return `<div class="visual-groups">${Array.from({length:g},(_,i)=>`<span><b>${i+1}</b>${Array.from({length:per},()=>'<i></i>').join('')}</span>`).join('')}</div>`; }
  if(visual.type==='number-line'&&values.length>=3) { const [a,b,r]=values; return `<div class="visual-number-line"><span>${a}</span><i style="--distance:${Math.min(100,Math.max(22,Math.abs(b)*9))}%"><b>${labels[1]||''}</b></i><span>${r}</span></div>`; }
  const right=labels.length>1?labels.at(-1):(values.at(-1)??'');
  return `<div class="visual-formula"><span>${escapeHtml(labels[0]||'Rumus')}</span><i>${svg('arrow',22)}</i><strong>${escapeHtml(right)}</strong></div>`;
}

async function openGuideTopic(id) {
  const topic=GUIDE_TOPICS.find(t=>t.id===id);if(!topic)return;
  stopSim();
  state.guideTopic=id;state.guideMaterial=null;state.simFrame=0;
  renderGuide();
  window.scrollTo({top:0,behavior:'instant'});
  try {
    const response=await fetch('/api/guide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:id})});
    if(response.status===401){location.reload();return;}
    const data=await response.json();
    if(state.screen!=='guide'||state.guideTopic!==id)return;
    if(!response.ok)throw new Error(data.error||'Materi belum tersedia.');
    state.guideMaterial=data;
    if(data.fallback)showToast('AI belum merespons. Materi bawaan digunakan.');
  } catch(error) {
    if(state.screen!=='guide'||state.guideTopic!==id)return;
    state.guideMaterial={title:topic.title,intro:error.message||'Materi belum tersedia.',analogy:'—',steps:['Coba lagi sebentar lagi.'],example:'—',tip:'Periksa koneksi Asisten Belajar di menu pengaturan.',methods:[],source:'lokal'};
  }
  renderGuide();
  enterScreen();
}

function showGuide() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stopSim();
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.screen='guide';
  state.guideTopic=null;state.guideMaterial=null;state.simFrame=0;
  renderGuide();
  enterScreen();
}

// Kolom chat Asisten Belajar: tanya bebas, saran tantangan, dan foto soal.
function renderChat() {
  app.innerHTML = `
    <section class="chat-screen" aria-label="Asisten Belajar">
      ${appHeader({id:'chat-home',label:'Kembali ke beranda',icon:'back'})}
      <div class="chat-log" id="chat-log" role="log" aria-live="polite">
        ${state.messages.length?'':`<div class="chat-hello"><span class="chat-badge">${svg('spark',20)}</span><strong>Tanya apa saja soal tantanganmu.</strong><p>Bisa soal langkah pengerjaan, metode cepat, sampai materi lain. Kirim foto soal juga bisa.</p></div>`}
        ${state.messages.map(message=>`
          <div class="chat-bubble ${message.role}">
            ${message.image?`<img src="${message.image}" alt="Foto soal yang kamu kirim" class="chat-photo">`:''}
            ${message.content?`<p>${escapeHtml(message.content).replace(/\n/g,'<br>')}</p>`:''}
            ${message.role==='assistant'&&message.visual?`<div class="chat-visual">${guideVisual(message.visual)}</div>`:''}
          </div>`).join('')}
        ${state.chatBusy?`<div class="chat-bubble assistant chat-typing" role="status"><i></i><i></i><i></i><span class="sr-only">Asisten sedang menulis</span></div>`:''}
      </div>
      <form class="chat-composer" id="chat-form">
        <div class="chat-suggestions" aria-label="Saran pertanyaan">${CHAT_STARTERS.map(q=>`<button type="button" data-chat-suggest="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}</div>
        ${state.chatImage?`<div class="chat-preview"><img src="${state.chatImage}" alt="Pratinjau foto soal"><button type="button" id="chat-photo-remove" aria-label="Hapus foto">${svg('close',16)}</button></div>`:''}
        <div class="chat-input-row">
          <button type="button" class="chat-camera" id="chat-camera" aria-label="Ambil foto soal dengan kamera">${svg('camera',22)}</button>
          <input id="chat-input" name="chat" type="text" enterkeyhint="send" autocomplete="off" placeholder="Tulis pertanyaanmu…" aria-label="Pertanyaan untuk Asisten Belajar">
          <button type="submit" class="chat-send" aria-label="Kirim pertanyaan">${svg('arrow',20)}</button>
        </div>
        <input type="file" id="chat-camera-input" accept="image/*" capture="environment" hidden>
      </form>
    </section>`;
  const log=app.querySelector('#chat-log');
  if(log)log.scrollTop=log.scrollHeight;
  app.querySelector('#chat-camera').addEventListener('click',()=>app.querySelector('#chat-camera-input').click());
  app.querySelector('#chat-camera-input').addEventListener('change',attachChatPhoto);
  app.querySelector('#chat-photo-remove')?.addEventListener('click',()=>{state.chatImage=null;renderChat();});
  app.querySelector('#chat-form').addEventListener('submit',event=>{event.preventDefault();sendChat();});
  app.querySelector('#chat-input').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();sendChat();}});
  app.querySelectorAll('[data-chat-suggest]').forEach(button=>button.addEventListener('click',()=>sendChat(button.dataset.chatSuggest)));
}

function openChat() {
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.screen='chat';
  if(!state.messages)state.messages=[];
  renderChat();
  enterScreen();
  app.querySelector('#chat-input')?.focus({preventScroll:true});
}

async function attachChatPhoto(event) {
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  try {
    // Kecilkan foto di perangkat supaya kiriman ringan dan model cepat membacanya.
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    state.chatImage=canvas.toDataURL('image/jpeg',.72);
    renderChat();
  } catch { showToast('Foto tidak dapat dibaca. Coba lagi.'); }
}

async function sendChat(text) {
  const content=String(text??app.querySelector('#chat-input')?.value??'').trim()||(state.chatImage?'Tolong jelaskan soal pada gambar ini.':'');
  if(!content||state.chatBusy)return;
  const image=state.chatImage;
  state.messages.push({role:'user',content,image});
  state.chatInput='';state.chatImage=null;state.chatBusy=true;
  renderChat();
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:state.messages.slice(-8).map(m=>({role:m.role,content:m.content})),image})});
    if(response.status===401){location.reload();return;}
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Asisten belum bisa menjawab.');
    state.messages.push({role:'assistant',content:data.reply,visual:data.visual||null});
    if(data.fallback)showToast('AI belum merespons. Jawaban dari materi bawaan.');
  } catch(error) {
    state.messages.push({role:'assistant',content:error.message||'Asisten belum tersedia. Coba lagi sebentar.'});
  }
  state.chatBusy=false;
  if(state.screen==='chat')renderChat();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button, a');
  if (!button || button.disabled) return;
  if (button.matches('.brand') || button.id === 'home' || button.id === 'result-home' || button.id === 'guide-close' || button.id === 'guide-start') { event.preventDefault(); goHome(); }
  else if (button.id === 'exit-challenge') confirmExit('home');
  else if (button.id === 'account') showAccount();
  else if (button.id === 'show-guide') showGuide();
  else if (button.id === 'show-tables') showTableMenu();
  else if (button.id === 'show-reference') showGuide();
  else if (button.dataset.tableOp) showTable(button.dataset.tableOp);
  else if (button.id === 'table-challenge') {
    const dialog = button.closest('dialog');
    const [lo, hi] = [[1,10],[11,20],[21,30]][state.tableGroup];
    const noRef = NO_REFERENCE_OPS.includes(state.tableOp);
    const number = noRef ? 1 : state.tableNumber;
    dialog.close();
    state.operation = state.tableOp;
    state.tableMode = state.tableOp;
    state.tableNumber = number;
    state.tableLabel = noRef ? { akar:'Akar kuadrat', kuadrat:'Kuadrat', kubik:'Pangkat tiga' }[state.tableOp] : `Tabel ${number}`;
    state.tableLo = lo; state.tableHi = hi;
    state.engine = 'default';
    start();
  }
  else if (button.id === 'table-back') { button.closest('dialog').close(); showTableMenu(); }
  else if (button.id==='iq-back') showIQMenu();
  else if (button.id==='start-iq-test') {state.iqTest=true;state.operation='iq';state.difficulty='sedang';state.tableMode=null;start();}
  else if (button.dataset.iqTopic) {state.iqTest=false;state.iqTopic=button.dataset.iqTopic;showSetup('iq');}
  else if (button.dataset.guideTopic) openGuideTopic(button.dataset.guideTopic);
  else if (button.id==='guide-back') { stopSim();state.guideTopic=null;state.guideMaterial=null;renderGuide(); }
  else if (button.id==='guide-practice') { const topic=button.dataset.guidePractice; topic==='iq'?showIQMenu():showSetup(topic); }
  else if (button.id==='guide-chat') openChat();
  else if (button.id==='chat-home') goHome();
  else if (button.id==='sim-prev') { stopSim();showSimFrame(state.simFrame-1); }
  else if (button.id==='sim-next') { stopSim();showSimFrame(state.simFrame+1); }
  else if (button.id==='sim-play') {
    if (state.simPlaying) { stopSim();renderGuide(); }
    else {
      state.simPlaying=true;
      renderGuide();
      simTimer=setInterval(()=>{
        const total=state.guideMaterial?.simulation?.frames.length||0;
        if(state.simFrame>=total-1){stopSim();if(state.screen==='guide'&&state.guideTopic)renderGuide();return;}
        showSimFrame(state.simFrame+1);
      },1800);
    }
  }
  else if (button.id==='toggle-motion') { const panel=button.closest('.visual-progress');const paused=panel.classList.toggle('motion-paused');button.setAttribute('aria-pressed',paused);button.setAttribute('aria-label',paused?'Putar animasi':'Jeda animasi');button.textContent=paused?'▷':'Ⅱ';}
  else if (button.id === 'ai-practice') openChat();
  else if (button.dataset.practice) {
    if (button.dataset.level) state.difficulty = button.dataset.level;
    if(button.dataset.practice==='iq')showIQMenu();else if(button.dataset.practice==='aimath')openChat();else if(button.dataset.practice==='campuran')showSetup('campuran');else if(button.dataset.practice==='kuadrat'||button.dataset.practice==='kubik')showTable(button.dataset.practice);else showSetup(button.dataset.practice);
  } else if (button.dataset.engine) {
    if (button.dataset.engine === 'ai' && !aiConfigured) showAccount();
    else { state.engine = button.dataset.engine; updateHomeSelection(); }
  } else if (button.hasAttribute('data-digits')) {
    state.digits = button.dataset.digits === '' ? null : Number(button.dataset.digits);
    updateHomeSelection();
    animate(document.querySelector('#level-hint'), [{opacity:0, transform:'translateY(4px)'}, {opacity:1, transform:'translateY(0)'}]);
  } else if (button.id === 'giveup') confirmExit();
  else if (button.id === 'target-practice') {state.targetSkill=button.dataset.skill;state.targetTitle=button.dataset.title;state.operation='tambah';state.engine='default';state.tableMode=null;start();}
  else if (button.id === 'written-help') showHelp();
  else if (button.id === 'clear-written') {
    state.input = '';
    updateAnswer();
    updateKeypad();
    app.querySelector('#written-answer')?.focus();
  }
  else if (button.id === 'done') press('enter');
  else if (button.dataset.difficulty) {
    state.difficulty = button.dataset.difficulty;
    updateHomeSelection();
    animate(document.querySelector('#level-hint'), [{opacity:0, transform:'translateY(4px)'}, {opacity:1, transform:'translateY(0)'}]);
  } else if (button.dataset.nav) navigate(button.dataset.nav);
  else if (button.dataset.timeMode) { state.timeMode = button.dataset.timeMode; updateHomeSelection(); }
  else if (button.dataset.timePreset) { state.customSeconds = Number(button.dataset.timePreset); updateHomeSelection(); }
  else if (button.dataset.key) press(button.dataset.key);
  else if (button.id === 'start') {state.targetSkill=null;state.targetTitle='';start();}
  else if (button.id === 'again') start();
});

app.addEventListener('pointerdown', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled || motionPreference.matches) return;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'tap-ripple';
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  button.append(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
});

document.addEventListener('keydown', event => {
  if (state.screen !== 'challenge' || document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key === 'Escape') { event.preventDefault(); confirmExit('home'); return; }
  if (event.target.matches('#written-answer')) return;
  if (event.key === 'Enter' && event.target.closest('button:not([data-key]):not(#done), a')) return;
  const key = /^\d$/.test(event.key) ? event.key : event.key === 'Backspace' ? 'backspace' : event.key === 'Enter' ? 'enter' : null;
  if (key) { event.preventDefault(); press(key); }
});

motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) { document.getAnimations().forEach(animation => animation.cancel()); document.querySelectorAll('.completion-confetti i, .success-burst i').forEach(el => el.remove()); }
});
renderHome();
enterScreen();
checkAccount();
