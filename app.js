import { generateChallenge, generateIQ, generateAIMath, AI_LESSONS, referenceRows, calculate, hintFor } from './engine.js';
import { readProgress, saveSession, summarizeProgress } from './progress.js';
import {findWeakSkill,readAttempts,saveAttempt} from './mastery.js';

const app = document.querySelector('#app');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const TOTAL = 10;
const sessionTotal = () => state.targetSkill ? 5 : TOTAL;
const operations = {
  aimath: {symbol:'∇',label:'Asisten Belajar',short:'Konsep mesin'},
  iq: {symbol:'⋯', label:'Latihan IQ', short:'Pola angka'},
  tambah: { symbol: '+', label: 'Penjumlahan', short: 'Tambah', example: '8 + 4', answer: '12', color: 'mint' },
  kurang: { symbol: '−', label: 'Pengurangan', short: 'Kurang', example: '8 − 4', answer: '4', color: 'peach' },
  kali: { symbol: '×', label: 'Perkalian', short: 'Kali', example: '8 × 4', answer: '32', color: 'blue' },
  bagi: { symbol: '÷', label: 'Pembagian', short: 'Bagi', example: '8 ÷ 4', answer: '2', color: 'lilac' },
};
const levels = { mudah: { label: 'Mudah', hint: 'Angka 0–10' }, sedang: { label: 'Sedang', hint: 'Angka 0–50' }, sulit: { label: 'Sulit', hint: 'Angka 0–100' } };
const GUIDE = [
  { id: 'tambah', symbol: '+', title: 'Penjumlahan', color: 'mint', tagline: 'Menggabungkan dua kelompok',
    what: 'Penjumlahan menggabungkan dua bilangan menjadi satu total yang lebih besar.',
    analogy: 'Seperti menuang air dari dua gelas ke satu teko. Jumlah airnya bertambah.',
    steps: ['Mulai dari angka pertama.', 'Hitung maju sebanyak angka kedua.', 'Angka terakhir adalah jawaban.'],
    example: '7 + 5 → mulai dari 7, lalu hitung maju 5: 8, 9, 10, 11, 12. Jawabannya 12.',
    tip: 'Untuk angka besar, jumlahkan puluhan dulu, baru satuannya.',
    note: 'Kamu bisa memilih jumlah digit (1–5) di pengaturan penjumlahan.' },
  { id: 'kurang', symbol: '−', title: 'Pengurangan', color: 'peach', tagline: 'Mengambil sebagian',
    what: 'Pengurangan mengambil sebagian dari suatu bilangan. Yang tersisa makin sedikit.',
    analogy: 'Seperti memakan kue dari toples. Isinya berkurang.',
    steps: ['Mulai dari angka terbesar.', 'Hitung mundur sebanyak angka kedua.', 'Angka terakhir adalah sisanya.'],
    example: '9 − 4 → mulai dari 9, hitung mundur 4: 8, 7, 6, 5. Jawabannya 5.',
    tip: 'Pengurangan adalah kebalikan dari penjumlahan.' },
  { id: 'kali', symbol: '×', title: 'Perkalian', color: 'blue', tagline: 'Penjumlahan berulang',
    what: 'Perkalian menjumlahkan angka yang sama secara berulang.',
    analogy: 'Seperti kotak telur: 6 baris, tiap baris 2 telur, jadi 12 telur.',
    steps: ['Ambil angka pertama.', 'Jumlahkan angka itu sebanyak angka kedua kali.', 'Totalnya adalah jawaban.'],
    example: '4 × 3 = 4 + 4 + 4 = 12.',
    tip: 'Hafalkan tabel perkalian kecil (1–10), ini jadi jauh lebih cepat.' },
  { id: 'bagi', symbol: '÷', title: 'Pembagian', color: 'lilac', tagline: 'Membagi rata',
    what: 'Pembagian membagi suatu bilangan menjadi beberapa bagian yang sama besar.',
    analogy: 'Seperti membagi 12 kue ke 3 orang. Tiap orang dapat 4 kue.',
    steps: ['Ambil bilangan yang dibagi.', 'Bagikan rata ke jumlah kelompok.', 'Tiap kelompok adalah jawaban.'],
    example: '12 ÷ 3 = 4, karena 4 × 3 = 12.',
    tip: 'Pembagian adalah kebalikan dari perkalian.' },
  { id: 'iq', symbol: '⋯', title: 'Latihan IQ', color: 'mint', tagline: 'Menemukan pola',
    what: 'Latihan IQ meminta kamu menemukan aturan di balik deretan angka.',
    analogy: 'Seperti menebak nada berikutnya dalam sebuah lagu.',
    steps: ['Lihat selisih antar angka.', 'Temukan pola yang berulang.', 'Terapkan pola ke angka berikutnya.'],
    example: '2, 4, 6, 8, ? → setiap angka naik 2, jadi jawabannya 10.',
    tip: 'Mulai dari selisih antar angka. Pola paling umum: tambah atau kali.' },
  { id: 'aimath', symbol: '∇', title: 'Asisten Belajar', color: 'lilac', tagline: 'Matematika mesin',
    what: 'Asisten Belajar mengajarkan konsep sederhana yang dipakai mesin untuk belajar.',
    analogy: 'Seperti resep masakan: input adalah bahan, model adalah cara mengolahnya.',
    steps: ['Baca penjelasan materi.', 'Lihat rumus dan contohnya.', 'Kerjakan 10 soal untuk menguasainya.'],
    example: 'Fungsi y = w × x + b mengubah input x menjadi prediksi y.',
    tip: 'Buka Asisten Belajar untuk memulai dari nol.' }
];
const state = { screen: 'home', operation: 'kali', difficulty: 'mudah', question: null, previous: '', index: 0, score: 0, lives: 5, input: '', loading: false, feedback: '', error: '', answered: 0, engine: 'default', digits: null, history: [], remaining: 80, questionStartedAt:0, hintUsed:false, targetSkill:null, targetTitle:'' };
let requestId = 0;
let requestController;
let nextQuestionTimer;
let sessionClock;
let clockTick = 0;
let stageObserver;
state.iqTopic='mixed'; state.aiTopic='place'; state.iqTest=false;
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
  grid: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="15" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
};
const svg = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
const brand = () => `<a href="#home" class="brand" aria-label="Math Speedy, beranda"><span class="brand-mark">${svg('bolt', 23)}</span><span>math<span class="brand-light">speedy</span><i></i></span></a>`;
const bars = count => `<span class="level-bars" aria-hidden="true">${[1, 2, 3].map(n => `<i class="${n <= count ? 'lit' : ''}"></i>`).join('')}</span>`;

function animate(element, frames, options = {}) {
  if (!element || motionPreference.matches) return;
  return element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
}

function enterScreen() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  animate(app.firstElementChild, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420 });
  app.querySelectorAll('.operation, .key').forEach((element, index) => {
    animate(element, [{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 330, delay: index * 22 });
  });
}

function goHome() {
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.targetSkill=null;state.targetTitle='';
  state.screen = 'home';
  renderHome();
  enterScreen();
}

function progressSummary() {
  try { return summarizeProgress(readProgress(localStorage)); }
  catch { return summarizeProgress([]); }
}

function renderHome() {
  const progress = progressSummary();
  const goal = Math.min(progress.today / TOTAL, 1);
  const maxDay = Math.max(TOTAL, ...progress.days.map(day => day.answered));
  app.innerHTML = `
    <section class="dashboard-home" aria-label="Beranda">
      <div class="home-main-panel">
        <header class="dashboard-header"><a href="#home" class="brand wordmark" aria-label="Math Speedy, beranda">SpeedyMath</a><button class="home-account" id="account" aria-label="Pengaturan Asisten Belajar">${svg('spark', 20)}<i class="${aiConnected ? 'connected' : ''}"></i></button></header>
        <section class="training-dashboard" aria-labelledby="progress-title">
          <div class="dashboard-heading"><h1 id="progress-title">Progres latihan</h1><span class="streak-pill">${svg('bolt', 13)} ${progress.streak} hari</span></div>
          <div class="visual-progress ${motionPreference.matches ? 'motion-paused' : ''}">
            <div class="glass-orbit orbit-a" aria-hidden="true"></div><div class="glass-orbit orbit-b" aria-hidden="true"></div>
            <span class="math-mote mote-a" aria-hidden="true">+</span><span class="math-mote mote-b" aria-hidden="true">∑</span><span class="math-mote mote-c" aria-hidden="true">×</span>
            <div class="daily-ring" style="--goal:${goal*100}%" role="img" aria-label="Target harian ${progress.today} dari ${TOTAL} soal"><div><strong>${progress.today}</strong><span>/ ${TOTAL} soal</span>${goal>=1?svg('check',18):''}</div></div>
            <span class="visual-status">${goal>=1?'Target tercapai':'Target harian'}</span><button class="motion-toggle" id="toggle-motion" aria-label="Jeda animasi" aria-pressed="false">Ⅱ</button>
          </div>
          <div class="dashboard-stats"><div><strong>${progress.accuracy === null ? '—' : progress.accuracy + '%'}</strong><span>Akurasi</span></div><div><strong>${progress.answered}</strong><span>Soal dijawab</span></div><div><strong>${progress.completed}</strong><span>Sesi tuntas</span></div></div>
        </section>
        <div class="practice-heading"><h2>Pilih latihan</h2><span>10 soal · 80 detik</span></div>
        <div class="practice-menu">
          ${Object.entries(operations).map(([key, op]) => {
            const stats = progress.byOperation.find(item => item.operation === key);
            return `<button class="practice-pill" data-practice="${key}"><span class="practice-symbol">${op.symbol}</span><span class="practice-name">${op.label}</span>${stats.answered ? `<span class="practice-accuracy">${stats.accuracy}%</span>` : ''}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="home-extras">
        <section class="weekly-card" aria-labelledby="weekly-title"><div class="section-heading"><h2 id="weekly-title">Ritme minggu ini</h2><span>${progress.days.reduce((n, d) => n + d.answered, 0)} soal</span></div><div class="weekly-chart" role="img" aria-label="${progress.days.map(day => `${day.label}: ${day.answered} soal`).join(', ')}">${progress.days.map((day, i) => `<div class="day-column ${i === 6 ? 'today' : ''}"><span class="day-count">${day.answered || '–'}</span><div class="day-track"><i style="--bar-height:${Math.max(day.answered ? 8 : 0, day.answered / maxDay * 100)}%"></i></div><span>${day.label}</span></div>`).join('')}</div></section>
        <button class="ai-feature" id="ai-practice"><span class="ai-feature-icon">${svg('spark', 25)}</span><span><strong>Asisten Belajar</strong><small>${aiConnected ? 'Siap membuat soal & visual' : aiConfigured ? 'Model pribadi siap diuji' : 'Penjelasan visual per soal'}</small></span>${svg('arrow', 20)}</button>
        <section class="recent-section" aria-labelledby="recent-title"><div class="section-heading"><h2 id="recent-title">Latihan terakhir</h2><span>Di perangkat ini</span></div>${progress.recent.length ? `<div class="recent-list">${progress.recent.map(session => `<button class="recent-item" data-practice="${session.operation}" data-level="${session.difficulty}" aria-label="Ulangi ${operations[session.operation].label}, ${levels[session.difficulty].label}"><span class="recent-symbol">${operations[session.operation].symbol}</span><span class="recent-name"><strong>${operations[session.operation].label}</strong><small>${levels[session.difficulty].label} · ${new Intl.DateTimeFormat('id-ID', {day:'numeric', month:'short'}).format(new Date(session.at))} · ${session.reason === 'completed' ? 'Tuntas' : 'Belum tuntas'}</small></span><span class="recent-score">${session.score}<small>/${session.answered}</small></span>${svg('refresh', 16)}</button>`).join('')}</div>` : `<div class="history-empty">${svg('grid', 25)}<div><strong>Belum ada latihan</strong><p>Hasil latihanmu akan muncul di sini.</p></div></div>`}</section>
        <footer class="dashboard-footer"><span class="footer-dot"></span> Progres tersimpan otomatis di perangkat ini</footer>
      </div>
    </section>`;
}

const IQ_TOPICS={mixed:'Campuran',basic:'Tambah & kurang',multiply:'Pola perkalian',growing:'Selisih bertingkat',alternate:'Pola bergantian',square:'Pola kuadrat',fibonacci:'Jumlah berantai',double:'Dobel + satu',mixedops:'Operasi bergantian'};
function showIQMenu(){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  openDialog(`<button class="dialog-close" data-close aria-label="Tutup pilihan IQ">${svg('close')}</button><span class="eyebrow">PENALARAN NUMERIK</span><h2>Pilih latihan</h2><button class="iq-test-feature" id="start-iq-test"><span>${svg('spark',24)}</span><strong>Tes penalaran<small>10 soal adaptif · dibuat Asisten Belajar</small></strong>${svg('arrow',18)}</button><div class="topic-grid">${Object.entries(IQ_TOPICS).map(([id,label],i)=>`<button data-iq-topic="${id}"><span>${['⋯','±','×','↗','⇄','²','∞','2×','±×'][i]}</span>${label}</button>`).join('')}</div>`);
}
function showCourse(){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  let records=[];try{records=readProgress(localStorage);}catch{}
  const done=new Set(records.filter(s=>s.operation==='aimath'&&s.reason==='completed'&&s.score>=7).map(s=>s.topic));
  const dialog=openDialog(`<button class="dialog-close" data-close aria-label="Tutup materi">${svg('close')}</button><span class="eyebrow">JALUR DEWASA · ${done.size}/${AI_LESSONS.length}</span><h2>Mulai tanpa takut</h2><p>Konsep pendek, visual, lalu praktik. Disusun dari prinsip representasi, worked examples, dan strategi lentur.</p><div class="course-path">${AI_LESSONS.map((lesson,i)=>`<button data-lesson="${lesson.id}"><span class="lesson-number">${done.has(lesson.id)?svg('check',16):String(i+1).padStart(2,'0')}</span><span>${lesson.title}<small>${done.has(lesson.id)?'Tuntas':lesson.source||'Visual + tantangan'}</small></span>${svg('arrow',16)}</button>`).join('')}</div><p class="course-evidence">Rujukan pembelajaran: Stanford GSE · Education Endowment Foundation.</p>`);dialog.classList.add('course-dialog');
}
function showLesson(id){
  const lesson=AI_LESSONS.find(x=>x.id===id);if(!lesson)return;
  state.operation='aimath';state.aiTopic=id;
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const dialog=openDialog(`<button class="dialog-close" data-close aria-label="Tutup materi">${svg('close')}</button><span class="eyebrow">MATERI ${AI_LESSONS.indexOf(lesson)+1} / ${AI_LESSONS.length}</span><h2>${lesson.title}</h2><div class="lesson-visual" aria-hidden="true">${lesson.icon}</div><p>${lesson.intro}</p><div class="lesson-formula">${lesson.formula}</div><div class="lesson-example"><span>CONTOH</span>${lesson.example}</div><button class="primary-button" id="lesson-challenge">Pilih level tantangan ${svg('arrow',18)}</button><button class="text-button" id="course-back">Semua materi</button>`);dialog.classList.add('course-dialog');
}

function digitOptionsMarkup() {
  const current = state.digits ?? '';
  const options = [['', 'Bebas'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
  return `<div class="digit-options" role="group" aria-label="Jumlah digit penjumlahan"><span class="digit-options-label">Digit penjumlahan</span><div class="digit-options-row">${options.map(([v, l]) => `<button data-digits="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}</div></div>`;
}

function showSetup(operation = state.operation) {
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  state.targetSkill=null;state.targetTitle='';
  state.operation = operation;
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup pengaturan">${svg('close')}</button><span class="eyebrow">10 SOAL · 80 DETIK · 5 NYAWA</span><h2>${operation==='iq'?IQ_TOPICS[state.iqTopic]:operation==='aimath'?AI_LESSONS.find(x=>x.id===state.aiTopic).title:operations[operation].label}</h2>
    <div class="difficulty-tabs" role="group" aria-label="Pilih tingkat kesulitan" style="--selected:${Object.keys(levels).indexOf(state.difficulty)}"><span class="difficulty-indicator" aria-hidden="true"></span>${Object.entries(levels).map(([key, level], i) => `<button class="difficulty" data-difficulty="${key}">${bars(i + 1)}${level.label}</button>`).join('')}</div>
    <p class="setup-level-hint" id="level-hint">${levels[state.difficulty].hint}</p>${operation === 'tambah' ? digitOptionsMarkup() : ''}${operation==='iq'?'<button class="text-button" id="iq-back">Ganti jenis pola</button>':''}
    <div class="engine-options" ${['iq','aimath'].includes(operation) ? 'hidden' : ''} role="group" aria-label="Sumber soal"><button data-engine="default">Bawaan <span>Gratis</span></button><button data-engine="ai">${svg('spark', 13)} Asisten ${aiConfigured ? '<span>VPS</span>' : '<span>Atur</span>'}</button></div><button class="reference-button" id="show-reference">${svg('grid',16)} ${operation==='aimath'?'Baca materi':operation === 'iq' ? 'Panduan pola angka' : 'Tabel ' + operations[operation].label.toLowerCase()}</button>${operation === 'iq' ? '<p class="iq-note">Latihan logika angka · bukan pengukuran skor IQ.</p>' : ''}<button class="primary-button" id="start"><span>Mulai latihan</span>${svg('arrow', 20)}</button>`);
  dialog.classList.add('practice-dialog');
  updateHomeSelection();
}

function showReference() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  const iq = state.operation === 'iq';
  const dialog = openDialog(`<button class="dialog-close" data-close aria-label="Tutup tabel">${svg('close')}</button><span class="eyebrow">BELAJAR DULU</span><h2>${iq ? 'Pola angka' : 'Tabel ' + operations[state.operation].label.toLowerCase()}</h2>${iq ? `<div class="table-scroll"><table><caption>Contoh pola dan cara menghitung</caption><thead><tr><th scope="col">Pola</th><th scope="col">Contoh</th></tr></thead><tbody><tr><th scope="row">Tambah 3</th><td>2, 5, 8, 11, <b>14</b></td></tr><tr><th scope="row">Kurangi 2</th><td>12, 10, 8, 6, <b>4</b></td></tr><tr><th scope="row">Kali 2</th><td>2, 4, 8, 16, <b>32</b></td></tr><tr><th scope="row">Selisih +1</th><td>1, 3, 6, 10, <b>15</b></td></tr><tr><th scope="row">+3, +1</th><td>1, 4, 5, 8, <b>9</b></td></tr><tr><th scope="row">Kuadrat +2</th><td>3, 6, 11, 18, <b>27</b></td></tr></tbody></table></div>` : `<label class="table-number">Angka <select id="reference-number" aria-label="Angka tabel">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===1?'selected':''}>${i+1}</option>`).join('')}</select></label><div class="table-scroll" id="reference-content"></div>`}<button class="primary-button" id="reference-back">Kembali ke latihan ${svg('arrow',18)}</button>`);
  dialog.classList.add('reference-dialog');
  if (!iq) {
    const render = () => {
      const number=Number(dialog.querySelector('#reference-number').value);
      dialog.querySelector('#reference-content').innerHTML=`<table><caption>${operations[state.operation].label} dengan ${number}</caption><thead><tr><th scope="col">Perhitungan</th><th scope="col">Hasil</th></tr></thead><tbody>${referenceRows(state.operation,number).map(row=>`<tr><th scope="row">${row.a} ${row.symbol} ${row.b}</th><td>${row.answer}</td></tr>`).join('')}</tbody></table>`;
    };
    render(); dialog.querySelector('#reference-number').addEventListener('change',render);
  }
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
  if (hint) hint.textContent = state.operation === 'tambah' && state.digits ? `Angka ${state.digits} digit (${state.digits === 1 ? 0 : 10 ** (state.digits - 1)}–${10 ** state.digits - 1})` : state.operation==='aimath'?({mudah:'Angka kecil · dasar',sedang:'Angka menengah',sulit:'Angka lebih besar'})[state.difficulty] : state.operation === 'iq' ? (state.iqTopic==='mixed'?({mudah:'Selisih tetap',sedang:'Perkalian & selisih bertingkat',sulit:'Pola bergantian & kuadrat'})[state.difficulty]:`${IQ_TOPICS[state.iqTopic]} · ${levels[state.difficulty].label}`) : levels[state.difficulty].hint;
}

function renderChallenge() {
  if (['iq', 'aimath'].includes(state.operation)) {
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
            <div class="figma-timing"><span id="timer" aria-label="${state.targetSkill?'Latihan fokus tanpa timer':'Waktu tersisa'}">${state.targetSkill?'FOKUS':'01:20'}</span><div class="figma-timer-track" role="progressbar" aria-label="${state.targetSkill?'Latihan fokus':'Sisa waktu'}" aria-valuemin="0" aria-valuemax="80" aria-valuenow="80"><i></i><b></b></div></div>
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
  const isAI = state.operation === 'aimath';
  const contextLabel = isAI
    ? AI_LESSONS.find(lesson => lesson.id === state.aiTopic)?.title || 'Asisten Belajar'
    : state.iqTest ? 'Tes penalaran' : IQ_TOPICS[state.iqTopic] || 'Latihan IQ';
  app.innerHTML = `
    <section class="written-challenge ${isAI ? 'written-ai' : 'written-iq'}" aria-label="${isAI ? 'Tantangan matematika AI' : 'Latihan pola angka'}">
      <header class="written-header">
        <button class="written-icon-button" id="exit-challenge" aria-label="Tutup latihan">${svg('close', 20)}</button>
        <div class="written-progress-copy"><span id="written-step">Soal 1 dari ${sessionTotal()}</span><strong>${escapeHtml(contextLabel)}</strong></div>
        <div class="written-lives" aria-label="5 nyawa tersisa">${Array.from({length:5}, () => '<i class="alive"></i>').join('')}</div>
      </header>
      <div class="written-timer"><span id="timer" aria-label="Waktu tersisa">01:20</span><div class="written-timer-track figma-timer-track" role="progressbar" aria-label="Sisa waktu" aria-valuemin="0" aria-valuemax="80" aria-valuenow="80"><i></i><b></b></div></div>
      <main class="written-body">
        <section class="written-question-card">
          <span class="written-kicker">${isAI ? 'TERAPKAN KONSEPNYA' : 'TEMUKAN POLANYA'}</span>
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
  equation.textContent = q ? (q.operation === 'aimath' ? q.display : q.operation === 'iq' ? `${q.sequence.join(' · ')} · ?` : `${q.a} ${q.symbol} ${q.b}`) : '…';
  equation.classList.toggle('iq-equation', ['iq','aimath'].includes(state.operation));
  equation.setAttribute('aria-label', q ? q.operation === 'aimath' ? `${q.prompt} ${q.display}` : q.operation === 'iq' ? `Lanjutkan pola: ${q.sequence.join(', ')}, tanda tanya` : `${q.a} ${operations[q.operation].label} ${q.b}` : 'Menyiapkan soal');
  app.querySelector('#question-prompt').textContent = state.loading ? 'Menyiapkan soal…' : state.targetSkill ? `Fokus · ${state.targetTitle}` : state.operation === 'aimath' ? (q?.prompt || 'Asisten Belajar') : state.operation === 'iq' ? 'Angka berikutnya?' : 'Berapa hasilnya?';
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
    progress.querySelector('b').style.transform = `scaleX(${state.remaining / 80})`;
    if (!seconds) finishSession('timeout');
  }, 250);
}

function finishSession(reason = 'completed', destination = 'result') {
  if (state.screen !== 'challenge') return;
  state.reason = reason;
  if (state.answered) {
    let saved = false;
    try { saved = saveSession(localStorage, {id: state.sessionId, at: new Date().toISOString(), operation: state.operation, difficulty: state.difficulty, answered: state.answered, score: state.score, reason, topic:state.operation==='aimath'?state.aiTopic:state.iqTopic}); } catch {}
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
  else if (state.operation === 'aimath') question=generateAIMath({...settings,topic:state.aiTopic});
  else if (state.engine === 'default') question = generateChallenge(settings);
  else {
    try {
      const response = await fetch('/api/challenge', {method:'POST',signal:requestController.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...settings,engine:'ai'})});
      if (response.status === 401) { location.reload(); return; }
      if (!response.ok) throw new Error('AI unavailable');
      question = await response.json();
      if (question.fallback) showToast('AI belum merespons. Soal bawaan digunakan.');
    } catch {
      if (currentRequest !== requestId || state.screen !== 'challenge') return;
      question = generateChallenge(settings);
      showToast('VPS belum tersedia. Soal bawaan digunakan.');
    }
  }
  if (currentRequest !== requestId || state.screen !== 'challenge') return;
  state.question = question;
  state.history.push(question.id || `${question.a}:${question.b}`);
  state.loading = false;
  clockTick = performance.now();
  state.questionStartedAt = performance.now();
  state.hintUsed = false;
  updateQuestion();
}

function start() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  clearTimeout(nextQuestionTimer);
  Object.assign(state, {sessionId:crypto.randomUUID(),reason:null,screen:'challenge',index:0,score:0,answered:0,lives:5,input:'',feedback:'',previous:'',history:[],remaining:80,questionStartedAt:0,hintUsed:false});
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
  const title = completed ? (state.targetSkill ? (state.score>=4?'Nice, mulai kebaca.':'Masih agak goyang.') : state.score === sessionTotal() ? 'Sempurna!' : 'Tantangan selesai!') : state.reason === 'timeout' ? 'Waktu habis' : state.reason === 'lives' ? 'Coba lagi, yuk.' : 'Latihan diakhiri';
  const reasoningIndex=Math.round(accuracy*.8+Math.min(state.answered/sessionTotal(),1)*20);
  let learningInsight=null;
  if(state.operation==='tambah')try{learningInsight=findWeakSkill(readAttempts(localStorage),state.sessionId);}catch{}
  app.innerHTML = `
    <section class="result-screen ${completed ? 'result-completed' : ''}">
      <header class="result-header"><a href="#home" class="brand wordmark" aria-label="Math Speedy, beranda">SpeedyMath</a><button class="result-close" id="result-home" aria-label="Kembali ke beranda">${svg('close')}</button></header>
      <div class="result-content">
        <div class="result-medallion">${svg(completed ? 'check' : 'refresh', 57)}<span class="medallion-orbit"></span><span class="medallion-halo"></span></div>
        <span class="eyebrow">${completed ? 'SESI TUNTAS' : `${state.answered} SOAL DIKERJAKAN`}</span>
        <h1 tabindex="-1">${title}</h1>
        <p>${completed ? 'Satu latihan lagi. Satu langkah maju.' : 'Progresmu tetap berarti. Lanjutkan lagi kapan saja.'}</p>
        <div class="result-card"><span>${state.iqTest?'INDEKS PENALARAN':'JAWABAN BENAR'}</span><strong><b id="result-score">${state.iqTest?reasoningIndex:state.score}</b><small>${state.iqTest?' / 100':` / ${state.answered}`}</small></strong><div class="result-stats"><span><b>${accuracy}%</b> Akurasi</span><span><b>${state.answered}/${sessionTotal()}</b> Soal dikerjakan</span></div></div>
        ${state.iqTest?'<p class="iq-result-note">Skor latihan, bukan skor IQ klinis. Tes resmi memerlukan norma populasi dan pengawasan terstandar.</p>':''}
        ${learningInsight&&!state.targetSkill?`<div class="result-insight"><span>YANG MASIH PERLU DIASAH</span><strong>${escapeHtml(learningInsight.title)}</strong><p>${learningInsight.errors} jawaban yang meleset punya pola yang sama.</p><button id="target-practice" data-skill="${learningInsight.skillId}" data-title="${escapeHtml(learningInsight.title)}">Latih 5 soal ${svg('arrow',16)}</button></div>`:''}
        <span class="result-session">${operations[state.operation].label} · ${levels[state.difficulty].label}${state.targetSkill?' · Fokus':''}</span>
        ${state.operation==='aimath'?'<button class="reference-button" id="course-back">Lanjut ke materi</button>':''}<button class="primary-button" id="again"><span>${state.targetSkill?'Ulang fokus':'Latihan lagi'}</span><span class="button-arrow">${svg('refresh', 20)}</span></button>
        <button class="text-button" id="home">${svg('back', 16)} Kembali ke beranda</button>
      </div><div class="completion-confetti" aria-hidden="true"></div>
    </section>`;
  app.querySelector('h1').focus({preventScroll: true});
  if (completed) celebrateCompletion();
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

function renderGuide() {
  app.innerHTML = `
    <section class="guide-screen" aria-label="Panduan lengkap">
      <header class="result-header"><a href="#home" class="brand wordmark" aria-label="Math Speedy, beranda">SpeedyMath</a><button class="result-close" id="guide-close" aria-label="Kembali ke beranda">${svg('close')}</button></header>
      <div class="guide-content">
        <span class="eyebrow">PANDUAN LENGKAP</span>
        <h1>Cara kerja setiap latihan.</h1>
        <p>Penjelasan singkat dengan analogi sehari-hari. Baca dulu, lalu mulai dari yang paling nyaman buatmu.</p>
        <nav class="guide-toc" aria-label="Daftar isi">${GUIDE.map(g => `<a href="#guide-${g.id}"><span class="guide-toc-symbol">${g.symbol}</span>${g.title}</a>`).join('')}</nav>
        ${GUIDE.map(g => `
          <article class="guide-card" id="guide-${g.id}">
            <div class="guide-card-head"><span class="guide-symbol">${g.symbol}</span><div><h2>${g.title}</h2><small>${g.tagline}</small></div></div>
            <p class="guide-what">${g.what}</p>
            <div class="guide-analogy"><span>ANALOGI</span>${g.analogy}</div>
            <ol class="guide-steps">${g.steps.map(s => `<li>${s}</li>`).join('')}</ol>
            <div class="guide-example"><span>CONTOH</span>${g.example}</div>
            <p class="guide-tip">${g.tip}</p>
            ${g.note ? `<p class="guide-note">${g.note}</p>` : ''}
          </article>
        `).join('')}
        <button class="primary-button" id="guide-start">Mulai berlatih ${svg('arrow', 18)}</button>
      </div>
    </section>`;
}

function showGuide() {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  clearTimeout(nextQuestionTimer);
  clearInterval(sessionClock);
  stageObserver?.disconnect();
  requestController?.abort();
  requestId++;
  state.screen = 'guide';
  renderGuide();
  enterScreen();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button, a');
  if (!button || button.disabled) return;
  if (button.matches('.brand') || button.id === 'home' || button.id === 'result-home' || button.id === 'guide-close' || button.id === 'guide-start') { event.preventDefault(); goHome(); }
  else if (button.id === 'exit-challenge') confirmExit('home');
  else if (button.id === 'account') showAccount();
  else if (button.id === 'show-guide') showGuide();
  else if (button.id === 'show-reference') state.operation==='aimath'?showLesson(state.aiTopic):showReference();
  else if (button.id==='iq-back') showIQMenu();
  else if (button.id==='start-iq-test') {state.iqTest=true;state.operation='iq';state.difficulty='sedang';start();}
  else if (button.dataset.iqTopic) {state.iqTest=false;state.iqTopic=button.dataset.iqTopic;showSetup('iq');}
  else if (button.dataset.lesson) showLesson(button.dataset.lesson);
  else if (button.id==='lesson-challenge') showSetup('aimath');
  else if (button.id==='course-back') showCourse();
  else if (button.id==='toggle-motion') { const panel=button.closest('.visual-progress');const paused=panel.classList.toggle('motion-paused');button.setAttribute('aria-pressed',paused);button.setAttribute('aria-label',paused?'Putar animasi':'Jeda animasi');button.textContent=paused?'▷':'Ⅱ';}
  else if (button.id === 'reference-back') { button.closest('dialog').close(); showSetup(); }
  else if (button.id === 'ai-practice') {
    if (aiConfigured) { state.engine = 'ai'; showSetup(); }
    else showAccount();
  } else if (button.dataset.practice) {
    if (button.dataset.level) state.difficulty = button.dataset.level;
    if(button.dataset.practice==='iq')showIQMenu();else if(button.dataset.practice==='aimath')showCourse();else showSetup(button.dataset.practice);
  } else if (button.dataset.engine) {
    if (button.dataset.engine === 'ai' && !aiConfigured) showAccount();
    else { state.engine = button.dataset.engine; updateHomeSelection(); }
  } else if (button.hasAttribute('data-digits')) {
    state.digits = button.dataset.digits === '' ? null : Number(button.dataset.digits);
    updateHomeSelection();
    animate(document.querySelector('#level-hint'), [{opacity:0, transform:'translateY(4px)'}, {opacity:1, transform:'translateY(0)'}]);
  } else if (button.id === 'giveup') confirmExit();
  else if (button.id === 'target-practice') {state.targetSkill=button.dataset.skill;state.targetTitle=button.dataset.title;state.operation='tambah';state.engine='default';start();}
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
  } else if (button.dataset.key) press(button.dataset.key);
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
